import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const MAX_TELEGRAM_ID = Number.MAX_SAFE_INTEGER;

export class SyncTelegramUserDto {
  @IsInt()
  @Min(1)
  @Max(MAX_TELEGRAM_ID)
  telegramId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  languageCode?: string;

  /** Raw /start payload, e.g. "ref_123456789" */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  startParam?: string;
}

export class TelegramIdParamDto {
  @IsInt()
  @Min(1)
  @Max(MAX_TELEGRAM_ID)
  telegramId!: number;
}

export class ConfirmPaymentDto {
  @IsString()
  externalPaymentId!: string;
}

export const INTERNAL_SUPPORT_CATEGORIES = [
  'vpn_not_connecting',
  'no_internet',
  'payment_issue',
  'device_setup',
  'other',
] as const;

export class CreateSupportTicketByTelegramDto {
  @IsInt()
  telegramId!: number;

  @IsIn(INTERNAL_SUPPORT_CATEGORIES)
  category!: (typeof INTERNAL_SUPPORT_CATEGORIES)[number];

  @IsString()
  @MaxLength(2000)
  message!: string;
}
