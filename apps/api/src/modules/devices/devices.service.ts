import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { DevicePlatform } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RegisterDeviceDto } from './dto/register-device.dto';

const DEFAULT_MAX_DEVICES_TRIAL = 1;

@Injectable()
export class DevicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  async list(userId: string) {
    const [devices, activeCount, maxDevices] = await Promise.all([
      this.prisma.device.findMany({ where: { userId }, orderBy: { lastActiveAt: 'desc' } }),
      this.prisma.device.count({ where: { userId, isActive: true } }),
      this.getDeviceLimit(userId),
    ]);
    return { devices, activeCount, maxDevices };
  }

  private async getDeviceLimit(userId: string): Promise<number> {
    const activeSub = await this.subscriptions.getActiveForUser(userId);
    return activeSub ? activeSub.plan.maxDevices : DEFAULT_MAX_DEVICES_TRIAL;
  }

  async add(userId: string, name: string, platform: DevicePlatform) {
    const [limit, currentCount] = await Promise.all([
      this.getDeviceLimit(userId),
      this.prisma.device.count({ where: { userId, isActive: true } }),
    ]);

    if (currentCount >= limit) {
      throw new BadRequestException(
        `Достигнут лимит устройств для вашего тарифа (${limit}). Удалите одно из устройств или обновите подписку.`,
      );
    }

    return this.prisma.device.create({
      data: { userId, deviceKey: randomUUID(), name, platform, isActive: true, lastActiveAt: new Date() },
    });
  }

  async registerCurrent(userId: string, dto: RegisterDeviceDto) {
    const existing = await this.prisma.device.findUnique({
      where: { userId_deviceKey: { userId, deviceKey: dto.deviceKey } },
    });

    const shouldActivate = existing?.isActive ?? await Promise.all([
        this.getDeviceLimit(userId),
        this.prisma.device.count({ where: { userId, isActive: true } }),
      ]).then(([limit, currentCount]) => currentCount < limit);

    return this.prisma.device.upsert({
      where: { userId_deviceKey: { userId, deviceKey: dto.deviceKey } },
      create: {
        userId,
        deviceKey: dto.deviceKey,
        name: dto.name,
        platform: dto.platform,
        isActive: shouldActivate,
        lastActiveAt: new Date(),
      },
      update: {
        name: dto.name,
        platform: dto.platform,
        isActive: true,
        lastActiveAt: new Date(),
      },
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
