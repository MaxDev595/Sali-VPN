import { Context, Markup } from 'telegraf';
import type { BotPlan, IssuedCode } from '../services/api-client';

export const menuLabels = {
  buy: '💎 Купить подписку',
  free: '🎁 Бесплатный тариф',
  codes: '🔑 Мои коды',
  devices: '📱 Мои устройства',
  download: '📲 Скачать приложение',
  invite: '👥 Пригласить друга',
  support: '💬 Поддержка',
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
  [menuLabels.buy],
  [menuLabels.free, menuLabels.codes],
  [menuLabels.devices, menuLabels.download],
  [menuLabels.invite, menuLabels.support],
  [menuLabels.settings],
])
  .resize()
  .persistent();

export const mainInlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(menuLabels.buy, 'menu_buy')],
  [Markup.button.callback(menuLabels.free, 'menu_free'), Markup.button.callback(menuLabels.codes, 'menu_codes')],
  [Markup.button.callback(menuLabels.devices, 'menu_devices'), Markup.button.callback(menuLabels.download, 'menu_download')],
  [Markup.button.callback(menuLabels.invite, 'menu_invite'), Markup.button.callback(menuLabels.support, 'menu_support')],
]);

export const languageKeyboard = Markup.inlineKeyboard([[
  Markup.button.callback('🇷🇺 Русский', 'language_ru'),
  Markup.button.callback('🇬🇧 English', 'language_en'),
]]);

export function openAppKeyboard(url: string, label = '⚡ Открыть Sali VPN') {
  return Markup.inlineKeyboard([[Markup.button.webApp(label, url)]]);
}

export function welcomeKeyboard(freeUsed: boolean) {
  return Markup.inlineKeyboard([
    ...(freeUsed ? [] : [[Markup.button.callback('🎁 Получить бесплатный тариф', 'menu_free')]]),
    [Markup.button.callback('💎 Купить подписку', 'menu_buy')],
    [Markup.button.callback('📲 Скачать приложение', 'menu_download')],
  ]);
}

function period(days: number) {
  return days >= 360 ? '1 год' : days >= 28 ? `${Math.round(days / 30)} мес.` : `${days} дн.`;
}

export function plansKeyboard(plans: BotPlan[]) {
  const monthly = plans.find((plan) => plan.durationDays < 60);
  return Markup.inlineKeyboard(plans.map((plan) => {
    const perMonth = plan.durationDays >= 360 ? ` · $${(plan.priceUsd / 12).toFixed(2)}/мес` : '';
    const saving = monthly && plan !== monthly ? Math.round((1 - plan.priceUsd / (monthly.priceUsd * Math.round(plan.durationDays / 30.4))) * 100) : 0;
    return [Markup.button.callback(`${period(plan.durationDays)} — $${plan.priceUsd} · ${plan.stars} ⭐${perMonth}${saving > 0 ? ` (−${saving}%)` : ''}`, `buy_${plan.code}`)];
  }));
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

export function downloadKeyboard() {
  const rows = [
    ...(process.env.ANDROID_STORE_URL ? [[Markup.button.url('🤖 Google Play', process.env.ANDROID_STORE_URL)]] : []),
    ...(process.env.IOS_STORE_URL ? [[Markup.button.url('🍏 App Store', process.env.IOS_STORE_URL)]] : []),
    ...(process.env.APK_DOWNLOAD_URL ? [[Markup.button.url('⬇️ Скачать APK', process.env.APK_DOWNLOAD_URL)]] : []),
  ];
  return Markup.inlineKeyboard(rows.length ? rows : [[Markup.button.url('🌐 salivpn.com', 'https://salivpn.com')]]);
}

export const faqKeyboard = (supportUrl?: string) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Как это работает?', 'faq_how')],
    [Markup.button.callback('Куда вводить код?', 'faq_code')],
    [Markup.button.callback('Как привязать устройство?', 'faq_link')],
    [Markup.button.callback('VPN не подключается', 'faq_not_connecting')],
    [Markup.button.callback('Проблемы с оплатой', 'faq_payment')],
    ...(supportUrl ? [[Markup.button.url('Связаться с поддержкой', supportUrl)]] : []),
  ]);

export const supportKeyboard = (supportUrl: string) =>
  Markup.inlineKeyboard([
    [Markup.button.url('Связаться с поддержкой', supportUrl)],
  ]);

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

/** Access ended: buying happens here in the bot, the Mini App stays one tap away. */
export function expiredAccessKeyboard(appUrl: string, _subscriptionUrl?: string) {
  return Markup.inlineKeyboard([
    [Markup.button.callback('💎 Купить подписку', 'menu_buy')],
    [Markup.button.webApp('Открыть Sali', appUrl)],
  ]);
}
