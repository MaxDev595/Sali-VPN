import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { ManualPaymentProvider } from './providers/manual.provider';
import { TelegramStarsPaymentProvider } from './providers/telegram-stars.provider';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, SubscriptionsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    ManualPaymentProvider,
    TelegramStarsPaymentProvider,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        config: ConfigService,
        manual: ManualPaymentProvider,
        stars: TelegramStarsPaymentProvider,
      ) => {
        const selected = config.get<string>('PAYMENT_PROVIDER', 'manual');
        if (selected === 'telegram_stars') return stars;
        // 'stripe' would be added here as its own adapter once credentials exist.
        return manual;
      },
      inject: [ConfigService, ManualPaymentProvider, TelegramStarsPaymentProvider],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
