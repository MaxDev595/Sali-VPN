import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { newPublicId, normalizePublicId } from '../codes/code-format';

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
        publicId: newPublicId(),
        telegramId: profile.telegramId,
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
        isAdmin,
      },
    });
  }

  /**
   * Store-app account: created silently on first launch, identified by the
   * installation key. Access only ever arrives through activation codes.
   */
  async findOrCreateAppUser(appDeviceKey: string) {
    const existing = await this.prisma.user.findUnique({ where: { appDeviceKey } });
    if (existing) return existing;
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.user.create({ data: { publicId: newPublicId(), appDeviceKey, preferredLanguage: 'ru' } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002' || attempt >= 4) throw error;
        const raced = await this.prisma.user.findUnique({ where: { appDeviceKey } });
        if (raced) return raced;
      }
    }
  }

  async findByPublicId(publicId: string) {
    return this.prisma.user.findUnique({ where: { publicId: normalizePublicId(publicId) } });
  }

  /** "Фиксация клиента": the bot ties a store-app installation to a Telegram account. */
  async linkAppToTelegram(publicId: string, telegramId: bigint) {
    const app = await this.findByPublicId(publicId);
    if (!app || !app.appDeviceKey) return { status: 'not_found' as const };
    if (app.linkedTelegramId && app.linkedTelegramId !== telegramId) return { status: 'linked_elsewhere' as const, app };
    if (app.linkedTelegramId === telegramId) return { status: 'already' as const, app };
    const updated = await this.prisma.user.update({ where: { id: app.id }, data: { linkedTelegramId: telegramId, linkedAt: new Date() } });
    return { status: 'linked' as const, app: updated };
  }

  async listLinkedApps(telegramId: bigint) {
    return this.prisma.user.findMany({ where: { linkedTelegramId: telegramId }, orderBy: { linkedAt: 'desc' } });
  }

  async findByTelegramId(telegramId: bigint) {
    return this.prisma.user.findUnique({ where: { telegramId } });
  }

  async updateTelegramProfileIfExists(profile: TelegramProfile) {
    const user = await this.findByTelegramId(profile.telegramId);
    if (!user) return null;

    return this.prisma.user.update({
      where: { id: user.id },
      data: {
        username: profile.username,
        firstName: profile.firstName,
        lastName: profile.lastName,
        languageCode: profile.languageCode,
        isAdmin: this.isConfiguredAdmin(profile.telegramId),
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id } });
  }

  async setBlocked(userId: string, isBlocked: boolean) {
    return this.prisma.user.update({ where: { id: userId }, data: { isBlocked } });
  }

  async getPreferences(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { preferredLanguage: true, notificationsEnabled: true },
    });
  }

  async updatePreferences(userId: string, data: { preferredLanguage?: 'ru' | 'en'; notificationsEnabled?: boolean }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { preferredLanguage: true, notificationsEnabled: true },
    });
  }

  async isAdminTelegramId(telegramId: bigint, adminIdsCsv: string): Promise<boolean> {
    const ids = adminIdsCsv
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return ids.includes(telegramId.toString());
  }
}
