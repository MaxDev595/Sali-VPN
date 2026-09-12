import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { UsersService } from './users.service';

class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['ru', 'en'])
  preferredLanguage?: 'ru' | 'en';

  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

@Controller('preferences')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  get(@CurrentUser() user: AuthTokenPayload) {
    return this.users.getPreferences(user.sub);
  }

  @Patch()
  update(@CurrentUser() user: AuthTokenPayload, @Body() dto: UpdatePreferencesDto) {
    return this.users.updatePreferences(user.sub, dto);
  }
}
