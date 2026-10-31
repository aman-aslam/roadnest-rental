import { BadRequestException, Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { AiService } from './ai.service';

@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('vehicles/detect')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @UseInterceptors(FilesInterceptor('files', 4, {
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
  }))
  detectVehicle(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files?.length) throw new BadRequestException('Upload at least one JPG, PNG or WebP vehicle photo.');
    return this.ai.detectVehicle(files);
  }

  @Post('assistant/chat')
  chat(@Body() body: { message?: string }) {
    if (!body?.message || typeof body.message !== 'string' || body.message.trim().length < 2) {
      throw new BadRequestException('Please enter a rental question.');
    }
    if (body.message.length > 1200) throw new BadRequestException('Message must be 1,200 characters or fewer.');
    return this.ai.chat(body.message.trim());
  }
}
