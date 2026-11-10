import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Announcement, AnnouncementKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NodesService } from '../vpn/nodes/nodes.service';

export type Platform = 'android' | 'windows' | 'all';
export interface AnnouncementDraft {
  kind: AnnouncementKind;
  platform?: Platform;
  version?: string;
  title?: string;
  body: string;
  showInApp: boolean;
}

const PLATFORM_LABEL: Record<Platform, string> = { android: 'Android', windows: 'Windows', all: 'Android и Windows' };
const RELEASES = 'https://github.com/MaxDev595/Sali-VPN/releases/download';
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Update notes and news: the admin writes them in the bot (/admin → 📣 Рассылка),
 * the API sends them to every bot user who allows notifications and serves them
 * to the apps, which show the latest one on the main screen.
 */
@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);
  /** Telegram allows ~30 messages a second per bot; stay well below. */
  private readonly gapMs = 45;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly nodes: NodesService,
  ) {}

  private guard(telegramId: number) {
    if (!this.nodes.isAdmin(telegramId)) throw new ForbiddenException('Только для администратора');
  }

  private links() {
    const site = (this.config.get<string>('SITE_URL') || 'https://salivpn.com').replace(/\/$/, '');
    return {
      page: `${site}/download`,
      apk: this.config.get<string>('APK_DOWNLOAD_URL') || `${RELEASES}/apk-latest/sali-vpn.apk`,
      windows: this.config.get<string>('WINDOWS_DOWNLOAD_URL') || `${RELEASES}/desktop-latest/SaliVPN-Setup.exe`,
      channel: this.config.get<string>('NEWS_CHANNEL_URL') || 'https://t.me/SaliVpnNews',
    };
  }

  /** Exactly what users get in Telegram (also used for the admin's preview). */
  render(a: AnnouncementDraft) {
    const link = this.links();
    const platform = (a.platform ?? 'all') as Platform;
    const head = a.kind === 'UPDATE'
      ? `🆕 <b>Вышло обновление Sali VPN${a.version ? ` ${esc(a.version)}` : ''}</b>\n<i>${PLATFORM_LABEL[platform]}</i>`
      : `📢 <b>${esc(a.title?.trim() || 'Новости Sali VPN')}</b>`;
    const tail = a.kind === 'UPDATE' ? '\n\nОбновление ставится поверх старой версии — код вводить заново не нужно.' : '';
    const html = `${head}\n\n${esc(a.body.trim())}${tail}`;
    const rows: Array<Array<{ text: string; url: string }>> = [];
    if (a.kind === 'UPDATE') {
      const files = [
        ...(platform !== 'windows' ? [{ text: '📱 Скачать для Android', url: link.apk }] : []),
        ...(platform !== 'android' ? [{ text: '💻 Скачать для Windows', url: link.windows }] : []),
      ];
      if (files.length) rows.push(files);
    }
    rows.push([{ text: '📢 Наш канал', url: link.channel }, { text: '🌐 Сайт', url: link.page }]);
    return { html, keyboard: { inline_keyboard: rows } };
  }

  /** Telegram chats that get broadcasts: one per person, notifications on, not blocked. */
  private async chats() {
    const users = await this.prisma.user.findMany({
      where: { isBlocked: false, notificationsEnabled: true, OR: [{ telegramId: { not: null } }, { linkedTelegramId: { not: null } }] },
      select: { telegramId: true, linkedTelegramId: true },
    });
    return [...new Set(users.map((u) => (u.telegramId ?? u.linkedTelegramId)!.toString()))];
  }

  async preview(telegramId: number, draft: AnnouncementDraft) {
    this.guard(telegramId);
    const { html } = this.render(draft);
    return { html, recipients: (await this.chats()).length };
  }

  /** Saves the announcement and starts the broadcast in the background. */
  async publish(telegramId: number, draft: AnnouncementDraft) {
    this.guard(telegramId);
    const author = await this.prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) }, select: { id: true } });
    const chats = await this.chats();
    const row = await this.prisma.announcement.create({
      data: {
        kind: draft.kind,
        platform: draft.kind === 'UPDATE' ? draft.platform ?? 'all' : null,
        version: draft.kind === 'UPDATE' ? draft.version?.trim() || null : null,
        title: draft.kind === 'NEWS' ? draft.title?.trim() || null : null,
        body: draft.body.trim(),
        showInApp: draft.showInApp,
        recipients: chats.length,
        authorId: author?.id ?? null,
      },
    });
    void this.broadcast(row, chats);
    return { id: row.id, recipients: chats.length };
  }

  private async broadcast(row: Announcement, chats: string[]) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const { html, keyboard } = this.render({ ...row, platform: (row.platform ?? undefined) as Platform | undefined, version: row.version ?? undefined, title: row.title ?? undefined });
    let delivered = 0;
    let failed = 0;
    const save = () => this.prisma.announcement.update({ where: { id: row.id }, data: { delivered, failed } }).catch(() => undefined);
    for (const [i, chatId] of chats.entries()) {
      if (!token) { failed++; continue; }
      let ok = false;
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', reply_markup: keyboard, link_preview_options: { is_disabled: true } }),
          });
          if (response.ok) { ok = true; break; }
          if (response.status === 429) {
            const body = await response.json().catch(() => ({})) as { parameters?: { retry_after?: number } };
            await sleep(((body.parameters?.retry_after ?? 3) + 1) * 1000);
            continue;
          }
          break; // 403: the user blocked the bot; 400: chat gone — no point retrying
        } catch { await sleep(1000); }
      }
      if (ok) delivered++; else failed++;
      if (i % 25 === 24) await save();
      await sleep(this.gapMs);
    }
    await this.prisma.announcement.update({ where: { id: row.id }, data: { delivered, failed, finishedAt: new Date() } }).catch(() => undefined);
    this.logger.log(`Announcement ${row.id}: delivered ${delivered}, failed ${failed} of ${chats.length}`);
  }

  async status(telegramId: number, id: string) {
    this.guard(telegramId);
    return this.prisma.announcement.findUniqueOrThrow({ where: { id }, select: { id: true, recipients: true, delivered: true, failed: true, finishedAt: true } });
  }

  async history(telegramId: number) {
    this.guard(telegramId);
    const rows = await this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' }, take: 10 });
    return rows.map((r) => ({ id: r.id, kind: r.kind, version: r.version, title: r.title, platform: r.platform, body: r.body.slice(0, 120), showInApp: r.showInApp, recipients: r.recipients, delivered: r.delivered, failed: r.failed, finished: Boolean(r.finishedAt), createdAt: r.createdAt }));
  }

  /** Hides an announcement in the apps (the Telegram messages stay). */
  async hide(telegramId: number, id: string) {
    this.guard(telegramId);
    await this.prisma.announcement.update({ where: { id }, data: { showInApp: false } });
    return { ok: true };
  }

  /** For the apps: the latest announcements, newest first. Public content — no auth needed. */
  async forApps(platform?: string) {
    const rows = await this.prisma.announcement.findMany({ where: { showInApp: true }, orderBy: { createdAt: 'desc' }, take: 20 });
    return rows
      .filter((r) => !platform || r.kind === 'NEWS' || !r.platform || r.platform === 'all' || r.platform === platform)
      .map((r) => ({
        id: r.id,
        kind: r.kind,
        platform: r.platform,
        version: r.version,
        title: r.kind === 'UPDATE' ? `Обновление Sali VPN${r.version ? ` ${r.version}` : ''}` : r.title || 'Новости Sali VPN',
        body: r.body,
        createdAt: r.createdAt,
      }));
  }
}
