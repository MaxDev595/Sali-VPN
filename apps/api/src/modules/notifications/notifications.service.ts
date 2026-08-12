import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationType } from '@prisma/client';

const MESSAGES: Record<NotificationType, string> = {
  TRIAL_EXPIRING_SOON: 'Пробный период скоро закончится. Подписку можно подключить в Sali VPN.',
  TRIAL_EXPIRED:
    'Ваш бесплатный период закончился.\n\nЧтобы продолжить пользоваться Sali VPN, оформите подписку.',
  SUBSCRIPTION_ACTIVATED: 'Подписка Sali VPN активирована.',
  SUBSCRIPTION_EXPIRING_SOON: '⏳ Ваша подписка Sali Pro скоро закончится. Продлите, чтобы остаться на связи.',
  SUBSCRIPTION_EXPIRED: 'Срок действия подписки Sali Pro истёк. VPN отключён.',
  PAYMENT_FAILED: 'Не удалось провести оплату. Попробуйте ещё раз.',
  REFERRAL_REWARD: 'Вам начислен бонус за приглашённого друга.',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Records the notification and attempts immediate delivery via the Bot API. */
  async enqueue(userId: string, type: NotificationType, payload?: Record<string, unknown>) {
    const notification = await this.prisma.notification.create({
      data: { userId, type, payload: payload as any },
    });

    try {
      await this.deliver(userId, type);
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } catch (err) {
      this.logger.warn(`Failed to deliver notification ${type} to user=${userId}`, err as Error);
    }

    return notification;
  }

  private async deliver(userId: string, type: NotificationType) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return; // no-op if bot isn't configured (e.g. isolated API tests)

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const text = MESSAGES[type];

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: user.telegramId.toString(), text }),
    });
    if (!response.ok) {
      throw new Error(`Telegram sendMessage returned ${response.status}`);
    }
  }
}
