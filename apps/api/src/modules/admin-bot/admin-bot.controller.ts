import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { AdminBotService, FOREVER_DAYS, type PeopleSegment } from './admin-bot.service';

class AdminDto { @IsInt() telegramId!: number; }
class LookupDto extends AdminDto { @IsString() @MaxLength(80) query!: string; }
class UserDto extends AdminDto { @IsString() @MaxLength(40) userId!: string; }
class GrantDto extends UserDto {
  @IsInt() @Min(1) @Max(FOREVER_DAYS) days!: number;
  @IsIn(['admin', 'gift']) kind!: 'admin' | 'gift';
  @IsOptional() @IsString() @MaxLength(700) message?: string;
}
class RevokeSubDto extends AdminDto { @IsString() @MaxLength(40) subscriptionId!: string; @IsOptional() @IsBoolean() notify?: boolean; }
class RevokeCodeDto extends AdminDto { @IsString() @MaxLength(40) codeId!: string; }
class BlockDto extends UserDto { @IsBoolean() isBlocked!: boolean; }
class PeopleDto extends AdminDto {
  @IsIn(['paid', 'granted', 'trial', 'expired']) segment!: PeopleSegment;
  @IsOptional() @IsInt() @Min(0) @Max(10_000) page?: number;
}

/** Bot admin panel (/admin). Every call re-checks ADMIN_TELEGRAM_IDS. */
@Controller('internal/bot/admin')
@UseGuards(InternalServiceGuard)
export class AdminBotController {
  constructor(private readonly admin: AdminBotService) {}

  @Post('lookup') lookup(@Body() b: LookupDto) { return this.admin.lookup(b.telegramId, b.query); }
  @Post('grant') grant(@Body() b: GrantDto) { return this.admin.grant(b.telegramId, b.userId, b.days, b.kind, b.message); }
  @Post('revoke') revoke(@Body() b: UserDto) { return this.admin.revoke(b.telegramId, b.userId); }
  @Post('revocable') revocable(@Body() b: UserDto) { return this.admin.revocable(b.telegramId, b.userId); }
  @Post('revoke-sub') revokeSub(@Body() b: RevokeSubDto) { return this.admin.revokeSubscription(b.telegramId, b.subscriptionId, b.notify ?? false); }
  @Post('revoke-code') revokeCode(@Body() b: RevokeCodeDto) { return this.admin.revokeCode(b.telegramId, b.codeId); }
  @Post('block') block(@Body() b: BlockDto) { return this.admin.setBlocked(b.telegramId, b.userId, b.isBlocked); }
  @Post('issued') issued(@Body() b: AdminDto) { return this.admin.issued(b.telegramId); }
  @Post('stats') stats(@Body() b: AdminDto) { return this.admin.stats(b.telegramId); }
  @Post('people') people(@Body() b: PeopleDto) { return this.admin.people(b.telegramId, b.segment, b.page ?? 0); }
}
