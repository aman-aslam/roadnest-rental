import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { WalkInBookingDto } from './dto/walk-in-booking.dto';

const ACTIVE_STATUSES = ['PENDING', 'CONFIRMED', 'ACTIVE'];
function money(value: number) { return Math.max(0, Math.round(value)); }

@Injectable()
export class BookingsService {
  constructor(private prisma: PrismaService) {}

  private price(hours: number, vehicle: any) {
    // Prices are stored in paise. Month/week/day/hour blocks give predictable,
    // auditable prices and avoid trusting a client-submitted total.
    let remaining = hours, amount = 0;
    if (vehicle.monthlyRatePaise && remaining >= 720) { const n = Math.floor(remaining / 720); amount += n * vehicle.monthlyRatePaise; remaining -= n * 720; }
    if (vehicle.weeklyRatePaise && remaining >= 168) { const n = Math.floor(remaining / 168); amount += n * vehicle.weeklyRatePaise; remaining -= n * 168; }
    if (remaining >= 24) { const n = Math.floor(remaining / 24); amount += n * vehicle.dailyRatePaise; remaining -= n * 24; }
    if (remaining > 0) {
      if (vehicle.hourlyRatePaise) amount += remaining * vehicle.hourlyRatePaise;
      else amount += Math.ceil(remaining / 24) * vehicle.dailyRatePaise;
    }
    return money(amount);
  }

  private async checkVehicleAndAvailability(vehicleId: string, pickupAt: Date, returnAt: Date) {
    if (!Number.isFinite(pickupAt.getTime()) || !Number.isFinite(returnAt.getTime()) || pickupAt <= new Date() || pickupAt >= returnAt) {
      throw new BadRequestException('Select a future pickup time and a return time after pickup.');
    }
    const vehicle = await this.prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle || !vehicle.isPublished || vehicle.status === 'INACTIVE' || vehicle.status === 'MAINTENANCE') throw new NotFoundException('Vehicle is not available for booking');
    const [booking, block] = await Promise.all([
      this.prisma.booking.findFirst({ where: { vehicleId, status: { in: ACTIVE_STATUSES as any }, pickupAt: { lt: returnAt }, returnAt: { gt: pickupAt } }, select: { id: true } }),
      this.prisma.vehicleBlock.findFirst({ where: { vehicleId, startsAt: { lt: returnAt }, endsAt: { gt: pickupAt } }, select: { id: true } }),
    ]);
    if (booking || block) throw new ConflictException('This vehicle has just become unavailable for the selected time. Please choose another time.');
    return vehicle;
  }

  private bookingData(vehicle: any, pickupAt: Date, returnAt: Date, source: 'ONLINE'|'WALK_IN'|'PHONE', customerId: string, dto: any) {
    const hours = Math.max(1, Math.ceil((returnAt.getTime() - pickupAt.getTime()) / 3600000));
    const rentalAmountPaise = this.price(hours, vehicle);
    const days = Math.ceil(hours / 24);
    return {
      bookingCode: `RN-${Date.now().toString().slice(-7)}-${randomBytes(2).toString('hex').toUpperCase()}`,
      vehicleId: vehicle.id, customerId, source, status: source === 'ONLINE' ? 'PENDING' : 'CONFIRMED',
      pickupAt, returnAt, pickupLocation: dto.pickupLocation || vehicle.pickupLocation,
      returnLocation: dto.returnLocation || vehicle.pickupLocation, rentalHours: hours,
      rentalAmountPaise, totalAmountPaise: rentalAmountPaise,
      securityDepositPaise: vehicle.securityDepositPaise, includedKm: vehicle.includedKmPerDay == null ? null : vehicle.includedKmPerDay * days,
      extraKmRatePaise: vehicle.extraKmRatePaise, notes: dto.notes,
      holdExpiresAt: source === 'ONLINE' ? new Date(Date.now() + 15 * 60 * 1000) : null,
    } as any;
  }

  async createOnline(customerId: string, dto: CreateBookingDto) {
    const pickupAt = new Date(dto.pickupAt), returnAt = new Date(dto.returnAt);
    const vehicle = await this.checkVehicleAndAvailability(dto.vehicleId, pickupAt, returnAt);
    const data = this.bookingData(vehicle, pickupAt, returnAt, 'ONLINE', customerId, dto);
    try {
      const booking = await this.prisma.booking.create({ data, include: { vehicle: { include: { images: true } } } });
      await this.prisma.notification.create({ data: { userId: customerId, title: 'Booking request received', message: `Your request ${booking.bookingCode} is on hold for 15 minutes while the shop reviews it.` } });
      return booking;
    } catch (error: any) {
      if (error?.code === 'P2004' || String(error?.message).includes('booking_vehicle_no_overlapping_active_periods')) throw new ConflictException('This vehicle was booked by someone else. Please choose another time.');
      throw error;
    }
  }

  async createWalkIn(dto: WalkInBookingDto, actorId: string) {
    const pickupAt = new Date(dto.pickupAt), returnAt = new Date(dto.returnAt);
    const vehicle = await this.checkVehicleAndAvailability(dto.vehicleId, pickupAt, returnAt);
    let customer = await this.prisma.user.findUnique({ where: { phone: dto.customerPhone } });
    if (!customer) {
      const tempPassword = randomBytes(24).toString('hex');
      customer = await this.prisma.user.create({ data: { name: dto.customerName, phone: dto.customerPhone, email: dto.customerEmail?.trim().toLowerCase() || null, passwordHash: await bcrypt.hash(tempPassword, 12), role: 'CUSTOMER' } });
    } else if (customer.role !== 'CUSTOMER') throw new BadRequestException('This phone number belongs to a staff account.');
    const data = this.bookingData(vehicle, pickupAt, returnAt, 'WALK_IN', customer.id, { ...dto, pickupLocation: vehicle.pickupLocation, returnLocation: vehicle.pickupLocation });
    try {
      const booking = await this.prisma.booking.create({ data, include: { vehicle: true, customer: { select: { id: true, name: true, phone: true, email: true } } } });
      await this.prisma.notification.create({ data: { userId: customer.id, title: 'Walk-in booking created', message: `Your shop booking ${booking.bookingCode} has been recorded.` } });
      if (dto.advanceAmount && Number(dto.advanceAmount) > 0) {
        await this.prisma.payment.create({ data: { bookingId: booking.id, userId: customer.id, amountPaise: money(Number(dto.advanceAmount) * 100), purpose: 'ADVANCE', method: (dto.paymentMethod || 'CASH') as any, status: 'PAID', paidAt: new Date(), note: `Entered by staff ${actorId}` } });
        return this.refreshPaymentState(booking.id);
      }
      return booking;
    } catch (error: any) {
      if (error?.code === 'P2004' || String(error?.message).includes('booking_vehicle_no_overlapping_active_periods')) throw new ConflictException('This vehicle was booked by someone else. Please choose another time.');
      throw error;
    }
  }

  async refreshPaymentState(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const payments = await this.prisma.payment.findMany({ where: { bookingId, status: 'PAID', purpose: { in: ['ADVANCE','BALANCE','EXTRA_CHARGE','DEPOSIT'] } } });
    const paid = payments.filter(p => p.purpose !== 'DEPOSIT').reduce((sum, p) => sum + p.amountPaise, 0);
    const depositPaid = payments.filter(p => p.purpose === 'DEPOSIT').reduce((sum, p) => sum + p.amountPaise, 0);
    const status = paid <= 0 ? 'PENDING' : paid >= booking.totalAmountPaise ? 'PAID' : 'PARTIALLY_PAID';
    return this.prisma.booking.update({ where: { id: bookingId }, data: { amountPaidPaise: paid, depositPaidPaise: depositPaid, paymentStatus: status }, include: { vehicle: true, customer: { select: { id: true, name: true, phone: true, email: true } }, payments: true } });
  }

  async customerDetail(customerId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, customerId }, include: { vehicle: { include: { images: true } }, customer: { select: { name: true, email: true, phone: true } }, payments: true, handovers: true, agreement: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  mine(customerId: string) {
    return this.prisma.booking.findMany({ where: { customerId }, include: { vehicle: { include: { images: true } }, payments: true }, orderBy: { createdAt: 'desc' } });
  }
  all(query: any) {
    return this.prisma.booking.findMany({ where: { status: query.status || undefined, source: query.source || undefined, pickupAt: query.from ? { gte: new Date(query.from) } : undefined }, include: { vehicle: true, customer: { select: { id: true, name: true, phone: true, email: true } }, payments: true }, orderBy: { pickupAt: 'asc' }, take: 250 });
  }
  async cancel(id: string, customerId: string, reason?: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, customerId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['PENDING','CONFIRMED'].includes(booking.status)) throw new BadRequestException('This booking can no longer be cancelled online. Contact the shop.');
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: reason || 'Cancelled by customer', holdExpiresAt: null } });
    await this.prisma.notification.create({ data: { userId: customerId, title: 'Booking cancelled', message: `Your booking ${booking.bookingCode} has been cancelled. Contact the shop for any applicable refund.` } });
    return updated;
  }
  async extend(id: string, newReturnAtRaw: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['CONFIRMED','ACTIVE'].includes(booking.status)) throw new BadRequestException('Only confirmed or active rentals can be extended.');
    const newReturnAt = new Date(newReturnAtRaw);
    if (!Number.isFinite(newReturnAt.getTime()) || newReturnAt <= booking.returnAt) throw new BadRequestException('The new return time must be later than the current return time.');
    const [otherBooking, block] = await Promise.all([
      this.prisma.booking.findFirst({ where: { id: { not: booking.id }, vehicleId: booking.vehicleId, status: { in: ACTIVE_STATUSES as any }, pickupAt: { lt: newReturnAt }, returnAt: { gt: booking.returnAt } }, select: { id: true } }),
      this.prisma.vehicleBlock.findFirst({ where: { vehicleId: booking.vehicleId, startsAt: { lt: newReturnAt }, endsAt: { gt: booking.returnAt } }, select: { id: true } }),
    ]);
    if (otherBooking || block) throw new ConflictException('The vehicle has another reservation or maintenance block during the extension.');
    const hours = Math.max(1, Math.ceil((newReturnAt.getTime() - booking.pickupAt.getTime()) / 3600000));
    const rentalAmountPaise = this.price(hours, booking.vehicle);
    const days = Math.ceil(hours / 24);
    try {
      return await this.prisma.booking.update({ where: { id }, data: { returnAt: newReturnAt, rentalHours: hours, rentalAmountPaise, totalAmountPaise: Math.max(0, rentalAmountPaise - booking.discountPaise + booking.extraKmAmountPaise + booking.lateFeePaise + booking.fuelChargePaise + booking.damageChargePaise), includedKm: booking.vehicle.includedKmPerDay == null ? null : booking.vehicle.includedKmPerDay * days }, include: { vehicle: true, customer: true, payments: true } });
    } catch (error: any) {
      if (error?.code === 'P2004' || String(error?.message).includes('booking_vehicle_no_overlapping_active_periods')) throw new ConflictException('The requested extension conflicts with another reservation.');
      throw error;
    }
  }
  async getAdminDetail(id: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id }, include: { vehicle: { include: { images: true } }, customer: { select: { id: true, name: true, email: true, phone: true, documents: true } }, payments: true, handovers: { include: { photos: true } }, agreement: true } });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  async updateStatus(id: string, status: string, reason?: string) {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundException('Booking not found');
    const allowed: Record<string, string[]> = { CONFIRMED: ['PENDING'], REJECTED: ['PENDING'], CANCELLED: ['PENDING','CONFIRMED'], ACTIVE: ['CONFIRMED'], COMPLETED: ['ACTIVE'] };
    if (!allowed[status]?.includes(booking.status)) throw new BadRequestException(`Cannot change booking from ${booking.status} to ${status}`);
    if (status === 'CONFIRMED' && booking.source === 'ONLINE') {
      const verified = await this.prisma.customerDocument.findMany({ where: { userId: booking.customerId, status: 'VERIFIED' }, select: { type: true } });
      if (!verified.some(d => d.type === 'DRIVING_LICENSE') || !verified.some(d => d.type === 'ID_PROOF')) throw new BadRequestException("Verify the customer's driving licence and ID proof before confirming this online booking.");
    }
    const updated = await this.prisma.booking.update({ where: { id }, data: { status: status as any, holdExpiresAt: null, ...(status === 'REJECTED' ? { rejectionReason: reason || 'Rejected by shop' } : {}) }, include: { vehicle: true, customer: true } });
    await this.prisma.notification.create({ data: { userId: booking.customerId, title: `Booking ${status.toLowerCase()}`, message: `Your booking ${booking.bookingCode} is now ${status.toLowerCase()}.` } });
    if (status === 'CONFIRMED') {
      await this.prisma.rentalAgreement.upsert({ where: { bookingId: id }, create: { bookingId: id, agreementNo: `AGR-${booking.bookingCode}`, termsVersion: 'v1.0' }, update: {} });
    }
    return updated;
  }

  @Cron('* * * * *')
  async expirePendingHolds() {
    await this.prisma.booking.updateMany({ where: { status: 'PENDING', holdExpiresAt: { lt: new Date() }, payments: { none: { status: 'PAID' } } }, data: { status: 'EXPIRED' } });
  }
}
