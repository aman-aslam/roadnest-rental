import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { RolesGuard } from '../common/roles.guard';
@Module({ controllers: [VehiclesController], providers: [VehiclesService, RolesGuard] })
export class VehiclesModule {}
