import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

export interface AuthTokenPayload {
  sub: string; // internal user id
  tid: string; // telegram id (string form of BigInt)
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {}

  async signToken(userId: string, telegramId: string): Promise<string> {
    const payload: AuthTokenPayload = { sub: userId, tid: telegramId };
    return this.jwt.signAsync(payload);
  }

  /** Store app (APK / App Store): no Telegram, the installation key is the identity. */
  async loginApp(deviceKey: string) {
    const user = await this.users.findOrCreateAppUser(deviceKey);
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');
    return { token: await this.signToken(user.id, ''), publicId: user.publicId };
  }

  async loginLocalDevice() {
    if (this.config.get<string>('VPN_MODE') !== 'local') {
      throw new UnauthorizedException('Локальный вход отключён');
    }
    const telegramId = 900000000000000001n;
    const user = await this.users.findOrCreateByTelegramProfile({ telegramId, username: 'local_phone', firstName: 'Local device', languageCode: 'ru' });
    if (user.isBlocked) throw new UnauthorizedException('Аккаунт заблокирован');
    return { token: await this.signToken(user.id, telegramId.toString()) };
  }

}
