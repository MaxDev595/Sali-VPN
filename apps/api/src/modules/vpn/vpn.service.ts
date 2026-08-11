import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { VPN_PROVIDER, VPNProvider } from './providers/vpn-provider.interface';
import { encryptSecret, decryptSecret } from './crypto.util';
import { VpnAccountStatus } from '@prisma/client';

@Injectable()
export class VpnService {
  private readonly logger = new Logger(VpnService.name);

  constructor(
    @Inject(VPN_PROVIDER) private readonly provider: VPNProvider,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** Picks the least-loaded active server. MVP: single server is fine too. */
  private async pickServer() {
    return this.prisma.vpnServer.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { currentLoad: 'asc' },
    });
  }

  private async assertServerOnline(serverId: string) {
    const status = await this.provider.getServerStatus(serverId).catch(() => null);
    if (!status?.isOnline) {
      throw new ServiceUnavailableException('Не удалось подключиться к VPN-серверу. Попробуйте позже.');
    }
  }

  /**
   * Creates (or returns the existing) VPN account for a user. Called once,
   * the very first time a user hits "Connect VPN" — this is also what starts
   * the free trial (see TrialsService).
   */
  async ensureAccountForUser(userId: string) {
    const existing = await this.prisma.vpnAccount.findUnique({ where: { userId } });
    if (existing) return existing;

    const server = await this.pickServer();
    await this.assertServerOnline(server.id);
    const created = await this.provider.createUser({ userId, serverId: server.id });

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const account = await this.prisma.vpnAccount.create({
      data: {
        userId,
        serverId: server.id,
        provider: this.provider.name,
        externalId: created.externalId,
        publicKey: created.publicKey,
        privateKeyEncrypted: encryptSecret(created.privateKey, secret),
        allocatedIp: created.allocatedIp,
        status: VpnAccountStatus.ACTIVE,
      },
    });

    await this.prisma.vpnServer.update({
      where: { id: server.id },
      data: { currentLoad: { increment: 1 } },
    });

    return account;
  }

  async getConnectionConfig(userId: string) {
    const account = await this.prisma.vpnAccount.findUniqueOrThrow({ where: { userId } });
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const privateKey = decryptSecret(account.privateKeyEncrypted, secret);

    const config = await this.provider.generateConfig({
      privateKey,
      allocatedIp: account.allocatedIp,
      serverId: account.serverId,
    });

    const qrCodeDataUrl = await QRCode.toDataURL(config.configText);
    return { ...config, qrCodeDataUrl };
  }

  async disable(userId: string) {
    const account = await this.prisma.vpnAccount.findUniqueOrThrow({ where: { userId } });
    await this.provider.disableUser(account.externalId, account.serverId);
    return this.prisma.vpnAccount.update({
      where: { userId },
      data: { status: VpnAccountStatus.DISABLED },
    });
  }

  async enable(userId: string) {
    const account = await this.prisma.vpnAccount.findUniqueOrThrow({ where: { userId } });
    await this.assertServerOnline(account.serverId);
    await this.provider.enableUser(account.externalId, account.serverId);
    const confirmed = await this.provider.getUser(account.externalId, account.serverId);
    if (!confirmed?.isEnabled) {
      throw new ServiceUnavailableException('VPN-сервер не подтвердил подключение.');
    }
    return this.prisma.vpnAccount.update({
      where: { userId },
      data: { status: VpnAccountStatus.ACTIVE },
    });
  }

  async getAccountWithServer(userId: string) {
    return this.prisma.vpnAccount.findUnique({
      where: { userId },
      include: { server: true },
    });
  }
}
