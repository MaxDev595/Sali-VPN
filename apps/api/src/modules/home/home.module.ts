import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { VpnModule } from '../vpn/vpn.module';
import { TrialsModule } from '../trials/trials.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { DevicesModule } from '../devices/devices.module';

@Module({
  imports: [VpnModule, TrialsModule, SubscriptionsModule, UsersModule, AuthModule, DevicesModule],
  controllers: [HomeController],
})
export class HomeModule {}
