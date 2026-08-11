import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const SUPPORT_CATEGORIES = [
  'vpn_not_connecting',
  'no_internet',
  'payment_issue',
  'device_setup',
  'other',
] as const;

export class CreateSupportTicketDto {
  @IsIn(SUPPORT_CATEGORIES)
  category!: (typeof SUPPORT_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;
}
