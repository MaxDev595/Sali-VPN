import { Body, Controller, Get, Header, Post, Query, UseGuards } from '@nestjs/common';
import { AnnouncementKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { InternalServiceGuard } from '../../common/guards/internal-service.guard';
import { AnnouncementsService, type Platform } from './announcements.service';

class AdminDto { @IsInt() telegramId!: number; }
class DraftDto extends AdminDto {
  @IsEnum(AnnouncementKind) kind!: AnnouncementKind;
  @IsOptional() @IsIn(['android', 'windows', 'all']) platform?: Platform;
  @IsOptional() @IsString() @MaxLength(20) version?: string;
  @IsOptional() @IsString() @MaxLength(80) title?: string;
  @IsString() @Length(1, 3500) body!: string;
  @IsOptional() @IsBoolean() showInApp?: boolean;
}
class IdDto extends AdminDto { @IsString() @MaxLength(40) id!: string; }

/** For the apps: what's new (shown on the main screen). */
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @Header('cache-control', 'public, max-age=60')
  list(@Query('platform') platform?: string) {
    return this.announcements.forApps(platform === 'android' || platform === 'windows' ? platform : undefined);
  }
}

/** Bot admin panel: 📣 Рассылка. */
@Controller('internal/bot/admin/announce')
@UseGuards(InternalServiceGuard)
export class AnnouncementsBotController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Post('preview') preview(@Body() b: DraftDto) { return this.announcements.preview(b.telegramId, { ...b, showInApp: b.showInApp ?? true }); }
  @Post('publish') publish(@Body() b: DraftDto) { return this.announcements.publish(b.telegramId, { ...b, showInApp: b.showInApp ?? true }); }
  @Post('status') status(@Body() b: IdDto) { return this.announcements.status(b.telegramId, b.id); }
  @Post('history') history(@Body() b: AdminDto) { return this.announcements.history(b.telegramId); }
  @Post('hide') hide(@Body() b: IdDto) { return this.announcements.hide(b.telegramId, b.id); }
}
