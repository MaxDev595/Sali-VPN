import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createHash, randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { encryptSecret } from '../crypto.util';
import { NodesProvider } from '../providers/nodes.provider';
import { callNode, NodeInfo, xrayColumns } from './node-client';

const COUNTRIES: Record<string, [string, string]> = {
  DE: ['Germany', 'Falkenstein'], FI: ['Finland', 'Helsinki'], NL: ['Netherlands', 'Amsterdam'],
  SE: ['Sweden', 'Stockholm'], FR: ['France', 'Paris'], PL: ['Poland', 'Warsaw'], GB: ['United Kingdom', 'London'],
  US: ['United States', 'Ashburn'], SG: ['Singapore', 'Singapore'], TR: ['Turkey', 'Istanbul'], KZ: ['Kazakhstan', 'Almaty'],
  AT: ['Austria', 'Vienna'], CH: ['Switzerland', 'Zurich'], LV: ['Latvia', 'Riga'], EE: ['Estonia', 'Tallinn'],
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

@Injectable()
export class NodesService {
  private readonly logger = new Logger(NodesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly nodes: NodesProvider,
  ) {}

  isAdmin(telegramId: number | bigint | string) {
    return (this.config.get<string>('ADMIN_TELEGRAM_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean).includes(String(telegramId));
  }

  /**
   * Security alert to every admin (ADMIN_TELEGRAM_IDS) about sensitive actions: a server joined the
   * network, a subscription was granted by hand. If someone hijacks an admin account, the other admins
   * (and the owner on another device) see it immediately. Never throws.
   */
  async notifyAdmins(text: string) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const ids = (this.config.get<string>('ADMIN_TELEGRAM_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!token || !ids.length) return;
    await Promise.all(ids.map((chatId) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: `🔐 Безопасность\n\n${text}`, disable_notification: false }),
    }).catch((error) => this.logger.warn(`admin alert to ${chatId} failed: ${(error as Error).message}`))));
  }

  /** Public address of THIS API (the test environment gives its own, so test nodes join the test API). */
  apiUrl() {
    const staging = this.config.get<string>('SALI_ENV') === 'staging' ? this.config.get<string>('RENDER_EXTERNAL_URL') : undefined;
    return (this.config.get<string>('PUBLIC_API_URL') || staging || 'https://api.salivpn.com').replace(/\/$/, '');
  }

  /** One-time install command for a new VPS (valid 24 h). */
  async createEnrollToken(telegramId: number, countryCode: string, city?: string) {
    if (!this.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
    const cc = countryCode.toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) throw new BadRequestException('Страна — двухбуквенный код, например DE');
    const [location, defaultCity] = COUNTRIES[cc] ?? [cc, cc];
    const count = await this.prisma.vpnServer.count({ where: { countryCode: cc, agentUrl: { not: null } } })
      + await this.prisma.nodeEnrollToken.count({ where: { countryCode: cc, usedAt: null, expiresAt: { gt: new Date() } } });
    const name = `Sali ${cc}-${count + 1}`;
    const token = randomBytes(24).toString('base64url');
    await this.prisma.nodeEnrollToken.create({
      data: { tokenHash: hash(token), name, location, countryCode: cc, city: city?.trim() || defaultCity, createdBy: String(telegramId), expiresAt: new Date(Date.now() + 86_400_000) },
    });
    const api = this.apiUrl();
    // install.sh talks to production by default; a test API passes its own address along.
    const env = api === 'https://api.salivpn.com' ? '' : `SALI_API=${api} `;
    return { name, command: `curl -fsSL ${api}/api/v1/nodes/install.sh | ${env}bash -s -- ${token}` };
  }

  /** Called by install.sh on the new server. Verifies the agent before registering it. */
  async enroll(input: { token: string; host: string; hostname?: string; agentPort: number; agentKey: string; certPem: string }) {
    const record = await this.prisma.nodeEnrollToken.findUnique({ where: { tokenHash: hash(input.token) } });
    if (!record || record.usedAt || record.expiresAt < new Date()) throw new ForbiddenException('Токен недействителен или устарел — получите новый командой /addserver');
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(input.host)) throw new BadRequestException('host must be an IPv4 address');

    const agentUrl = `https://${input.host}:${input.agentPort}`;
    let info: NodeInfo;
    try {
      info = await callNode<NodeInfo>({ agentUrl, agentKey: input.agentKey, certPem: input.certPem }, 'GET', '/info', undefined, 10_000);
    } catch (error) {
      throw new BadRequestException(`API не смог достучаться до агента ${agentUrl}: ${(error as Error).message}. Откройте TCP-порт ${input.agentPort} в файрволе.`);
    }
    if (!info.up || !info.tunnels.wg?.publicKey || !info.tunnels.awg?.publicKey) throw new BadRequestException('Туннели на сервере не подняты');

    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const data = {
      location: record.location, countryCode: record.countryCode, city: record.city, hostname: input.hostname,
      publicHost: input.host, publicPort: info.tunnels.wg.port, provider: 'wireguard',
      agentUrl, agentKeyEnc: encryptSecret(input.agentKey, secret), agentCertPem: input.certPem,
      wgPublicKey: info.tunnels.wg.publicKey, awgPublicKey: info.tunnels.awg.publicKey, awgPort: info.tunnels.awg.port,
      awgParams: (info.tunnels.awg.params ?? {}) as Prisma.InputJsonValue, privateDns: info.dns === true,
      ...xrayColumns(info), online: true, lastSeenAt: new Date(),
    };
    const existing = await this.prisma.vpnServer.findFirst({ where: { publicHost: input.host } });
    // A re-install keeps the admin's settings (on/off, free/paid, capacity); only a new server gets defaults.
    const server = existing
      ? await this.prisma.vpnServer.update({ where: { id: existing.id }, data })
      : await this.prisma.vpnServer.create({ data: { name: record.name, ...data, isActive: true, premiumOnly: false, capacity: 2000, pingMs: 40 } });
    void this.notifyAdmins(existing
      ? `🛠 Сервер ${server.name} (${input.host}) переустановлен.`
      : `🆕 Подключён новый сервер ${server.name} (${input.host}).`);
    await this.prisma.nodeEnrollToken.update({ where: { id: record.id }, data: { usedAt: new Date(), serverId: server.id } });
    // Demo rows from the seed (no agent) disappear from the server list once real nodes exist.
    await this.prisma.vpnServer.updateMany({ where: { agentUrl: null, isActive: true }, data: { isActive: false } });
    // Bring back any peers that already lived on this host (re-install).
    if (existing) await this.nodes.info(server.id).catch(() => undefined);
    this.logger.log(`node enrolled: ${server.name} ${input.host}`);
    return { id: server.id, name: server.name };
  }

  /** Live state of every node, for the admin bot command /nodes. */
  async list(telegramId: number) {
    if (!this.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
    const servers = await this.prisma.vpnServer.findMany({ where: { agentUrl: { not: null } }, orderBy: { name: 'asc' } });
    return Promise.all(servers.map(async (s) => {
      const info = await this.nodes.info(s.id).catch(() => null);
      return { name: s.name, host: s.publicHost, country: s.countryCode, active: s.isActive, premiumOnly: s.premiumOnly, online: !!info?.up, users: info?.enabled ?? null, connectedNow: info?.active ?? null, load: info?.load ?? null, happ: info?.xray ? (info.xray.up ? info.xray.users : -1) : null };
    }));
  }

  async setActive(telegramId: number, name: string, isActive: boolean) {
    if (!this.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
    const res = await this.prisma.vpnServer.updateMany({ where: { name, agentUrl: { not: null } }, data: { isActive } });
    return { updated: res.count };
  }

  /** /node_free, /node_paid: who may use the server — everyone, or subscribers only. */
  async setPremium(telegramId: number, name: string, premiumOnly: boolean) {
    if (!this.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
    const res = await this.prisma.vpnServer.updateMany({ where: { name, agentUrl: { not: null } }, data: { premiumOnly } });
    return { updated: res.count };
  }

  /** Every 15 min (with the other sweeps, so Neon can sleep in between): refresh node health. */
  @Cron('20 */15 * * * *')
  async sweep() {
    // Not only in nodes mode: the test environment runs the app on the mock provider
    // while a real test node serves Happ. Without enrolled nodes this finds nothing.
    const servers = await this.prisma.vpnServer.findMany({ where: { agentUrl: { not: null } } });
    for (const s of servers) {
      const info = await this.nodes.info(s.id).catch(() => null);
      await this.prisma.vpnServer.update({
        where: { id: s.id },
        data: info ? { online: info.up, lastSeenAt: new Date(), currentLoad: info.enabled, privateDns: info.dns === true, ...xrayColumns(info) } : { online: false },
      });
      if (!info) this.logger.warn(`node ${s.name} (${s.publicHost}) is not answering`);
    }
  }
}
