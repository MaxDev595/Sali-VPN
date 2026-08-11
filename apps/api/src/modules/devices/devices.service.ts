import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DevicePlatform } from '@prisma/client';

const DEFAULT_MAX_DEVICES_TRIAL = 1;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(userId: string) {
    return this.prisma.device.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
  }

  private async getDeviceLimit(userId: string): Promise<number> {
    const activeSub = await this.subscriptions.getActiveForUser(userId);
    return activeSub ? activeSub.plan.maxDevices : DEFAULT_MAX_DEVICES_TRIAL;
  }

  async add(userId: string, name: string, platform: DevicePlatform) {
    const [limit, currentCount] = await Promise.all([
      this.getDeviceLimit(userId),
      this.prisma.device.count({ where: { userId } }),
    ]);

    if (currentCount >= limit) {
      throw new BadRequestException(
        `Достигнут лимит устройств для вашего тарифа (${limit}). Удалите одно из устройств или обновите подписку.`,
      );
    }

    return this.prisma.device.create({
      data: { userId, name, platform, isActive: false },
    });
  }

  async remove(userId: string, deviceId: string) {
    const device = await this.prisma.device.findFirstOrThrow({
      where: { id: deviceId, userId },
    });
    await this.prisma.device.delete({ where: { id: device.id } });
    return { success: true };
  }

  async touchActive(deviceId: string) {
    return this.prisma.device.update({
      where: { id: deviceId },
      data: { isActive: true, lastActiveAt: new Date() },
    });
  }
}
