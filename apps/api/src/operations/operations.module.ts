import { Module } from '@nestjs/common';
import { OperationsController } from './operations.controller';
import { OperationsService } from './operations.service';
import { BookingsModule } from '../bookings/bookings.module';
import { RolesGuard } from '../common/roles.guard';
import { R2StorageService } from '../storage/r2-storage.service';

@Module({
  imports: [BookingsModule],
  controllers: [OperationsController],
  providers: [OperationsService, RolesGuard, R2StorageService],
})
export class OperationsModule {}
