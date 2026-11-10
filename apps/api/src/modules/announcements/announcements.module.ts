import { Module } from '@nestjs/common';
import { VpnModule } from '../vpn/vpn.module';
import { AnnouncementsBotController, AnnouncementsController } from './announcements.controller';
import { AnnouncementsService } from './announcements.service';

@Module({
  imports: [VpnModule],
  controllers: [AnnouncementsController, AnnouncementsBotController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
