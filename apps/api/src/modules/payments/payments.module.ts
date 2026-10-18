import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PAYMENT_PROVIDER } from './providers/payment-provider.interface';
import { ManualPaymentProvider } from './providers/manual.provider';
import { TelegramStarsPaymentProvider } from './providers/telegram-stars.provider';
import { PaddlePaymentProvider } from './providers/paddle.provider';
import { CryptoPaymentProvider } from './providers/crypto.provider';
import { CryptoWatcherService } from './crypto-watcher.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GooglePlayService } from './google-play.service';

@Module({
  imports: [ConfigModule, SubscriptionsModule, NotificationsModule],
  controllers: [PaymentsController],
  providers: [
    ManualPaymentProvider,
    TelegramStarsPaymentProvider,
    PaddlePaymentProvider,
    CryptoPaymentProvider,
    CryptoWatcherService,
    GooglePlayService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: (
        config: ConfigService,
        manual: ManualPaymentProvider,
        stars: TelegramStarsPaymentProvider,
        paddle: PaddlePaymentProvider,
        crypto: CryptoPaymentProvider,
      ) => {
        const selected = config.get<string>('PAYMENT_PROVIDER', 'manual');
        if (selected === 'telegram_stars') return stars;
        if (selected === 'paddle') return paddle;
        if (selected === 'crypto') return crypto;
        return manual;
      },
      inject: [ConfigService, ManualPaymentProvider, TelegramStarsPaymentProvider, PaddlePaymentProvider, CryptoPaymentProvider],
    },
    PaymentsService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
