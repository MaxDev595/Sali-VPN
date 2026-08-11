import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { UsersModule } from '../users/users.module';
import { VpnModule } from '../vpn/vpn.module';
import { TrialsModule } from '../trials/trials.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { PaymentsModule } from '../payments/payments.module';
import { SupportModule } from '../support/support.module';

@Module({
  imports: [
    UsersModule,
    VpnModule,
    TrialsModule,
    SubscriptionsModule,
    ReferralsModule,
    PaymentsModule,
    SupportModule,
  ],
  controllers: [InternalController],
})
export class InternalModule {}
