import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService, private bookings: BookingsService) {}

  async storeHandoverPhotos(bookingId: string, files: Express.Multer.File[]) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { id: true, status: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['CONFIRMED','ACTIVE'].includes(booking.status)) throw new BadRequestException('Photos can only be added during pickup or return.');
    return { storageKeys: (files || []).map(file => file.filename) };
  }

  async pickup(bookingId: string, actorId: string, body: any) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'CONFIRMED') throw new BadRequestException('Only confirmed bookings can be handed over.');
    const odometerKm = Number(body.odometerKm), fuelPct = Number(body.fuelOrBatteryPct);
    if (!Number.isInteger(odometerKm) || odometerKm < 0 || !Number.isInteger(fuelPct) || fuelPct < 0 || fuelPct > 100) throw new BadRequestException('Enter a valid odometer and fuel/battery percentage.');
    return this.prisma.$transaction(async tx => {
      const handover = await tx.handover.create({ data: { bookingId, type: 'PICKUP', odometerKm, fuelOrBatteryPct: fuelPct, conditionNotes: body.conditionNotes, accessories: body.accessories || [], customerAcknowledged: Boolean(body.customerAcknowledged), recordedById: actorId, photos: { create: (body.photos || []).map((storageKey: string) => ({ storageKey, caption: 'Pickup condition' })) } } });
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'ACTIVE', actualPickupAt: new Date() } });
      await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { status: 'RENTED' } });
      await tx.auditLog.create({ data: { actorId, action: 'BOOKING_PICKUP_RECORDED', entityType: 'Booking', entityId: bookingId, metadata: { odometerKm, fuelPct } } });
      return handover;
    });
  }

  async returnVehicle(bookingId: string, actorId: string, body: any) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { vehicle: true, handovers: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'ACTIVE') throw new BadRequestException('Only active rentals can be returned.');
    const pickup = booking.handovers.find(h => h.type === 'PICKUP');
    if (!pickup) throw new BadRequestException('Pickup inspection is missing. Record pickup before return.');
    const odometerKm = Number(body.odometerKm), fuelPct = Number(body.fuelOrBatteryPct);
    if (!Number.isInteger(odometerKm) || odometerKm < pickup.odometerKm || !Number.isInteger(fuelPct) || fuelPct < 0 || fuelPct > 100) throw new BadRequestException('Return odometer/fuel reading is invalid.');
    const drivenKm = odometerKm - pickup.odometerKm;
    const extraKm = booking.includedKm == null ? 0 : Math.max(0, drivenKm - booking.includedKm);
    const extraKmAmountPaise = extraKm * booking.extraKmRatePaise;
    const actualReturnAt = body.actualReturnAt ? new Date(body.actualReturnAt) : new Date();
    if (!Number.isFinite(actualReturnAt.getTime())) throw new BadRequestException('Invalid actual return time.');
    const lateHours = Math.max(0, Math.ceil((actualReturnAt.getTime() - booking.returnAt.getTime()) / 3600000));
    const lateFeePaise = lateHours * booking.vehicle.lateFeePerHourPaise;
    const fuelChargePaise = Math.max(0, Number(body.fuelChargePaise || 0));
    const damageChargePaise = Math.max(0, Number(body.damageChargePaise || 0));
    await this.prisma.$transaction(async tx => {
      await tx.handover.create({ data: { bookingId, type: 'RETURN', odometerKm, fuelOrBatteryPct: fuelPct, conditionNotes: body.conditionNotes, accessories: body.accessories || [], customerAcknowledged: Boolean(body.customerAcknowledged), recordedById: actorId, photos: { create: (body.photos || []).map((storageKey: string) => ({ storageKey, caption: 'Return condition' })) } } });
      await tx.booking.update({ where: { id: bookingId }, data: { status: 'COMPLETED', actualReturnAt, extraKmAmountPaise, lateFeePaise, fuelChargePaise, damageChargePaise, totalAmountPaise: booking.totalAmountPaise + extraKmAmountPaise + lateFeePaise + fuelChargePaise + damageChargePaise } });
      await tx.vehicle.update({ where: { id: booking.vehicleId }, data: { status: 'AVAILABLE' } });
      await tx.auditLog.create({ data: { actorId, action: 'BOOKING_RETURN_RECORDED', entityType: 'Booking', entityId: bookingId, metadata: { odometerKm, drivenKm, extraKm, lateHours, fuelChargePaise, damageChargePaise } } });
    });
    return this.bookings.refreshPaymentState(bookingId);
  }

  async addMaintenance(vehicleId: string, actorId: string, body: any) {
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    const startsAt = new Date(body.startsAt), dueAt = body.dueAt ? new Date(body.dueAt) : new Date(startsAt.getTime() + 24 * 3600000);
    if (!Number.isFinite(startsAt.getTime()) || !Number.isFinite(dueAt.getTime()) || startsAt >= dueAt) throw new BadRequestException('Enter a valid maintenance window.');
    const conflictingBooking = await this.prisma.booking.findFirst({
      where: { vehicleId, status: { in: ['PENDING','CONFIRMED','ACTIVE'] }, pickupAt: { lt: dueAt }, returnAt: { gt: startsAt } },
      select: { bookingCode: true },
    });
    if (conflictingBooking) throw new BadRequestException(`Maintenance overlaps booking ${conflictingBooking.bookingCode}. Reschedule the service window.`);
    const result = await this.prisma.$transaction(async tx => {
      const record = await tx.maintenanceRecord.create({ data: { vehicleId, title: body.title, description: body.description, startsAt, dueAt, reminderAt: body.reminderAt ? new Date(body.reminderAt) : null, costPaise: Number(body.costPaise || 0), odometerKm: body.odometerKm ? Number(body.odometerKm) : null } });
      await tx.vehicleBlock.create({ data: { vehicleId, startsAt, endsAt: dueAt, reason: `Maintenance: ${body.title}` } });
      if (startsAt <= new Date() && dueAt > new Date()) await tx.vehicle.update({ where: { id: vehicleId }, data: { status: 'MAINTENANCE' } });
      await tx.auditLog.create({ data: { actorId, action: 'MAINTENANCE_CREATED', entityType: 'Vehicle', entityId: vehicleId, metadata: { maintenanceId: record.id } } });
      return record;
    });
    return result;
  }
  maintenance() { return this.prisma.maintenanceRecord.findMany({ include: { vehicle: true }, orderBy: { startsAt: 'desc' }, take: 250 }); }
  async completeMaintenance(id: string) {
    const record = await this.prisma.maintenanceRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Maintenance record not found');
    return this.prisma.$transaction(async tx => {
      const updated = await tx.maintenanceRecord.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } });
      await tx.vehicleBlock.deleteMany({ where: { vehicleId: record.vehicleId, reason: `Maintenance: ${record.title}`, startsAt: record.startsAt } });
      const activeBooking = await tx.booking.findFirst({ where: { vehicleId: record.vehicleId, status: 'ACTIVE' } });
      await tx.vehicle.update({ where: { id: record.vehicleId }, data: { status: activeBooking ? 'RENTED' : 'AVAILABLE' } });
      return updated;
    });
  }
  customers() {
    return this.prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, name: true, email: true, phone: true, createdAt: true, documents: { select: { id: true, type: true, status: true, originalName: true, createdAt: true } }, bookings: { select: { id: true, bookingCode: true, status: true, totalAmountPaise: true, amountPaidPaise: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 } }, orderBy: { createdAt: 'desc' }, take: 250 });
  }
  myDocuments(userId: string) { return this.prisma.customerDocument.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }); }
  async getDocument(id: string) { const doc = await this.prisma.customerDocument.findUnique({ where: { id } }); if (!doc) throw new NotFoundException('Document not found'); return doc; }

  async saveDocument(userId: string, file: Express.Multer.File, type: string) {
    if (!file) throw new BadRequestException('Choose a file to upload.');
    if (!['DRIVING_LICENSE','ID_PROOF'].includes(type)) throw new BadRequestException('Document type is invalid.');
    return this.prisma.customerDocument.create({ data: { userId, type: type as any, originalName: file.originalname, storageKey: file.filename, mimeType: file.mimetype, sizeBytes: file.size } });
  }
  async verifyDocument(id: string, status: 'VERIFIED'|'REJECTED', adminNote?: string) {
    const doc = await this.prisma.customerDocument.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    return this.prisma.customerDocument.update({ where: { id }, data: { status, adminNote, verifiedAt: status === 'VERIFIED' ? new Date() : null } });
  }
}
