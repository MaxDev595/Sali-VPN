import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { formatPublicId, normalizePublicId } from '../codes/code-format';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { DevicesService } from './devices.service';
import { AddDeviceDto } from './dto/add-device.dto';
import { RegisterDeviceDto } from './dto/register-device.dto';

class UnlinkDto { @IsString() @Length(8, 16) publicId!: string; }

@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DevicesController {
  constructor(
    private readonly devices: DevicesService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  /**
   * «Устройства» in the apps: every installation under this Telegram account — which share
   * the subscription, when each last used the VPN — so old ones can be removed.
   */
  @Get('account')
  async account(@CurrentUser() user: AuthTokenPayload) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    const tg = me.linkedTelegramId ?? me.telegramId;
    if (!tg) return { linked: false, subscription: null, devices: [] };
    const family = await this.subscriptions.sharing(tg);
    const days = (d: Date | null) => (d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000)) : null);
    return {
      linked: true,
      subscription: family.sub ? { plan: family.sub.plan.name, until: family.sub.expiresAt?.toISOString() ?? null, used: family.used, max: family.max } : null,
      devices: family.devices.map((d) => ({
        publicId: formatPublicId(d.publicId),
        platform: d.platform,
        current: d.id === me.id,
        covered: d.covered || d.ownSub,
        lastActiveAt: d.lastActiveAt?.toISOString() ?? null,
        idleDays: days(d.lastActiveAt),
      })),
    };
  }

  /** Removes another installation from the account (frees its place on the subscription). */
  @Post('account/unlink')
  async unlink(@CurrentUser() user: AuthTokenPayload, @Body() dto: UnlinkDto) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: user.sub } });
    const tg = me.linkedTelegramId ?? me.telegramId;
    const target = await this.prisma.user.findUnique({ where: { publicId: normalizePublicId(dto.publicId) } });
    if (!tg || !target) throw new NotFoundException('Устройство не найдено');
    if (target.id === me.id) throw new BadRequestException('Это устройство нельзя удалить отсюда. Отвяжите его в Telegram-боте: «Мои устройства».');
    const app = await this.subscriptions.unlinkInstallation(tg, target.id);
    if (!app) throw new NotFoundException('Это устройство не привязано к вашему аккаунту');
    return { ok: true };
  }

  @Get()
  list(@CurrentUser() user: AuthTokenPayload) {
    return this.devices.list(user.sub);
  }

  @Post()
  add(@CurrentUser() user: AuthTokenPayload, @Body() dto: AddDeviceDto) {
    return this.devices.add(user.sub, dto.name, dto.platform);
  }

  @Post('current')
  registerCurrent(@CurrentUser() user: AuthTokenPayload, @Body() dto: RegisterDeviceDto) {
    return this.devices.registerCurrent(user.sub, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.devices.remove(user.sub, id);
  }
}
