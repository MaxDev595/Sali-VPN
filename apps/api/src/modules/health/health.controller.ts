import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * GET /api/v1/health — Render pings this every few seconds, so it must NOT touch the
 * database (that would keep Neon awake 24/7 and burn its compute hours).
 * GET /api/v1/health/db — manual check that the database is reachable.
 */
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  health() {
    return { ok: true, uptime: Math.round(process.uptime()) };
  }

  @Get('db')
  async db() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { ok: true, db: true };
  }
}
