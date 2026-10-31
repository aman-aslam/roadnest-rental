import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { RolesGuard } from '../common/roles.guard';
@Module({ controllers: [BookingsController], providers: [BookingsService, RolesGuard], exports: [BookingsService] })
export class BookingsModule {}
