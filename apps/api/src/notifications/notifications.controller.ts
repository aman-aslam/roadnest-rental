import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Req } from '@nestjs/common';
import { Request } from 'express';
import { NotificationsService } from './notifications.service';
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}
  @Get('mine') list(@Req() req: Request & { user: any }) { return this.notifications.list(req.user.id); }
  @Patch(':id/read') read(@Req() req: Request & { user: any }, @Param('id') id: string) { return this.notifications.markRead(req.user.id, id); }
}
