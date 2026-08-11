import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { DevicePlatform } from '@prisma/client';

export class AddDeviceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsEnum(DevicePlatform)
  platform!: DevicePlatform;
}
