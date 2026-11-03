import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { CodesService } from './codes.service';

class RedeemCodeDto {
  @IsString() @Length(12, 40) code!: string;
}

/** The store app's only "billing" endpoint: type the code bought in the bot. */
@Controller('codes')
@UseGuards(JwtAuthGuard)
export class CodesController {
  constructor(private readonly codes: CodesService) {}

  // 60 bits per code + 5 tries/minute per IP makes guessing pointless.
  @Post('redeem')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  redeem(@CurrentUser() user: AuthTokenPayload, @Body() dto: RedeemCodeDto) {
    return this.codes.redeem(user.sub, dto.code);
  }
}
