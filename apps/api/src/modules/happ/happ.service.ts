import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { HappAccess, VpnServer } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { decryptSecret, encryptSecret } from '../vpn/crypto.util';
import { callNode } from '../vpn/nodes/node-client';
import { NodesService } from '../vpn/nodes/nodes.service';
import { NodesProvider } from '../vpn/providers/nodes.provider';

const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const FLAGS: Record<string, string> = {};
const flag = (cc: string) => FLAGS[cc] ??= /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐';
/** Re-push an enabled link to the nodes at most this often (a reinstalled node gets it back). */
const RESYNC_MS = 6 * 3600_000;

export interface HappAccessView {
  /** Subscription URL for Happ (also works in v2rayNG, Hiddify, Streisand…). */
  url: string;
  /** Page that opens Happ with the link (Telegram buttons can't open happ:// directly). */
  openUrl: string;
  enabled: boolean;
  expiresAt: Date | null;
  servers: number;
}

/**
 * Happ and other Xray clients: every Telegram account with a subscription gets one personal
 * subscription link. Behind it is a VLESS + Reality client id (UUID) that the API puts on every
 * node it may use, and switches off everywhere when the subscription ends.
 *
 * Off unless HAPP_ENABLED=true, so it can be tested on the staging environment first.
 */
@Injectable()
export class HappService {
  private readonly logger = new Logger(HappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
    private readonly nodes: NodesProvider,
    private readonly nodesService: NodesService,
  ) {}

  get enabled() {
    return this.config.get<string>('HAPP_ENABLED') === 'true';
  }

  private assertEnabled() {
    if (!this.enabled) throw new NotFoundException('Happ пока недоступен');
  }

  private secret() {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  private urls(token: string) {
    const url = `${this.nodesService.apiUrl()}/api/v1/sub/${token}`;
    return { url, openUrl: `${url}?open=1` };
  }

  /**
   * Access of the Telegram account: a subscription (all servers), or the free 24 hours —
   * started in the bot or in a linked app — on the free servers only.
   */
  private async access(telegramId: bigint): Promise<{ ok: boolean; paid: boolean; sub: { expiresAt: Date | null } | null }> {
    const family = await this.subscriptions.sharing(telegramId);
    const owner = await this.prisma.user.findUnique({ where: { telegramId }, select: { isBlocked: true } });
    if (owner?.isBlocked) return { ok: false, paid: false, sub: null };
    if (family.sub) return { ok: true, paid: true, sub: family.sub };
    const trial = await this.prisma.trial.findFirst({
      where: { status: 'ACTIVE', expiresAt: { gt: new Date() }, user: { OR: [{ telegramId }, { linkedTelegramId: telegramId }] } },
      orderBy: { expiresAt: 'desc' },
    });
    return trial ? { ok: true, paid: false, sub: { expiresAt: trial.expiresAt } } : { ok: false, paid: false, sub: null };
  }

  /** Servers the link lists: active, healthy nodes with Xray (free servers only on the free 24 hours). */
  private servers(paid = true) {
    return this.prisma.vpnServer.findMany({
      where: { isActive: true, online: true, agentUrl: { not: null }, xrayPublicKey: { not: null }, ...(paid ? {} : { premiumOnly: false }) },
      orderBy: [{ countryCode: 'asc' }, { name: 'asc' }],
    });
  }

  /**
   * Puts the account's UUID on (or switches it off on) every node with Xray. On the free
   * 24 hours it is switched on only on the free servers. Best effort.
   */
  private async push(row: HappAccess, enabled: boolean, paid = true) {
    const list = await this.prisma.vpnServer.findMany({ where: { agentUrl: { not: null }, xrayPublicKey: { not: null } } });
    const id = `happ_${row.id.replace(/-/g, '')}`;
    const results = await Promise.allSettled(list.map((s) =>
      callNode(this.nodes.target(s), 'PUT', `/xray/${id}`, { uuid: row.uuid, enabled: enabled && (paid || !s.premiumOnly) }, 6000)));
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed) this.logger.warn(`happ ${row.id}: ${failed}/${list.length} node(s) did not take the change`);
    await this.prisma.happAccess.update({ where: { id: row.id }, data: { enabled, paid, syncedAt: failed ? null : new Date() } });
    return failed === 0;
  }

  /** The nodes were told something else than the account's access now allows. */
  private outOfSync(row: HappAccess, access: { ok: boolean; paid: boolean }) {
    return row.enabled !== access.ok || (access.ok && (row.paid !== access.paid || !row.syncedAt));
  }

  /** Removes the account's UUID from every node (after the link was reset). */
  private async remove(row: Pick<HappAccess, 'id'>) {
    const list = await this.prisma.vpnServer.findMany({ where: { agentUrl: { not: null }, xrayPublicKey: { not: null } } });
    const id = `happ_${row.id.replace(/-/g, '')}`;
    await Promise.allSettled(list.map((s) => callNode(this.nodes.target(s), 'DELETE', `/xray/${id}`, undefined, 6000)));
  }

  private view(row: HappAccess, sub: { expiresAt: Date | null } | null, servers: number): HappAccessView {
    const token = decryptSecret(row.tokenEnc, this.secret());
    return { ...this.urls(token), enabled: row.enabled, expiresAt: sub?.expiresAt ?? null, servers };
  }

  /** Bot «📲 Happ»: the account's link, created on first use. */
  async link(telegramId: number) {
    this.assertEnabled();
    const tg = BigInt(telegramId);
    const access = await this.access(tg);
    if (!access.ok) throw new ForbiddenException('Сейчас нет активного доступа. Возьмите 24 часа бесплатно или оформите подписку — ссылка для Happ появится здесь.');
    let row = await this.prisma.happAccess.findUnique({ where: { telegramId: tg } });
    if (!row) {
      const token = randomBytes(24).toString('base64url');
      row = await this.prisma.happAccess.create({
        data: { telegramId: tg, tokenHash: hash(token), tokenEnc: encryptSecret(token, this.secret()), uuid: randomUUID() },
      });
    }
    const servers = await this.servers(access.paid);
    if (this.outOfSync(row, access)) await this.push(row, true, access.paid);
    row = await this.prisma.happAccess.findUniqueOrThrow({ where: { id: row.id } });
    return this.view(row, access.sub, servers.length);
  }

  /**
   * Bot «⚡ Подключиться»: what the account may use right now and how — the Sali app
   * (how many are linked) and, when Happ is on, the personal Happ link.
   * Works with Happ switched off too (then `happ` is null).
   */
  async connectInfo(telegramId: number) {
    const tg = BigInt(telegramId);
    const access = await this.access(tg);
    const apps = await this.prisma.user.count({ where: { linkedTelegramId: tg, appDeviceKey: { not: null } } });
    const happ = this.enabled && access.ok ? await this.link(telegramId).catch((error) => {
      this.logger.warn(`happ link for connect failed: ${(error as Error).message}`);
      return null;
    }) : null;
    return {
      access: access.ok ? (access.paid ? 'paid' as const : 'free' as const) : 'none' as const,
      until: access.sub?.expiresAt?.toISOString() ?? null,
      apps,
      happ,
    };
  }

  /** Bot «🔄 Сбросить ссылку»: new link and UUID; the old link stops working at once. */
  async rotate(telegramId: number) {
    this.assertEnabled();
    const tg = BigInt(telegramId);
    const old = await this.prisma.happAccess.findUnique({ where: { telegramId: tg } });
    if (old) {
      await this.remove(old);
      await this.prisma.happAccess.delete({ where: { id: old.id } });
    }
    return this.link(telegramId);
  }

  async assertLink(token: string) {
    this.assertEnabled();
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException();
    const row = await this.prisma.happAccess.findUnique({ where: { tokenHash: hash(token) }, select: { id: true, openedAt: true } });
    if (!row) throw new NotFoundException();
    // Funnel report: the customer reached the «Открыть в Happ» page.
    if (!row.openedAt) void this.prisma.happAccess.update({ where: { id: row.id }, data: { openedAt: new Date() } }).catch(() => undefined);
  }

  /**
   * GET /sub/:token — what Happ downloads. With access: one vless:// line per server
   * (base64, the format every Xray client reads). Without: an empty list, so the app
   * shows the expiry instead of failing.
   */
  async subscription(token: string) {
    this.assertEnabled();
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw new NotFoundException();
    const row = await this.prisma.happAccess.findUnique({ where: { tokenHash: hash(token) } });
    if (!row) throw new NotFoundException();
    const access = await this.access(row.telegramId);
    const servers = access.ok ? await this.servers(access.paid) : [];
    const stale = !row.syncedAt || Date.now() - row.syncedAt.getTime() > RESYNC_MS;
    if (this.outOfSync(row, access) || (access.ok && stale)) await this.push(row, access.ok, access.paid);
    void this.prisma.happAccess.update({ where: { id: row.id }, data: { lastFetchAt: new Date() } }).catch(() => undefined);

    const lines = servers.map((s) => this.vless(row.uuid, s));
    const expire = access.sub?.expiresAt ? Math.floor(access.sub.expiresAt.getTime() / 1000) : 0;
    const site = (this.config.get<string>('SITE_URL') || 'https://salivpn.com').replace(/\/$/, '');
    const title = this.config.get<string>('SALI_ENV') === 'staging' ? 'Sali VPN Test' : 'Sali VPN';
    return {
      body: Buffer.from(lines.join('\n')).toString('base64'),
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'profile-title': `base64:${Buffer.from(title).toString('base64')}`,
        'profile-update-interval': '6',
        'subscription-userinfo': `upload=0; download=0; total=0; expire=${expire}`,
        'support-url': this.config.get<string>('SUPPORT_URL') || 'https://t.me/SaliVPNHelpBot',
        'profile-web-page-url': site,
        // Happ: shown under the profile name.
        announce: `base64:${Buffer.from(access.ok ? (access.paid ? 'Sali VPN — приватно и без журналов' : 'Бесплатные 24 часа · подписка — в боте Sali VPN') : 'Доступ закончился — продлите в боте Sali VPN').toString('base64')}`,
      },
    };
  }

  private vless(uuid: string, s: VpnServer) {
    const params = new URLSearchParams({
      encryption: 'none', flow: 'xtls-rprx-vision', security: 'reality', sni: s.xraySni!, fp: 'chrome',
      pbk: s.xrayPublicKey!, sid: s.xrayShortId ?? '', type: 'tcp', headerType: 'none',
    });
    const name = `${flag(s.countryCode)} ${s.city || s.location} · ${s.name.replace(/^Sali /, '')}`;
    return `vless://${uuid}@${s.publicHost}:${s.xrayPort ?? 443}?${params.toString()}#${encodeURIComponent(name)}`;
  }

  /** Opened from the bot: hands the link to Happ, with install links as a fallback. */
  openPage(token: string) {
    this.assertEnabled();
    const { url } = this.urls(token);
    const deep = `happ://add/${url}`;
    const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
    return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Sali VPN → Happ</title>
<style>:root{color-scheme:light dark;--bg:#0b1020;--card:#151b2e;--fg:#e8ecf6;--muted:#9aa4bd;--acc:#5b8cff}
@media (prefers-color-scheme:light){:root{--bg:#f4f6fb;--card:#fff;--fg:#141a2b;--muted:#5d6782}}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;padding:16px;box-sizing:border-box}
main{background:var(--card);border-radius:18px;padding:24px;max-width:420px;width:100%;box-shadow:0 8px 30px #0003}
h1{font-size:22px;margin:0 0 8px}p{color:var(--muted);margin:0 0 16px}
a.b,button{display:block;width:100%;box-sizing:border-box;text-align:center;padding:13px;border-radius:12px;border:0;font:inherit;font-weight:600;text-decoration:none;margin-bottom:10px;cursor:pointer}
.p{background:var(--acc);color:#fff}.s{background:transparent;color:var(--fg);border:1px solid #8884!important}
.row{display:flex;gap:8px}.row a{flex:1;font-size:14px}code{display:block;word-break:break-all;font-size:12px;color:var(--muted);margin-top:6px}</style></head>
<body><main><h1>Подключение в Happ</h1>
<p>Если Happ установлен, он откроется сам и добавит серверы Sali. Не открылся — нажмите кнопку ниже.</p>
<a class="b p" href="${esc(deep)}">Открыть в Happ</a>
<button class="s" id="copy">Скопировать ссылку</button>
<p style="margin-top:16px">Ещё нет Happ? Скачайте:</p>
<div class="row"><a class="b s" href="https://play.google.com/store/apps/details?id=com.happproxy">Android</a><a class="b s" href="https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe">Windows</a></div>
<div class="row"><a class="b s" href="https://apps.apple.com/us/app/happ-proxy-utility/id6504287215">iPhone</a><a class="b s" href="https://apps.apple.com/ru/app/happ-lite/id6799917773">iPhone (РФ)</a></div>
<p style="margin:12px 0 0;font-size:13px">Ссылка личная — не пересылайте её никому. Если она попала к чужим, сбросьте её в боте.</p>
<code id="u">${esc(url)}</code></main>
<script>location.href=${JSON.stringify(deep)};document.getElementById('copy').onclick=function(){navigator.clipboard.writeText(${JSON.stringify(url)}).then(()=>{this.textContent='Скопировано ✓'})}</script>
</body></html>`;
  }

  /** Every 15 min: switch links off on the nodes once the subscription is gone (and back on). */
  @Cron('40 */15 * * * *')
  async sweep() {
    if (!this.enabled) return;
    const rows = await this.prisma.happAccess.findMany();
    for (const row of rows) {
      const access = await this.access(row.telegramId).catch(() => null);
      if (!access) continue;
      if (this.outOfSync(row, access)) await this.push(row, access.ok, access.paid).catch(() => undefined);
    }
  }
}
