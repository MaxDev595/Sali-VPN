import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class SyncTelegramUserDto {
  @IsInt()
  telegramId!: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  languageCode?: string;

  /** Raw /start payload, e.g. "ref_123456789" */
  @IsOptional()
  @IsString()
  startParam?: string;
}

export class TelegramIdParamDto {
  @IsInt()
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
  message!: string;
}
