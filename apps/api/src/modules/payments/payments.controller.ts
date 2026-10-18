import { Body, Controller, Get, Headers, Param, Post, RawBodyRequest, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { PaymentsService } from './payments.service';
import { verifyPaddleSignature } from './webhook-signature';

class InitiatePurchaseDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsIn(['paddle', 'crypto', 'telegram_stars', 'manual'])
  provider?: string;
}

class VerifyGooglePlayDto {
  @IsUUID() planId!: string;
  @IsString() @MinLength(3) @MaxLength(200) productId!: string;
  @IsString() @MinLength(10) @MaxLength(4096) purchaseToken!: string;
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private readonly config: ConfigService) {}

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  purchase(@CurrentUser() user: AuthTokenPayload, @Body() dto: InitiatePurchaseDto) {
    return this.payments.initiatePurchase(user.sub, dto.planId, dto.provider);
  }

  @Post('google-play/verify')
  @UseGuards(JwtAuthGuard)
  verifyGooglePlay(@CurrentUser() user: AuthTokenPayload, @Body() dto: VerifyGooglePlayDto) {
    return this.payments.verifyGooglePlay(user.sub, dto.planId, dto.productId, dto.purchaseToken);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  payment(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.payments.getPayment(user.sub, id);
  }

  @Post('subscriptions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser() user: AuthTokenPayload, @Param('id') id: string) {
    return this.payments.cancelSubscription(user.sub, id);
  }


  @Post('webhooks/paddle')
  paddleWebhook(@Req() request: RawBodyRequest<FastifyRequest>, @Headers('paddle-signature') signature = '', @Body() body: any) {
    const secret = this.config.get<string>('PADDLE_WEBHOOK_SECRET');
    if (!secret || !request.rawBody || !verifyPaddleSignature(request.rawBody, signature, secret)) throw new UnauthorizedException('Invalid webhook signature');
    return this.payments.processWebhook('paddle', String(body.event_id), String(body.event_type), body);
  }

}
