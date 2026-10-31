import { Body, Controller, Headers, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}
  @Post('razorpay/order') @UseGuards(AuthGuard('jwt')) createOrder(@Req() req: Request & { user: any }, @Body() body: any) { return this.payments.createOrder(req.user.id, body.bookingId, body); }
  @Post('razorpay/verify') @UseGuards(AuthGuard('jwt')) verify(@Req() req: Request & { user: any }, @Body() body: any) { return this.payments.verifyOrder(req.user.id, body); }
  @Post('manual') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') manual(@Req() req: Request & { user: any }, @Body() body: any) { return this.payments.recordManual(req.user.id, body); }
  @Post('razorpay/webhook') webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string) { return this.payments.webhook(req.rawBody || Buffer.from(''), signature); }
}
