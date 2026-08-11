import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthTokenPayload } from '../auth/auth.service';
import { PaymentsService } from './payments.service';

class InitiatePurchaseDto {
  @IsUUID()
  planId!: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('purchase')
  purchase(@CurrentUser() user: AuthTokenPayload, @Body() dto: InitiatePurchaseDto) {
    return this.payments.initiatePurchase(user.sub, dto.planId);
  }
}
