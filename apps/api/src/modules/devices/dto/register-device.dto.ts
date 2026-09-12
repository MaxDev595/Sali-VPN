import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class RegisterDeviceDto {
  @IsString()
  @MinLength(16)
  @MaxLength(128)
  deviceKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
