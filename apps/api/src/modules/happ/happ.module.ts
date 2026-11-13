import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { VpnModule } from '../vpn/vpn.module';
import { HappBotController, HappSubscriptionController } from './happ.controller';
import { HappService } from './happ.service';

/** Happ / Xray (VLESS + Reality) subscription links. Off unless HAPP_ENABLED=true. */
@Module({
  imports: [VpnModule, SubscriptionsModule],
  providers: [HappService],
  controllers: [HappSubscriptionController, HappBotController],
})
export class HappModule {}
