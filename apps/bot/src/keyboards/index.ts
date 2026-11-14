import { Context, Markup } from 'telegraf';
import type { BotPlan, IssuedCode } from '../services/api-client';
import { DOC_TOPICS, helpUrl } from '../docs';

export const menuLabels = {
  connect: '⚡ Подключиться',
  buy: '💎 Купить подписку',
  free: '🎁 24 часа бесплатно',
  codes: '💎 Моя подписка',
  devices: '📱 Мои устройства',
  download: '📲 Скачать приложение',
  invite: '👥 Пригласить друга',
  support: '💬 Поддержка',
  docs: '📖 Документация',
  settings: '⚙️ Аккаунт',
  // Labels from the previous menu: still answered so old pinned keyboards keep working.
  legacyVpn: 'Подключить VPN',
  legacySubscription: 'Моя подписка',
  legacyTariffs: 'Тарифы',
  legacyServers: 'Серверы',
  legacyInvite: 'Пригласить друга',
  legacySupport: 'Поддержка',
  legacySettings: 'Настройки',
} as const;

export const mainReplyKeyboard = Markup.keyboard([
  [menuLabels.connect],
  [menuLabels.free, menuLabels.buy],
  [menuLabels.codes, menuLabels.devices],
  [menuLabels.invite, menuLabels.docs],
  [menuLabels.settings, menuLabels.support],
])
  .resize()
  .persistent();

export const mainInlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(menuLabels.connect, 'menu_connect')],
  [Markup.button.callback(menuLabels.free, 'menu_free'), Markup.button.callback(menuLabels.buy, 'menu_buy')],
  [Markup.button.callback(menuLabels.codes, 'menu_codes'), Markup.button.callback(menuLabels.devices, 'menu_devices')],
  [Markup.button.callback(menuLabels.invite, 'menu_invite'), Markup.button.callback(menuLabels.docs, 'menu_docs')],
  [Markup.button.callback(menuLabels.settings, 'menu_settings'), Markup.button.callback(menuLabels.support, 'menu_support')],
]);

export const languageKeyboard = Markup.inlineKeyboard([[
  Markup.button.callback('🇷🇺 Русский', 'language_ru'),
  Markup.button.callback('🇬🇧 English', 'language_en'),
]]);

/** First screen: two taps to a working VPN — «Получить бесплатно» → «Подключиться». */
export function welcomeKeyboard(freeUsed: boolean) {
  return Markup.inlineKeyboard([
    ...(freeUsed ? [] : [[Markup.button.callback('🎁 Получить 24 часа бесплатно', 'menu_free')]]),
    [Markup.button.callback(menuLabels.connect, 'menu_connect')],
    [Markup.button.callback('💎 Купить подписку', 'menu_buy'), Markup.button.callback('🔒 Безопасность', 'doc_security')],
  ]);
}

/** After the free 24 hours were switched on: the one button left. */
export const afterFreeKeyboard = Markup.inlineKeyboard([[Markup.button.callback(menuLabels.connect, 'menu_connect')]]);

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
  return `${period(plan.durationDays)} — ${old && old > price ? `${strike(money(old))} ` : ''}${money(price)} · ${stars} ⭐${perMonth}`;
}

export function plansKeyboard(plans: BotPlan[]) {
  return Markup.inlineKeyboard(plans.map((plan) => [Markup.button.callback(planButtonLabel(plan), `buy_${plan.code}`)]));
}

const METHOD_LABELS = { stars: '⭐ Telegram Stars', crypto: '💵 USDT (сеть TON)', card: '💳 Банковская карта' } as const;
export type PayMethod = keyof typeof METHOD_LABELS;

export function enabledMethods(): PayMethod[] {
  const raw = (process.env.BOT_PAYMENT_METHODS ?? 'stars,crypto').split(',').map((item) => item.trim());
  return raw.filter((item): item is PayMethod => item in METHOD_LABELS);
}

export function methodsKeyboard(planCode: string) {
  return Markup.inlineKeyboard([
    ...enabledMethods().map((method) => [Markup.button.callback(METHOD_LABELS[method], `pay_${method}_${planCode}`)]),
    [Markup.button.callback('← Другой тариф', 'menu_buy')],
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

export function downloadKeyboard() {
  const { apk, windows } = appDownloadUrls();
  return Markup.inlineKeyboard([
    [Markup.button.url('📱 Android (APK)', apk), Markup.button.url('💻 Windows', windows)],
    // Every release is also posted as a file in the news channel — a mirror if GitHub is slow.
    [Markup.button.url('📢 Скачать в нашем канале', process.env.NEWS_CHANNEL_URL || 'https://t.me/SaliVpnNews')],
    [Markup.button.url('📖 Инструкция по установке', process.env.DOWNLOAD_PAGE_URL || 'https://salivpn.com/download')],
  ]);
}

export const faqKeyboard = (supportUrl?: string) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Как это работает?', 'faq_how')],
    [Markup.button.callback('Нужен ли код?', 'faq_code')],
    [Markup.button.callback('Как войти в приложение?', 'faq_link')],
    [Markup.button.callback('VPN не подключается', 'faq_not_connecting')],
    [Markup.button.callback('Проблемы с оплатой', 'faq_payment')],
    [Markup.button.callback('📖 Вся документация', 'menu_docs')],
    ...(supportUrl ? [[Markup.button.url('💬 Написать в поддержку', supportUrl)]] : []),
  ]);

export const supportKeyboard = (supportUrl: string) =>
  Markup.inlineKeyboard([
    [Markup.button.url('💬 Написать в поддержку', supportUrl)],
  ]);

/** Documentation index: two topics per row. */
export function docsKeyboard(siteUrl: string) {
  const rows = [];
  for (let i = 0; i < DOC_TOPICS.length; i += 2) {
    rows.push(DOC_TOPICS.slice(i, i + 2).map((topic) => Markup.button.callback(topic.button, `doc_${topic.slug}`)));
  }
  rows.push([Markup.button.url('🌐 Справочный центр на сайте', helpUrl(siteUrl))]);
  return Markup.inlineKeyboard(rows);
}

export function docTopicKeyboard(siteUrl: string, slug: string) {
  return Markup.inlineKeyboard([
    [Markup.button.url('Подробнее на сайте →', helpUrl(siteUrl, slug))],
    [Markup.button.callback('← Все разделы', 'menu_docs')],
  ]);
}

export function accountKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(menuLabels.codes, 'menu_codes'), Markup.button.callback(menuLabels.devices, 'menu_devices')],
    [Markup.button.callback(menuLabels.buy, 'menu_buy')],
  ]);
}

export function referralShareKeyboard(link: string, shareText: string) {
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(shareText)}`;
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Скопировать ссылку', copy_text: { text: link } }],
        [{ text: 'Поделиться', url: shareUrl }],
      ],
    },
  };
}

/** Access ended: buying happens here in the bot. */
export function expiredAccessKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💎 Купить подписку', 'menu_buy')],
    [Markup.button.callback(menuLabels.download, 'menu_download')],
  ]);
}

export function accessKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback(menuLabels.devices, 'menu_devices'), Markup.button.callback(menuLabels.download, 'menu_download')],
  ]);
}
