import { IsString, MinLength } from 'class-validator';

export class TelegramWebAppLoginDto {
  @IsString()
  @MinLength(10)
  initData!: string;
}
