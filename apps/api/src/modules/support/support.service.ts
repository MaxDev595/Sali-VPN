import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async createTicket(userId: string, category: string, message: string) {
    const ticket = await this.prisma.supportTicket.create({
      data: { userId, category, message },
    });

    await this.forwardToOperators(userId, category, message).catch((err) =>
      this.logger.warn('Failed to forward support ticket to operator chat', err),
    );

    return ticket;
  }

  /** Forwards new tickets to the admins listed in ADMIN_TELEGRAM_IDS. */
  private async forwardToOperators(userId: string, category: string, message: string) {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const adminIds = (this.config.get<string>('ADMIN_TELEGRAM_IDS') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (!botToken || adminIds.length === 0) return;

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const text = [
      '🛟 Новое обращение в поддержку',
      `От: ${user.username ? '@' + user.username : user.telegramId.toString()}`,
      `Категория: ${category}`,
      `Сообщение: ${message}`,
    ].join('\n');

    await Promise.all(
      adminIds.map((chatId) =>
        fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text }),
        }),
      ),
    );
  }

  async listForUser(userId: string) {
    return this.prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
