import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { TelegramWebAppLoginDto } from './dto/telegram-webapp-login.dto';

class AppLoginDto {
  @IsString() @Matches(/^[A-Za-z0-9._:-]{16,128}$/) deviceKey!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram-webapp')
  async loginWithTelegramWebApp(@Body() dto: TelegramWebAppLoginDto) {
    return this.auth.loginWithTelegramWebApp(dto.initData, dto.referralCode);
  }

  @Post('app')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async loginApp(@Body() dto: AppLoginDto) {
    return this.auth.loginApp(dto.deviceKey);
  }

  @Post('local')
  async loginLocalDevice() {
    return this.auth.loginLocalDevice();
  }
}
