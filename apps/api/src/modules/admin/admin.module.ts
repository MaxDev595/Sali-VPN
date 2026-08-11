import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminGuard } from '../../common/guards/admin.guard';
import { VpnModule } from '../vpn/vpn.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { PaymentsModule } from '../payments/payments.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [VpnModule, SubscriptionsModule, PaymentsModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}
