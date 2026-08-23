import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class TelegramWebAppLoginDto {
  @IsString()
  @MinLength(10)
  initData!: string;

  @IsOptional()
  @IsString()
  @Matches(/^ref_\d+$/)
  referralCode?: string;
}
