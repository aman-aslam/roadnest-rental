import { BadGatewayException, Body, Controller, Delete, Get, Param, Patch, Post, Query, ServiceUnavailableException, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createHash, randomBytes } from 'crypto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService, private prisma: PrismaService) {}

  @Get()
  list(@Query() query: any) {
    return this.vehicles.findAll(query);
  }

  @Get(':id/quote')
  quote(@Param('id') id: string, @Query('pickupAt') pickup: string, @Query('returnAt') ret: string) {
    return this.vehicles.quote(id, pickup, ret);
  }

  @Get(':id/availability')
  availability(@Param('id') id: string, @Query('pickupAt') pickup: string, @Query('returnAt') ret: string) {
    return this.vehicles.availability(id, pickup, ret);
  }

  @Get(':id')
  detail(@Param('id') id: string) {
    return this.vehicles.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STAFF')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehicles.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STAFF')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehicles.update(id, dto);
  }

  private async uploadToCloudinary(file: Express.Multer.File): Promise<{ url: string; publicId: string }> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException(
        'Vehicle image storage is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to the API environment.',
      );
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = 'roadnest/vehicles';
    const publicId = `${Date.now()}-${randomBytes(8).toString('hex')}`;
    const signatureParams = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}`;
    const signature = createHash('sha1')
      .update(`${signatureParams}${apiSecret}`)
      .digest('hex');

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname);
    form.append('api_key', apiKey);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('signature', signature);

    let response: Response;
    try {
      response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      throw new BadGatewayException('Could not reach image storage. Please retry the upload.');
    }

    const payload = await response.json().catch(() => ({})) as {
      secure_url?: string;
      public_id?: string;
      error?: { message?: string };
    };

    if (!response.ok || !payload.secure_url || !payload.public_id) {
      throw new BadGatewayException(
        payload.error?.message || 'Image storage rejected the upload. Please check the Cloudinary configuration.',
      );
    }

    return { url: payload.secure_url, publicId: payload.public_id };
  }

  @Post(':id/images')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @UseInterceptors(FilesInterceptor('files', 8, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  }))
  async uploadImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    await this.vehicles.findOne(id);
    if (!files?.length) return { images: [] };

    const uploaded = await Promise.all(files.map(file => this.uploadToCloudinary(file)));
    const current = await this.prisma.vehicleImage.count({ where: { vehicleId: id } });
    const images = await this.prisma.vehicleImage.createMany({
      data: uploaded.map((asset, index) => ({
        vehicleId: id,
        url: asset.url,
        alt: files[index].originalname,
        sortOrder: current + index,
      })),
    });

    return { count: images.count };
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  archive(@Param('id') id: string) {
    return this.vehicles.archive(id);
  }
}
