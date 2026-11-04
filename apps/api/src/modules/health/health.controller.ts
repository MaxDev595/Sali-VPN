import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';

/** GET /api/v1/health — used by Render to know the service is up (and the database reachable). */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }
}
