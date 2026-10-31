import { Body, Controller, Get, Param, Patch, Post, Req, Res, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { join } from 'path';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { OperationsService } from './operations.service';

const handoverUploads = FilesInterceptor('files', 8, { storage: diskStorage({ destination: 'uploads/handover', filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });

const privateUpload = FileInterceptor('file', {
  storage: diskStorage({ destination: 'uploads', filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomBytes(8).toString('hex')}${extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['image/jpeg','image/png','image/webp','application/pdf'].includes(file.mimetype)),
});

@Controller('operations')
@UseGuards(AuthGuard('jwt'))
export class OperationsController {
  constructor(private operations: OperationsService) {}
  @Post('bookings/:id/photos') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') @UseInterceptors(handoverUploads) handoverPhotos(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) { return this.operations.storeHandoverPhotos(id, files); }
  @Post('bookings/:id/pickup') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') pickup(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: any) { return this.operations.pickup(id, req.user.id, body); }
  @Post('bookings/:id/return') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') returnVehicle(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: any) { return this.operations.returnVehicle(id, req.user.id, body); }
  @Post('vehicles/:id/maintenance') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') maintenanceCreate(@Req() req: Request & { user: any }, @Param('id') id: string, @Body() body: any) { return this.operations.addMaintenance(id, req.user.id, body); }
  @Get('maintenance') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') maintenance() { return this.operations.maintenance(); }
  @Patch('maintenance/:id/complete') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') complete(@Param('id') id: string) { return this.operations.completeMaintenance(id); }
  @Get('customers') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') customers() { return this.operations.customers(); }
  @Get('documents/mine') myDocuments(@Req() req: Request & { user: any }) { return this.operations.myDocuments(req.user.id); }
  @Get('documents/:id/file') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') async documentFile(@Param('id') id: string, @Res() res: Response) { const doc = await this.operations.getDocument(id); return res.sendFile(join(process.cwd(), 'uploads', doc.storageKey)); }
  @Post('documents') @UseInterceptors(privateUpload) uploadDoc(@Req() req: Request & { user: any }, @UploadedFile() file: Express.Multer.File, @Body('type') type: string) { return this.operations.saveDocument(req.user.id, file, type); }
  @Patch('documents/:id/verify') @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('ADMIN','STAFF') verifyDoc(@Param('id') id: string, @Body() body: { status: 'VERIFIED'|'REJECTED'; adminNote?: string }) { return this.operations.verifyDocument(id, body.status, body.adminNote); }
}
