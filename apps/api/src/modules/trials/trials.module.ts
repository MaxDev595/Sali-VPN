import { Module } from '@nestjs/common';
import { TrialsService } from './trials.service';
import { VpnModule } from '../vpn/vpn.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [VpnModule, NotificationsModule],
  providers: [TrialsService],
  exports: [TrialsService],
})
export class TrialsModule {}
