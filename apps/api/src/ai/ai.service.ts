import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type AiVehicleDraft = {
  type: 'CAR' | 'BIKE';
  category: string;
  brand: string;
  model: string;
  variant: string | null;
  displayName: string;
  color: string | null;
  fuelType: string | null;
  transmission: string | null;
  seats: number | null;
  engineCc: number | null;
  features: string[];
  description: string;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
  needsVerification: string[];
};

@Injectable()
export class AiService {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

 constructor(
  config: ConfigService,
  private readonly prisma: PrismaService,
  ) {
    this.apiKey =
      config.get<string>('OPENAI_API_KEY')?.trim() || '';

    this.model =
      config.get<string>('OPENAI_MODEL') ||
      'gpt-4o-mini';

    this.baseUrl = (
      config.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');

    console.log('AI CONFIG CHECK:', {
      apiKeyLoaded: Boolean(this.apiKey),
      apiKeyLength: this.apiKey.length,
      baseUrl: this.baseUrl,
      model: this.model,
    });
  }

  private async completion(messages: any[], json = false): Promise<string> {
    if (!this.apiKey) throw new ServiceUnavailableException('AI is not configured. Add OPENAI_API_KEY to apps/api/.env.');
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.2,
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: AbortSignal.timeout(45000),
      });
    } catch {
      throw new BadGatewayException('The AI service could not be reached. Please try again.');
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');

      console.error('OPENROUTER ERROR:', {
        status: response.status,
        detail,
      });

      throw new BadGatewayException(
        `AI provider error (${response.status}). ${detail.slice(0, 500)}`,
      );
    }
    const payload: any = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new BadGatewayException('The AI provider returned an empty response.');
    return content;
  }

  async detectVehicle(files: Express.Multer.File[]) {
    const imageParts = files.map(file => ({
      type: 'image_url',
      image_url: { url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`, detail: 'high' },
    }));
    const prompt = `You are assisting a rental shop owner entering a vehicle into their inventory.
Analyse only details that are reasonably visible or inferable from the supplied photos. Return one JSON object with:
type (CAR or BIKE), category (one of HATCHBACK, SEDAN, SUV, LUXURY, SPORTS_BIKE, SCOOTER, MOTORCYCLE, ELECTRIC_BIKE), brand, model, variant, displayName, color, fuelType (PETROL, DIESEL, ELECTRIC, HYBRID, CNG or null), transmission (MANUAL, AUTOMATIC or null), seats (number or null), engineCc (number or null), features (string array), description (short factual listing description), confidence (object mapping each suggested field to high/medium/low), needsVerification (string array).
Do not infer registration number, exact model year, exact variant, engine capacity, legal ownership, or unseen mechanical features from appearance. For uncertain specifications use null or a low confidence rating and explain them in needsVerification. Do not include price or registration number. Output JSON only.`;
    const content = await this.completion([{ role: 'user', content: [{ type: 'text', text: prompt }, ...imageParts] }], true);
    console.log('AI RAW RESPONSE:', content);
    try {
      const draft = JSON.parse(content) as AiVehicleDraft;
      if (!['CAR', 'BIKE'].includes(draft.type)) draft.type = 'CAR';
      const allowedCategories = ['HATCHBACK','SEDAN','SUV','LUXURY','SPORTS_BIKE','SCOOTER','MOTORCYCLE','ELECTRIC_BIKE'];
      if (!allowedCategories.includes(draft.category)) draft.category = draft.type === 'CAR' ? 'HATCHBACK' : 'MOTORCYCLE';
      draft.features = Array.isArray(draft.features) ? draft.features.filter(x => typeof x === 'string').slice(0, 12) : [];
      draft.needsVerification = Array.isArray(draft.needsVerification) ? draft.needsVerification : [];
      if (!draft.needsVerification.includes('Registration number must be entered and verified by the shop owner.')) {
        draft.needsVerification.push('Registration number must be entered and verified by the shop owner.');
      }
      if (!draft.needsVerification.includes('Manufacturing year and exact variant must be checked against the vehicle documents.')) {
        draft.needsVerification.push('Manufacturing year and exact variant must be checked against the vehicle documents.');
      }
      return { draft, notice: 'AI suggestions only. Verify every field before saving. Registration, manufacturing year and exact variant are not verified from photos.' };
    } catch {
      throw new BadGatewayException('The AI response could not be read. Please try again or fill the form manually.');
    }
  }

  private fallbackMatches(message: string, vehicles: any[]) {
    const q = message.toLowerCase();
    const type = /bike|scooter|motorcycle|two.?wheeler/.test(q) ? 'BIKE' : /car|suv|sedan|hatchback/.test(q) ? 'CAR' : null;
    const budget = q.match(/(?:under|below|less than|budget(?: of)?)\s*₹?\s*([\d,]+)/);
    const maxDaily = budget ? Number(budget[1].replace(/,/g, '')) * 100 : null;
    return vehicles.filter(v => (!type || v.type === type) && (!maxDaily || v.dailyRatePaise <= maxDaily)).slice(0, 4);
  }


  async chat(message: string) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        isPublished: true,
        status: { not: 'INACTIVE' },
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
      orderBy: [
        { isFeatured: 'desc' },
        { dailyRatePaise: 'asc' },
      ],
      take: 50,
    });

    if (!vehicles.length) {
      return {
        answer: 'Our fleet is being updated right now. Please check again shortly.',
        vehicles: [],
      };
    }

    // Match vehicles using actual database data.
    const matches = this.fallbackMatches(message, vehicles);

    if (!matches.length) {
      return {
        answer: 'I could not find a vehicle matching your request. Try a different vehicle type or daily budget.',
        vehicles: [],
      };
    }

    // Provide useful matching results even without an AI API key.
    if (!this.apiKey) {
      return {
        answer: 'Here are some vehicles matching your request. Please check the vehicle page for availability.',
        vehicles: matches.map(v => this.publicVehicle(v)),
        aiConfigured: false,
      };
    }

    const inventory = matches.map(v => ({
      name: v.displayName,
      type: v.type,
      category: v.category,
      dailyRateINR: Math.round(v.dailyRatePaise / 100),
      depositINR: Math.round(v.securityDepositPaise / 100),
    }));

    // AI generates the explanation only.
    // Vehicle selection is handled by the backend.
    const content = await this.completion([
      {
        role: 'system',
        content: `
          You are RoadNest's friendly rental assistant.

          Recommend only vehicles from the supplied inventory.
          Use the exact vehicle names and daily prices supplied.
          Never invent availability or booking confirmation.
          Keep the response friendly and concise.
          Ask one useful follow-up question when appropriate.
          Respond in plain text, NOT JSON.
        `,
      },
      {
        role: 'user',
        content: `
          Customer request: ${message}

          Matching RoadNest inventory:
          ${JSON.stringify(inventory)}

          Recommend these matching vehicles and explain why they fit.
          Mention that availability must be confirmed for the requested dates.
        `,
      },
    ]);

    return {
      answer: content.trim(),
      vehicles: matches.map(v => this.publicVehicle(v)),
      aiConfigured: true,
    };
  }


  private publicVehicle(v: any) {
    return {
      id: v.id, displayName: v.displayName, type: v.type, category: v.category,
      fuelType: v.fuelType, transmission: v.transmission, seats: v.seats,
      dailyRatePaise: v.dailyRatePaise, securityDepositPaise: v.securityDepositPaise,
      image: v.images?.[0]?.url || null,
    };
  }
}
