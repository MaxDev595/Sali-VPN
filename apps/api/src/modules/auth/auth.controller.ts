import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService, AuthTokenPayload } from './auth.service';

class AppLoginDto {
  @IsString() @Matches(/^[A-Za-z0-9._:-]{16,128}$/) deviceKey!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly prisma: PrismaService) {}

  @Post('app')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async loginApp(@Body() dto: AppLoginDto) {
    return this.auth.loginApp(dto.deviceKey);
  }

  /**
   * Moves this installation to a new, stable device key (the PC app switching from a random
   * key to one derived from the machine), so reinstalling finds the same Sali ID.
   */
  @Post('app/rebind')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async rebind(@CurrentUser() user: AuthTokenPayload, @Body() dto: AppLoginDto) {
    const taken = await this.prisma.user.findUnique({ where: { appDeviceKey: dto.deviceKey } });
    if (taken && taken.id !== user.sub) return { ok: false, reason: 'taken' };
    await this.prisma.user.update({ where: { id: user.sub }, data: { appDeviceKey: dto.deviceKey } });
    await this.prisma.device.updateMany({ where: { userId: user.sub }, data: { deviceKey: dto.deviceKey } });
    return { ok: true };
  }

  @Post('local')
  async loginLocalDevice() {
    return this.auth.loginLocalDevice();
  }
}
