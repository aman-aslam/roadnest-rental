import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Lightweight liveness probe for Render. It must not depend on Neon being awake.
  @Get()
  check() {
    return { status: 'ok' };
  }

  // Readiness probe used by the web app to warm the API and database in parallel
  // with the customer's initial page render.
  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch {
      throw new ServiceUnavailableException({
        status: 'starting',
        database: 'unavailable',
      });
    }
  }
}
