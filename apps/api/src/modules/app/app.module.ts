import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TrialsModule } from '../trials/trials.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { VpnModule } from '../vpn/vpn.module';
import { AdminBotModule } from '../admin-bot/admin-bot.module';
import { HappModule } from '../happ/happ.module';
import { AppClientController } from './app-client.controller';
import { AppAdminController } from './app-admin.controller';
import { PromoService } from './promo.service';
import { BalanceService } from './balance.service';
import { NotificationsModule } from '../notifications/notifications.module';

/** The customer app's own API: payments, gifts, promo codes, referrals, devices, admin. */
@Module({
  imports: [PaymentsModule, SubscriptionsModule, TrialsModule, ReferralsModule, VpnModule, AdminBotModule, HappModule, NotificationsModule],
  controllers: [AppClientController, AppAdminController],
  providers: [PromoService, BalanceService],
})
export class AppClientModule {}
