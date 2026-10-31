import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../prisma/prisma.service';
import { BookingsService } from '../bookings/bookings.service';

@Injectable()
export class PaymentsService {
  private razorpay?: Razorpay;
  constructor(private prisma: PrismaService, private config: ConfigService, private bookings: BookingsService) {
    const keyId = config.get<string>('RAZORPAY_KEY_ID'), keySecret = config.get<string>('RAZORPAY_KEY_SECRET');
    if (keyId && keySecret) this.razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  async createOrder(userId: string, bookingId: string, body: { purpose?: 'ADVANCE'|'BALANCE'|'DEPOSIT'; amountPaise?: number }) {
    if (!this.razorpay) throw new BadRequestException('Online payments are not configured. Please select pay at shop or contact the shop.');
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customerId: userId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['PENDING','CONFIRMED'].includes(booking.status)) throw new BadRequestException('This booking cannot accept an online payment.');
    const purpose = body.purpose || 'ADVANCE';
    const rentalDue = Math.max(0, booking.totalAmountPaise - booking.amountPaidPaise);
    const depositDue = Math.max(0, booking.securityDepositPaise - booking.depositPaidPaise);
    const requested = Number(body.amountPaise || 0);
    const amountPaise = purpose === 'DEPOSIT' ? depositDue : requested > 0 ? requested : purpose === 'BALANCE' ? rentalDue : Math.min(rentalDue, Math.max(5000, Math.round(booking.rentalAmountPaise * 0.2)));
    if (!Number.isInteger(amountPaise) || amountPaise < 100 || (purpose !== 'DEPOSIT' && amountPaise > rentalDue) || (purpose === 'DEPOSIT' && amountPaise > depositDue)) throw new BadRequestException('Payment amount is invalid.');
    const order = await this.razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt: booking.bookingCode, notes: { bookingId, userId, purpose } });
    await this.prisma.payment.create({ data: { bookingId, userId, amountPaise, purpose, method: 'RAZORPAY', status: 'PENDING', gatewayOrderId: order.id } });
    return { orderId: order.id, amountPaise, currency: 'INR', keyId: this.config.get('RAZORPAY_KEY_ID'), bookingCode: booking.bookingCode };
  }
  async verifyOrder(userId: string, body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const payment = await this.prisma.payment.findFirst({ where: { gatewayOrderId: body.razorpay_order_id, userId }, include: { booking: true } });
    if (!payment) throw new NotFoundException('Payment order not found');
    if (payment.status === 'PAID') return this.bookings.refreshPaymentState(payment.bookingId);
    if (['CANCELLED','REJECTED','EXPIRED'].includes(payment.booking.status)) throw new BadRequestException('This booking is no longer active. Contact the shop to resolve the captured payment.');
    const secret = this.config.get<string>('RAZORPAY_KEY_SECRET') || '';
    const expected = createHmac('sha256', secret).update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(body.razorpay_signature || '');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Payment signature verification failed');
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', gatewayPaymentId: body.razorpay_payment_id, gatewaySignature: body.razorpay_signature, paidAt: new Date() } });
    return this.bookings.refreshPaymentState(payment.bookingId);
  }
  async recordManual(actorId: string, body: any) {
    const booking = await this.prisma.booking.findUnique({ where: { id: body.bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    const amountPaise = Number(body.amountPaise);
    if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new BadRequestException('Enter an amount in paise greater than zero.');
    if (body.purpose === 'REFUND') {
      const isDeposit = body.refundType === 'DEPOSIT';
      const refundable = isDeposit ? Math.max(0, booking.depositPaidPaise - booking.depositRefundedPaise) : Math.max(0, booking.amountPaidPaise - booking.amountRefundedPaise);
      if (amountPaise > refundable) throw new BadRequestException('Refund exceeds the amount paid in that category.');
      await this.prisma.payment.create({ data: { bookingId: booking.id, userId: booking.customerId, amountPaise, purpose: 'REFUND', method: body.method || 'CASH', status: 'PAID', paidAt: new Date(), reference: body.reference, note: `${isDeposit ? 'Deposit ' : ''}refund entered by ${actorId}` } });
      return this.prisma.booking.update({ where: { id: booking.id }, data: isDeposit ? { depositRefundedPaise: booking.depositRefundedPaise + amountPaise } : { amountRefundedPaise: booking.amountRefundedPaise + amountPaise } });
    }
    const purpose = body.purpose || 'ADVANCE';
    const due = purpose === 'DEPOSIT' ? booking.securityDepositPaise - booking.depositPaidPaise : booking.totalAmountPaise - booking.amountPaidPaise;
    if (amountPaise > Math.max(0, due)) throw new BadRequestException('The payment amount exceeds the outstanding balance.');
    await this.prisma.payment.create({ data: { bookingId: booking.id, userId: booking.customerId, amountPaise, purpose, method: body.method || 'CASH', status: 'PAID', paidAt: new Date(), reference: body.reference, note: body.note || `Recorded by ${actorId}` } });
    return this.bookings.refreshPaymentState(booking.id);
  }
  async webhook(rawBody: Buffer, signature: string | undefined) {
    const secret = this.config.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret || !signature) throw new UnauthorizedException('Webhook verification is not configured');
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid webhook signature');
    const event = JSON.parse(rawBody.toString('utf8'));
    if (event.event === 'payment.captured') {
      const entity = event.payload?.payment?.entity;
      const payment = await this.prisma.payment.findFirst({ where: { gatewayOrderId: entity?.order_id }, include: { booking: true } });
      if (payment && payment.status !== 'PAID') {
        const staleBooking = ['CANCELLED','REJECTED','EXPIRED'].includes(payment.booking.status);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: 'PAID',
            gatewayPaymentId: entity.id,
            paidAt: new Date(entity.created_at * 1000),
            note: staleBooking ? `Payment captured after booking status became ${payment.booking.status}; shop review/refund required.` : payment.note,
          },
        });
        await this.bookings.refreshPaymentState(payment.bookingId);
        if (staleBooking) {
          await this.prisma.notification.create({ data: { userId: payment.userId, title: 'Payment needs shop review', message: `A payment for booking ${payment.booking.bookingCode} was captured after the booking was ${payment.booking.status.toLowerCase()}. Please contact the shop to resolve it.` } });
        }
      }
    }
    return { received: true };
  }
}
