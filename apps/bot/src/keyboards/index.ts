import { Markup } from 'telegraf';

export const menuLabels = {
  vpn: '⚡ VPN',
  subscription: '💎 Подписка',
  account: '👤 Аккаунт',
  help: '❓ Помощь',
} as const;

export const mainReplyKeyboard = Markup.keyboard([
  [menuLabels.vpn, menuLabels.subscription],
  [menuLabels.account, menuLabels.help],
])
  .resize()
  .persistent();

export const mainInlineKeyboard = Markup.inlineKeyboard([
  [
    Markup.button.callback(menuLabels.vpn, 'menu_vpn'),
    Markup.button.callback(menuLabels.subscription, 'menu_subscription'),
  ],
  [
    Markup.button.callback(menuLabels.account, 'menu_account'),
    Markup.button.callback(menuLabels.help, 'menu_help'),
  ],
]);

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
