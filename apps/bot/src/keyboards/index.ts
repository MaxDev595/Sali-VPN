import { Markup } from 'telegraf';

export const menuLabels = {
  vpn: 'Подключить VPN',
  subscription: 'Моя подписка',
  tariffs: 'Тарифы',
  servers: 'Серверы',
  invite: 'Пригласить друга',
  support: 'Поддержка',
  settings: 'Настройки',
} as const;

export const mainReplyKeyboard = Markup.keyboard([
  [menuLabels.vpn],
  [menuLabels.subscription, menuLabels.tariffs],
  [menuLabels.servers, menuLabels.invite],
  [menuLabels.support, menuLabels.settings],
])
  .resize()
  .persistent();

export const mainInlineKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback(menuLabels.vpn, 'menu_vpn')],
  [Markup.button.callback(menuLabels.subscription, 'menu_subscription'), Markup.button.callback(menuLabels.tariffs, 'menu_tariffs')],
  [Markup.button.callback(menuLabels.servers, 'menu_servers'), Markup.button.callback(menuLabels.invite, 'menu_invite')],
  [Markup.button.callback(menuLabels.support, 'menu_support'), Markup.button.callback(menuLabels.settings, 'menu_settings')],
]);

export const languageKeyboard = Markup.inlineKeyboard([[
  Markup.button.callback('🇷🇺 Русский', 'language_ru'),
  Markup.button.callback('🇬🇧 English', 'language_en'),
]]);

export function openAppKeyboard(url: string, label = '⚡ Открыть Sali VPN') {
  return Markup.inlineKeyboard([[Markup.button.webApp(label, url)]]);
}

export function expiredAccessKeyboard(appUrl: string, subscriptionUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('💎 Купить подписку', subscriptionUrl)],
    [Markup.button.webApp('Открыть Sali', appUrl)],
  ]);
}

export const faqKeyboard = (supportUrl?: string) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Как подключить VPN?', 'faq_connect')],
    [Markup.button.callback('VPN не подключается', 'faq_not_connecting')],
    [Markup.button.callback('Как сменить сервер?', 'faq_server')],
    [Markup.button.callback('Как купить подписку?', 'faq_buy')],
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
