import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface TelegramProfile {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private isConfiguredAdmin(telegramId: bigint): boolean {
    const ids = (this.config.get<string>('ADMIN_TELEGRAM_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.includes(telegramId.toString());
  }

  /**
   * Telegram ID is the single source of identity for Sali VPN. There is no
   * separate signup flow — the first time we see a Telegram ID we create the
   * user record automatically. Admin status is derived from
   * ADMIN_TELEGRAM_IDS on every login so revoking access is a config change,
   * not a database migration.
   */
  async findOrCreateByTelegramProfile(profile: TelegramProfile) {
    const isAdmin = this.isConfiguredAdmin(profile.telegramId);
    return this.prisma.user.upsert({
      where: { telegramId: profile.telegramId },
      update: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
        isAdmin,
      },
      create: {
        telegramId: profile.telegramId,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
        isAdmin,
      },
    });
  }

  async findByTelegramId(telegramId: bigint) {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  async setBlocked(userId: string, isBlocked: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { isBlocked } });
  }

  async isAdminTelegramId(telegramId: bigint, adminIdsCsv: string): Promise<boolean> {
    const ids = adminIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.includes(telegramId.toString());
  }
}
