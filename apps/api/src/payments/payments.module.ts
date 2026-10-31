import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BookingsModule } from '../bookings/bookings.module';
import { RolesGuard } from '../common/roles.guard';
@Module({ imports: [BookingsModule], controllers: [PaymentsController], providers: [PaymentsService, RolesGuard] })
export class PaymentsModule {}
