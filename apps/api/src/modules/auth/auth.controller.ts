import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramWebAppLoginDto } from './dto/telegram-webapp-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('telegram-webapp')
  async loginWithTelegramWebApp(@Body() dto: TelegramWebAppLoginDto) {
    return this.auth.loginWithTelegramWebApp(dto.initData);
  }
}
