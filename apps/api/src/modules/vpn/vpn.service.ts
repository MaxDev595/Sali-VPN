import { ForbiddenException, Inject, Injectable, Logger, OnApplicationBootstrap, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';
import { VPN_PROVIDER, VPNProvider, VpnProtocol } from './providers/vpn-provider.interface';
import { encryptSecret, decryptSecret, needsReseal } from './crypto.util';
import { wgPublicKeyOf } from './nodes/node-client';
import { VpnAccountStatus } from '@prisma/client';

@Injectable()
export class VpnService implements OnApplicationBootstrap {
  private readonly logger = new Logger(VpnService.name);

  constructor(
    @Inject(VPN_PROVIDER) private readonly provider: VPNProvider,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap() {
    // Runs in the background so a slow database never delays startup.
    void this.resealSecrets().catch((error) => this.logger.error(`re-encryption failed: ${(error as Error).message}`));
  }

  /**
   * Moves secrets encrypted with JWT_SECRET to the dedicated ENCRYPTION_KEY (see crypto.util),
   * so that after this runs JWT_SECRET alone can no longer decrypt any VPN key. Idempotent.
   */
  async resealSecrets() {
    if (!needsReseal('')) return;
    const legacy = this.config.getOrThrow<string>('JWT_SECRET');
    let count = 0;
    const accounts = await this.prisma.vpnAccount.findMany({ select: { id: true, privateKeyEncrypted: true } });
    for (const a of accounts) {
      if (!needsReseal(a.privateKeyEncrypted)) continue;
      const sealed = encryptSecret(decryptSecret(a.privateKeyEncrypted, legacy), legacy);
      await this.prisma.vpnAccount.update({ where: { id: a.id }, data: { privateKeyEncrypted: sealed } });
      count++;
    }
    const servers = await this.prisma.vpnServer.findMany({ where: { agentKeyEnc: { not: null } }, select: { id: true, agentKeyEnc: true } });
    for (const s of servers) {
      if (!s.agentKeyEnc || !needsReseal(s.agentKeyEnc)) continue;
      const sealed = encryptSecret(decryptSecret(s.agentKeyEnc, legacy), legacy);
      await this.prisma.vpnServer.update({ where: { id: s.id }, data: { agentKeyEnc: sealed } });
      count++;
    }
    if (count) this.logger.log(`re-encrypted ${count} secret(s) with ENCRYPTION_KEY`);
  }

  private get nodesMode() {
    return this.config.get<string>('VPN_PROVIDER') === 'nodes';
  }

  /**
   * Least-loaded active server; with Sali nodes only nodes that answered recently.
   * Without a subscription (free tariff) only servers with premiumOnly = false are used.
   */
  private async pickServer(exceptId?: string, paid = true) {
    if (this.nodesMode) {
      const nodes = await this.prisma.vpnServer.findMany({
        where: { isActive: true, agentUrl: { not: null }, ...(paid ? {} : { premiumOnly: false }), ...(exceptId ? { id: { not: exceptId } } : {}) },
        orderBy: [{ online: 'desc' }, { currentLoad: 'asc' }],
      });
      for (const node of nodes) {
        const status = await this.provider.getServerStatus(node.id).catch(() => null);
        if (status?.isOnline) return node;
      }
      throw new ServiceUnavailableException('Все VPN-серверы сейчас недоступны. Попробуйте через минуту.');
    }
    return this.prisma.vpnServer.findFirstOrThrow({
      where: { isActive: true },
      orderBy: { currentLoad: 'asc' },
    });
  }

  /**
   * Moves a user's VPN account to another (healthy) node, keeping their keys, so a dead
   * server or a legacy/demo row never blocks connecting.
   */
  private async moveAccount(userId: string, toServerId?: string, paid = true) {
    const account = await this.prisma.vpnAccount.findUniqueOrThrow({ where: { userId }, include: { server: true } });
    const target = toServerId
      ? await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: toServerId } })
      : await this.pickServer(account.serverId, paid);
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const privateKey = decryptSecret(account.privateKeyEncrypted, secret);
    const keys = { privateKey, publicKey: wgPublicKeyOf(privateKey) };
    const created = await this.provider.createUser({ userId, serverId: target.id, keys });
    if (account.server.agentUrl && account.serverId !== target.id) {
      await this.provider.deleteUser(account.externalId, account.serverId).catch((err) => this.logger.warn(`old peer not removed: ${err.message}`));
    }
    const moved = await this.prisma.vpnAccount.update({
      where: { userId },
      data: { serverId: target.id, externalId: created.externalId, publicKey: created.publicKey, allocatedIp: created.allocatedIp, provider: this.provider.name },
    });
    await this.prisma.vpnServer.update({ where: { id: target.id }, data: { currentLoad: { increment: 1 } } });
    if (account.serverId !== target.id) {
      await this.prisma.vpnServer.updateMany({ where: { id: account.serverId, currentLoad: { gt: 0 } }, data: { currentLoad: { decrement: 1 } } });
    }
    this.logger.log(`moved user ${userId} from ${account.server.name} to ${target.name}`);
    return moved;
  }

  /**
   * In nodes mode: make sure the account sits on a live node it is allowed to use
   * (paid servers only with a subscription), migrating legacy/dead ones.
   */
  async ensureHealthyAccount(userId: string, preferredServerId?: string, paid = true) {
    const account = await this.ensureAccountForUser(userId, paid);
    if (!this.nodesMode) return account;
    const server = await this.prisma.vpnServer.findUniqueOrThrow({ where: { id: account.serverId } });
    if (preferredServerId && preferredServerId !== server.id) {
      const preferred = await this.prisma.vpnServer.findFirst({ where: { id: preferredServerId, isActive: true, agentUrl: { not: null } } });
      if (preferred?.premiumOnly && !paid) throw new ForbiddenException('Эта локация доступна только по подписке. На бесплатном тарифе выберите бесплатный сервер.');
      if (preferred && (await this.provider.getServerStatus(preferred.id)).isOnline) return this.moveAccount(userId, preferred.id, paid);
    }
    if (!server.agentUrl || !server.isActive || (server.premiumOnly && !paid)) return this.moveAccount(userId, undefined, paid);
    const status = await this.provider.getServerStatus(server.id).catch(() => null);
    if (!status?.isOnline) return this.moveAccount(userId, undefined, paid);
    // Re-create the peer if the node lost it (e.g. it was reinstalled).
    const peer = await this.provider.getUser(account.externalId, account.serverId);
    if (!peer) return this.moveAccount(userId, server.id, paid);
    return account;
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
  async ensureAccountForUser(userId: string, paid = true) {
    const existing = await this.prisma.vpnAccount.findUnique({ where: { userId } });
    if (existing) return existing;

    const server = await this.pickServer(undefined, paid);
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

  async getConnectionConfig(userId: string, protocol?: VpnProtocol) {
    const account = await this.prisma.vpnAccount.findUniqueOrThrow({ where: { userId } });
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const privateKey = decryptSecret(account.privateKeyEncrypted, secret);

    const config = await this.provider.generateConfig({
      privateKey,
      allocatedIp: account.allocatedIp,
      serverId: account.serverId,
      protocol,
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
