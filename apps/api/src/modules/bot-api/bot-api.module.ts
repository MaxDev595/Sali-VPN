import { Module } from '@nestjs/common';
import { BotApiController } from './bot-api.controller';
import { CodesModule } from '../codes/codes.module';
import { PaymentsModule } from '../payments/payments.module';
import { UsersModule } from '../users/users.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TrialsModule } from '../trials/trials.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [CodesModule, PaymentsModule, UsersModule, SubscriptionsModule, TrialsModule, NotificationsModule, ReferralsModule, AccountsModule],
  controllers: [BotApiController],
})
export class BotApiModule {}
