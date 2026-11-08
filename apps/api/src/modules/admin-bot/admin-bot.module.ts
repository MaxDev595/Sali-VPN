import { Module } from '@nestjs/common';
import { VpnModule } from '../vpn/vpn.module';
import { CodesModule } from '../codes/codes.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminBotController } from './admin-bot.controller';
import { AdminBotService } from './admin-bot.service';

@Module({
  imports: [VpnModule, CodesModule, SubscriptionsModule, NotificationsModule],
  controllers: [AdminBotController],
  providers: [AdminBotService],
})
export class AdminBotModule {}
