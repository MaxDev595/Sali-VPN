import { Module } from '@nestjs/common';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CodesModule } from '../codes/codes.module';
import { AccountsService } from './accounts.service';

@Module({
  imports: [SubscriptionsModule, CodesModule],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
