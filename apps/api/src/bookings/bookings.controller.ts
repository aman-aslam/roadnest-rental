import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { WalkInBookingDto } from './dto/walk-in-booking.dto';

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookings: BookingsService) {}
  @Post() create(@Req() req: Request & { user: any }, @Body() dto: CreateBookingDto) { return this.bookings.createOnline(req.user.id, dto); }
  @Get('mine') mine(@Req() req: Request & { user: any }) { return this.bookings.mine(req.user.id); }
  @Get('mine/:id') customerDetail(@Req() req: Request & { user: any }, @Param('id') id: string) { return this.bookings.customerDetail(req.user.id, id); }
  @Post(':id/cancel') cancel(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: { reason?: string }) { return this.bookings.cancel(id, req.user.id, body.reason); }
  @Get('admin/list') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') adminList(@Query() query: any) { return this.bookings.all(query); }
  @Get('admin/:id') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') adminDetail(@Param('id') id: string) { return this.bookings.getAdminDetail(id); }
  @Patch('admin/:id/extend') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') extend(@Param('id') id: string, @Body() body: { newReturnAt: string }) { return this.bookings.extend(id, body.newReturnAt); }
  @Post('admin/walk-in') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') walkIn(@Req() req: Request & { user: any }, @Body() dto: WalkInBookingDto) { return this.bookings.createWalkIn(dto, req.user.id); }
  @Patch('admin/:id/status') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') status(@Param('id') id: string, @Body() body: { status: string; reason?: string }) { return this.bookings.updateStatus(id, body.status, body.reason); }
}
