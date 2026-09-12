import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyTelegramInitData } from './telegram-init-data.util';
import { UsersService } from '../users/users.service';
import { TrialsService } from '../trials/trials.service';
import { ReferralsService } from '../referrals/referrals.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface AuthTokenPayload {
  sub: string; // internal user id
  tid: string; // telegram id (string form of BigInt)
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly trials: TrialsService,
    private readonly referrals: ReferralsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Validates Telegram Mini App initData server-side and returns an
   * internal JWT the Mini App uses for all subsequent API calls.
   * The bot token never leaves the backend.
   */
  async loginWithTelegramWebApp(initData: string, referralCode?: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Сервис временно недоступен');
    }

    let parsed;
    try {
      parsed = verifyTelegramInitData(initData, botToken);
    } catch {
      throw new UnauthorizedException('Недействительная сессия Telegram');
    }

    const telegramId = BigInt(parsed.user.id);
    const existingUser = await this.users.findByTelegramId(telegramId);
    const user = await this.users.findOrCreateByTelegramProfile({
      telegramId,
      username: parsed.user.username,
      firstName: parsed.user.first_name,
      lastName: parsed.user.last_name,
      languageCode: parsed.user.language_code,
    });

    if (user.isBlocked) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    // A trial is issued only after Telegram has cryptographically proved the
    // user's identity. The unique Trial.userId constraint makes this safe and
    // idempotent across repeated Mini App launches.
    await this.trials.startTrialIfNeeded(user.id);

    if (!existingUser) {
      const effectiveReferralCode = parsed.startParam?.startsWith('ref_') ? parsed.startParam : referralCode;
      if (effectiveReferralCode?.startsWith('ref_')) {
        const referrerTelegramId = BigInt(effectiveReferralCode.replace('ref_', ''));
        const referral = await this.referrals.recordReferralIfNew(user.id, referrerTelegramId);
        if (referral) await this.referrals.rewardIfEligible(user.id);
      }
      await this.notifications.sendWelcome(user.id);
    }

    const token = await this.signToken(user.id, user.telegramId.toString());
    return { token, startParam: parsed.startParam };
  }

  async signToken(userId: string, telegramId: string): Promise<string> {
    const payload: AuthTokenPayload = { sub: userId, tid: telegramId };
    return this.jwt.signAsync(payload);
  }

  async loginLocalDevice() {
    if (this.config.get<string>('VPN_MODE') !== 'local') {
      throw new UnauthorizedException('Локальный вход отключён');
    }
    const telegramId = 900000000000000001n;
    const user = await this.users.findOrCreateByTelegramProfile({ telegramId, username: 'local_phone', firstName: 'Local device', languageCode: 'ru' });
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');
    await this.trials.startTrialIfNeeded(user.id);
    return { token: await this.signToken(user.id, telegramId.toString()) };
  }

}
