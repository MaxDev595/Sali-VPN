import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { verifyTelegramInitData } from './telegram-init-data.util';
import { UsersService } from '../users/users.service';

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
  ) {}

  /**
   * Validates Telegram Mini App initData server-side and returns an
   * internal JWT the Mini App uses for all subsequent API calls.
   * The bot token never leaves the backend.
   */
  async loginWithTelegramWebApp(initData: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Server misconfiguration');
    }

    let parsed;
    try {
      parsed = verifyTelegramInitData(initData, botToken);
    } catch {
      throw new UnauthorizedException('Invalid Telegram session');
    }

    const user = await this.users.findOrCreateByTelegramProfile({
      telegramId: BigInt(parsed.user.id),
      username: parsed.user.username,
      firstName: parsed.user.first_name,
      lastName: parsed.user.last_name,
      languageCode: parsed.user.language_code,
    });

    if (user.isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    const token = await this.signToken(user.id, user.telegramId.toString());
    return { token, startParam: parsed.startParam };
  }

  async signToken(userId: string, telegramId: string): Promise<string> {
    const payload: AuthTokenPayload = { sub: userId, tid: telegramId };
    return this.jwt.signAsync(payload);
  }
}
