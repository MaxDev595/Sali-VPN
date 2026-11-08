import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { AdminBotService, FOREVER_DAYS } from './admin-bot.service';

class AdminDto { @IsInt() telegramId!: number; }
class LookupDto extends AdminDto { @IsString() @MaxLength(80) query!: string; }
class UserDto extends AdminDto { @IsString() @MaxLength(40) userId!: string; }
class GrantDto extends UserDto {
  @IsInt() @Min(1) @Max(FOREVER_DAYS) days!: number;
  @IsIn(['admin', 'gift']) kind!: 'admin' | 'gift';
  @IsOptional() @IsString() @MaxLength(700) message?: string;
}
class BlockDto extends UserDto { @IsBoolean() isBlocked!: boolean; }

/** Bot admin panel (/admin). Every call re-checks ADMIN_TELEGRAM_IDS. */
@Controller('internal/bot/admin')
@UseGuards(InternalServiceGuard)
export class AdminBotController {
  constructor(private readonly admin: AdminBotService) {}

  @Post('lookup') lookup(@Body() b: LookupDto) { return this.admin.lookup(b.telegramId, b.query); }
  @Post('grant') grant(@Body() b: GrantDto) { return this.admin.grant(b.telegramId, b.userId, b.days, b.kind, b.message); }
  @Post('revoke') revoke(@Body() b: UserDto) { return this.admin.revoke(b.telegramId, b.userId); }
  @Post('block') block(@Body() b: BlockDto) { return this.admin.setBlocked(b.telegramId, b.userId, b.isBlocked); }
  @Post('issued') issued(@Body() b: AdminDto) { return this.admin.issued(b.telegramId); }
  @Post('stats') stats(@Body() b: AdminDto) { return this.admin.stats(b.telegramId); }
}
