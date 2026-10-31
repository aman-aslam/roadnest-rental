import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private prisma: PrismaService) {}
  async findAll(query: any, includeUnpublished = false) {
    const pickupAt = query.pickupAt ? new Date(query.pickupAt) : null;
    const returnAt = query.returnAt ? new Date(query.returnAt) : null;
    const where: any = {
      isPublished: includeUnpublished ? undefined : true,
      status: query.status || undefined,
      type: query.type || undefined,
      category: query.category || undefined,
      fuelType: query.fuelType || undefined,
      transmission: query.transmission || undefined,
      brand: query.brand || undefined,
      pickupLocation: query.pickupLocation ? { contains: query.pickupLocation, mode: 'insensitive' } : undefined,
      dailyRatePaise: (query.minPricePaise || query.maxPricePaise) ? { gte: query.minPricePaise ? Number(query.minPricePaise) : undefined, lte: query.maxPricePaise ? Number(query.maxPricePaise) : undefined } : undefined,
      OR: query.search ? [
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
        { model: { contains: query.search, mode: 'insensitive' } },
      ] : undefined,
    };
    if (pickupAt && returnAt && pickupAt < returnAt) {
      where.bookings = { none: { status: { in: ['PENDING','CONFIRMED','ACTIVE'] }, pickupAt: { lt: returnAt }, returnAt: { gt: pickupAt } } };
      where.blocks = { none: { startsAt: { lt: returnAt }, endsAt: { gt: pickupAt } } };
    }
    return this.prisma.vehicle.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' } } }, orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }] });
  }
  async findOne(id: string) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id }, include: { images: { orderBy: { sortOrder: 'asc' } } } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }
  async create(dto: CreateVehicleDto) {
    const carCategories = ['HATCHBACK', 'SEDAN', 'SUV', 'MPV', 'LUXURY'];
    const bikeCategories = ['SPORTS_BIKE', 'SCOOTER', 'MOTORCYCLE', 'ELECTRIC_BIKE'];
    const validCategories = dto.type === 'CAR' ? carCategories : bikeCategories;
    if (!validCategories.includes(dto.category)) {
      throw new BadRequestException(`Category ${dto.category} is not valid for ${dto.type} vehicles.`);
    }

    const { images = [], ...data } = dto;
    return this.prisma.vehicle.create({
      data: {
        ...(data as any),
        registrationNumber: data.registrationNumber.trim().toUpperCase(),
        isElectric: (data as any).isElectric ?? (data as any).fuelType === 'ELECTRIC',
        images: {
          create: images.map((url, index) => ({ url, sortOrder: index })),
        },
      },
      include: { images: true },
    });
  }
  async bulkCreate(vehicles: CreateVehicleDto[]) {
    const results: Array<{
      row: number;
      success: boolean;
      id?: string;
      displayName?: string;
      registrationNumber: string;
      error?: string;
    }> = [];

    // Process rows independently so one duplicate registration does not block
    // the other vehicles in the same spreadsheet.
    for (let index = 0; index < vehicles.length; index++) {
      const vehicle = vehicles[index];
      try {
        const created = await this.create(vehicle);
        results.push({
          row: index + 1,
          success: true,
          id: created.id,
          displayName: created.displayName,
          registrationNumber: created.registrationNumber,
        });
      } catch (error: any) {
        const message = error?.code === 'P2002'
          ? 'This registration number already exists.'
          : 'This row could not be saved. Check its values and try again.';
        results.push({
          row: index + 1,
          success: false,
          registrationNumber: vehicle.registrationNumber,
          error: message,
        });
      }
    }

    const created = results.filter(result => result.success).length;
    return {
      total: vehicles.length,
      created,
      failed: vehicles.length - created,
      results,
    };
  }

  async update(id: string, dto: Partial<CreateVehicleDto>) {
    await this.findOne(id);
    const { images, ...data } = dto as any;
    return this.prisma.$transaction(async tx => {
      if (images) await tx.vehicleImage.deleteMany({ where: { vehicleId: id } });
      return tx.vehicle.update({ where: { id }, data: { ...data, ...((data as any).fuelType ? { isElectric: (data as any).fuelType === 'ELECTRIC' } : {}), ...(images ? { images: { create: images.map((url: string, index: number) => ({ url, sortOrder: index })) } } : {}) }, include: { images: true } });
    });
  }
  async archive(id: string) {
    await this.findOne(id);
    return this.prisma.vehicle.update({ where: { id }, data: { isPublished: false, status: 'INACTIVE' } });
  }
  async quote(id: string, pickupAt: string, returnAt: string) {
    const start = new Date(pickupAt), end = new Date(returnAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start <= new Date() || start >= end) throw new BadRequestException('Choose a valid future pickup and return time.');
    const vehicle = await this.findOne(id);
    const available = await this.availability(id, pickupAt, returnAt);
    if (!available.available) throw new ConflictException(available.reason || 'Vehicle is not available');
    const hours = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 3600000));
    let remaining = hours, amount = 0;
    if (vehicle.monthlyRatePaise && remaining >= 720) { const n = Math.floor(remaining / 720); amount += n * vehicle.monthlyRatePaise; remaining -= n * 720; }
    if (vehicle.weeklyRatePaise && remaining >= 168) { const n = Math.floor(remaining / 168); amount += n * vehicle.weeklyRatePaise; remaining -= n * 168; }
    if (remaining >= 24) { const n = Math.floor(remaining / 24); amount += n * vehicle.dailyRatePaise; remaining -= n * 24; }
    if (remaining > 0) amount += vehicle.hourlyRatePaise ? remaining * vehicle.hourlyRatePaise : Math.ceil(remaining / 24) * vehicle.dailyRatePaise;
    return { available: true, rentalHours: hours, rentalAmountPaise: amount, securityDepositPaise: vehicle.securityDepositPaise, includedKm: vehicle.includedKmPerDay == null ? null : vehicle.includedKmPerDay * Math.ceil(hours / 24), extraKmRatePaise: vehicle.extraKmRatePaise };
  }
  async availability(id: string, pickupAt: string, returnAt: string) {
    const start = new Date(pickupAt), end = new Date(returnAt);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start >= end) return { available: false, reason: 'Choose a valid pickup and return time.' };
    const [booking, block] = await Promise.all([
      this.prisma.booking.findFirst({ where: { vehicleId: id, status: { in: ['PENDING','CONFIRMED','ACTIVE'] }, pickupAt: { lt: end }, returnAt: { gt: start } }, select: { id: true, pickupAt: true, returnAt: true } }),
      this.prisma.vehicleBlock.findFirst({ where: { vehicleId: id, startsAt: { lt: end }, endsAt: { gt: start } }, select: { id: true } }),
    ]);
    return { available: !booking && !block, reason: booking || block ? 'This vehicle is not available for the selected time.' : undefined };
  }
}
