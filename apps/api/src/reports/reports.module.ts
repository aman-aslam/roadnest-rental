import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { RolesGuard } from '../common/roles.guard';
@Module({ controllers: [ReportsController], providers: [ReportsService, RolesGuard] })
export class ReportsModule {}
