import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}
  async dashboard() {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalCars, totalBikes, available, rented, maintenance, todayBookings, upcomingBookings, monthlyPayments, monthlyDeposits, pendingPayments, expenses] = await Promise.all([
      this.prisma.vehicle.count({ where: { type: 'CAR', isPublished: true } }),
      this.prisma.vehicle.count({ where: { type: 'BIKE', isPublished: true } }),
      this.prisma.vehicle.count({ where: { status: 'AVAILABLE', isPublished: true } }),
      this.prisma.vehicle.count({ where: { status: 'RENTED', isPublished: true } }),
      this.prisma.vehicle.count({ where: { status: 'MAINTENANCE' } }),
      this.prisma.booking.count({ where: { pickupAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86400000) }, status: { notIn: ['CANCELLED','REJECTED','EXPIRED'] } } }),
      this.prisma.booking.count({ where: { pickupAt: { gte: now }, status: { in: ['PENDING','CONFIRMED'] } } }),
      this.prisma.payment.aggregate({ where: { status: 'PAID', purpose: { notIn: ['REFUND','DEPOSIT'] }, paidAt: { gte: monthStart } }, _sum: { amountPaise: true } }),
      this.prisma.payment.aggregate({ where: { status: 'PAID', purpose: 'DEPOSIT', paidAt: { gte: monthStart } }, _sum: { amountPaise: true } }),
      this.prisma.booking.aggregate({ where: { status: { in: ['PENDING','CONFIRMED','ACTIVE'] } }, _sum: { totalAmountPaise: true, amountPaidPaise: true } }),
      this.prisma.expense.aggregate({ where: { expenseDate: { gte: monthStart } }, _sum: { amountPaise: true } }),
    ]);
    return {
      totalCars, totalBikes, totalVehicles: totalCars + totalBikes, available, rented, maintenance,
      todayBookings, upcomingBookings,
      monthlyRevenuePaise: monthlyPayments._sum.amountPaise || 0,
      monthlyDepositsPaise: monthlyDeposits._sum.amountPaise || 0,
      pendingPaymentsPaise: Math.max(0, (pendingPayments._sum.totalAmountPaise || 0) - (pendingPayments._sum.amountPaidPaise || 0)),
      monthlyExpensesPaise: expenses._sum.amountPaise || 0,
    };
  }
  async revenue(from?: string, to?: string) {
    const where: any = { status: 'PAID', purpose: { notIn: ['REFUND','DEPOSIT'] }, paidAt: { gte: from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1), lte: to ? new Date(to) : undefined } };
    const payments = await this.prisma.payment.findMany({ where, include: { booking: { select: { bookingCode: true, source: true, vehicle: { select: { displayName: true } } } } }, orderBy: { paidAt: 'desc' }, take: 1000 });
    const totalPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);
    return { totalPaise, count: payments.length, payments };
  }
  async expenses() { return this.prisma.expense.findMany({ orderBy: { expenseDate: 'desc' }, take: 250 }); }
  addExpense(body: any) { return this.prisma.expense.create({ data: { category: body.category, title: body.title, amountPaise: Number(body.amountPaise), expenseDate: new Date(body.expenseDate), vendor: body.vendor, reference: body.reference, notes: body.notes } }); }
}
