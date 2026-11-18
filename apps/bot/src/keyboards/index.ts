import { Context, Markup } from 'telegraf';
import type { BotPlan, IssuedCode } from '../services/api-client';
import { DOC_TOPICS, helpUrl } from '../docs';

/**
 * The whole bot is three buttons: connect, subscription, help. Everything else
 * (devices, invites, payments, articles) is one tap inside one of them.
 */
export const menuLabels = {
  connect: '⚡ Подключиться',
  plan: '💎 Подписка',
  help: '❓ Помощь',
} as const;

/** Labels from earlier menus: still answered so old pinned keyboards keep working. */
export const legacyLabels = {
  connect: ['📲 Скачать приложение', 'Подключить VPN'],
  plan: ['💎 Купить подписку', '💎 Моя подписка', '🔑 Мои коды', '⚙️ Аккаунт', 'Моя подписка', 'Тарифы', 'Настройки'],
  free: ['🎁 24 часа бесплатно', '🎁 Попробовать бесплатно — 24 часа', '🎁 Бесплатный день', '🎁 Бесплатный тариф'],
  devices: ['📱 Мои устройства'],
  invite: ['👥 Пригласить друга', 'Пригласить друга'],
  help: ['💬 Поддержка', '📖 Документация', 'Поддержка', 'Серверы'],
};

export const mainReplyKeyboard = Markup.keyboard([
  [menuLabels.connect],
  [menuLabels.plan, menuLabels.help],
])
  .resize()
  .persistent();

export const mainInlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(menuLabels.connect, 'menu_connect')],
  [Markup.button.callback(menuLabels.plan, 'menu_plan'), Markup.button.callback(menuLabels.help, 'menu_help')],
]);

export const FREE_BUTTON = '🎁 Попробовать бесплатно — 3 дня';

/** First screen: exactly one button — try for free, or connect if the free day is used. */
export function welcomeKeyboard(freeUsed: boolean) {
  return Markup.inlineKeyboard([
    [freeUsed ? Markup.button.callback(menuLabels.connect, 'menu_connect') : Markup.button.callback(FREE_BUTTON, 'menu_free')],
  ]);
}

export const connectKeyboard = Markup.inlineKeyboard([[Markup.button.callback(menuLabels.connect, 'menu_connect')]]);

function period(days: number) {
  return days >= 360 ? '1 год' : days >= 28 ? `${Math.round(days / 30)} мес.` : `${days} дн.`;
}

/** "$8" → "$̶8̶": Telegram buttons have no formatting, combining strokes still read as a crossed-out price. */
export function strike(text: string) {
  return [...text].map((char) => `${char}\u0336`).join('');
}

function money(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

export function planButtonLabel(plan: BotPlan) {
  const price = plan.discountedPriceUsd ?? plan.priceUsd;
  const old = plan.discountedPriceUsd ? plan.priceUsd : plan.originalPriceUsd;
  const stars = plan.discountedStars ?? plan.stars;
  const perMonth = plan.durationDays >= 360 ? ` · ${money(Math.round((price / 12) * 100) / 100)}/мес` : '';
  const starsLabel = enabledMethods().includes('stars') ? ` · ${stars} ⭐` : '';
  return `${period(plan.durationDays)} — ${old && old > price ? `${strike(money(old))} ` : ''}${money(price)}${starsLabel}${perMonth}`;
}

export function plansKeyboard(plans: BotPlan[]) {
  return Markup.inlineKeyboard(plans.map((plan) => [Markup.button.callback(planButtonLabel(plan), `buy_${plan.code}`)]));
}

const METHOD_LABELS = { stars: '⭐ Telegram Stars', crypto: '💵 USDT (сеть TON)', card: '💳 Банковская карта' } as const;
export type PayMethod = keyof typeof METHOD_LABELS;

export function enabledMethods(): PayMethod[] {
  const raw = (process.env.BOT_PAYMENT_METHODS ?? 'crypto').split(',').map((item) => item.trim());
  return raw.filter((item): item is PayMethod => item in METHOD_LABELS);
}

export function methodsKeyboard(planCode: string) {
  return Markup.inlineKeyboard([
    ...enabledMethods().map((method) => [Markup.button.callback(METHOD_LABELS[method], `pay_${method}_${planCode}`)]),
    [Markup.button.callback('← Другой тариф', 'menu_plan')],
  ]);
}

export function checkPaymentKeyboard(paymentId: string, payUrl?: string | null, payLabel = 'Оплатить') {
  return Markup.inlineKeyboard([
    ...(payUrl ? [[Markup.button.url(payLabel, payUrl)]] : []),
    [Markup.button.callback('🔄 Я оплатил — проверить', `chk_${paymentId}`)],
  ]);
}

export function codeKeyboard(code: IssuedCode) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Скопировать код', copy_text: { text: code.display } }],
        [{ text: '⚡ Активировать на моём устройстве', callback_data: `apply_${code.code}` }],
      ],
    },
  } as Parameters<Context['reply']>[1]; // copy_text is newer than telegraf's typings
}

export function chooseDeviceKeyboard(code: string, devices: string[]) {
  return Markup.inlineKeyboard(devices.map((publicId) => [Markup.button.callback(`📱 ${publicId}`, `at_${code}_${publicId}`)]));
}

const RELEASES = 'https://github.com/MaxDev595/Sali-VPN/releases/download';

export function appDownloadUrls() {
  return {
    apk: process.env.APK_DOWNLOAD_URL || `${RELEASES}/apk-latest/sali-vpn.apk`,
    windows: process.env.WINDOWS_DOWNLOAD_URL || `${RELEASES}/desktop-latest/SaliVPN-Setup.exe`,
  };
}

/** «💎 Подписка»: the plans as buttons, then devices and invites. */
export function subscriptionKeyboard(plans: BotPlan[]) {
  return Markup.inlineKeyboard([
    ...plans.map((plan) => [Markup.button.callback(planButtonLabel(plan), `buy_${plan.code}`)]),
    [Markup.button.callback('📱 Устройства', 'menu_devices'), Markup.button.callback('👥 Пригласить друга', 'menu_invite')],
  ]);
}

/** «❓ Помощь»: the questions people actually ask, then a human. */
const HELP_TOPICS = ['start', 'troubleshooting', 'devices', 'payments', 'security'] as const;
export function helpKeyboard(supportUrl: string) {
  const topics = HELP_TOPICS.map((slug) => DOC_TOPICS.find((t) => t.slug === slug)).filter((t): t is (typeof DOC_TOPICS)[number] => Boolean(t));
  const buttons = [
    ...topics.map((topic) => Markup.button.callback(topic.button, `doc_${topic.slug}`)),
    Markup.button.url('💬 Написать нам', supportUrl),
  ];
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  return Markup.inlineKeyboard(rows);
}

export function docTopicKeyboard(siteUrl: string, slug: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url('Подробнее на сайте', helpUrl(siteUrl, slug)), Markup.button.callback('← Помощь', 'menu_help')],
  ]);
}

export function referralShareKeyboard(link: string, shareText: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📤 Поделиться', url: shareUrl }, { text: '📋 Скопировать', copy_text: { text: link } }],
      ],
    },
  };
}
