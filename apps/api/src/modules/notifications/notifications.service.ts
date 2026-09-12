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
  REFERRAL_REWARD: 'Друг зарегистрировался по вашей ссылке. Вам начислена скидка 10% на следующую оплату.',
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

  /** Welcomes a newly verified Mini App user and reveals the persistent bot menu. */
  async sendWelcome(userId: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return;

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: user.telegramId.toString(),
          text: 'Спасибо, что выбрали Sali VPN!\n\nВаш аккаунт создан. Желаем приятного и безопасного использования!',
          reply_markup: {
            keyboard: [
              [{ text: 'Подключить VPN' }],
              [{ text: 'Моя подписка' }, { text: 'Тарифы' }],
              [{ text: 'Серверы' }, { text: 'Пригласить друга' }],
              [{ text: 'Поддержка' }, { text: 'Настройки' }],
            ],
            resize_keyboard: true,
            is_persistent: true,
          },
        }),
      });
      if (!response.ok) throw new Error(`Telegram returned ${response.status}`);
    } catch (error) {
      this.logger.warn(`Failed to deliver welcome to user=${userId}`, error as Error);
    }
  }

  private async deliver(userId: string, type: NotificationType) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return; // no-op if bot isn't configured (e.g. isolated API tests)

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.notificationsEnabled) return;
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
