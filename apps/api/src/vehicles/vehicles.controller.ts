import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehiclesService } from './vehicles.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private vehicles: VehiclesService, private prisma: PrismaService) {}
  @Get() list(@Query() query: any) { return this.vehicles.findAll(query); }
  @Get(':id/quote') quote(@Param('id') id: string, @Query('pickupAt') pickup: string, @Query('returnAt') ret: string) { return this.vehicles.quote(id, pickup, ret); }
  @Get(':id/availability') availability(@Param('id') id: string, @Query('pickupAt') pickup: string, @Query('returnAt') ret: string) { return this.vehicles.availability(id, pickup, ret); }
  @Get(':id') detail(@Param('id') id: string) { return this.vehicles.findOne(id); }
  @Post() @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') create(@Body() dto: CreateVehicleDto) { return this.vehicles.create(dto); }
  @Patch(':id') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) { return this.vehicles.update(id, dto); }

  @Post(':id/images') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF')
  @UseInterceptors(FilesInterceptor('files', 8, { storage: diskStorage({ destination: 'public/vehicle-images', filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) }))
  async uploadImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    await this.vehicles.findOne(id);
    if (!files?.length) return { images: [] };
    const current = await this.prisma.vehicleImage.count({ where: { vehicleId: id } });
    const images = await this.prisma.vehicleImage.createMany({ data: files.map((file, index) => ({ vehicleId: id, url: `/vehicle-images/${file.filename}`, alt: file.originalname, sortOrder: current + index })) });
    return { count: images.count };
  }
  @Delete(':id') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN') archive(@Param('id') id: string) { return this.vehicles.archive(id); }
}
