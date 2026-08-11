import { Module } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionsController } from './subscriptions.controller';
import { VpnModule } from '../vpn/vpn.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [VpnModule, NotificationsModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
