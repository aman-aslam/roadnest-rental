import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { RolesGuard } from '../common/roles.guard';

@Module({ controllers: [AiController], providers: [AiService, RolesGuard] })
export class AiModule {}
