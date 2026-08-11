import { Markup } from 'telegraf';

export const mainReplyKeyboard = Markup.keyboard([
  ['👤 Моя подписка', '💳 Тариф'],
  ['🎁 Пригласить друга', '🛟 Поддержка'],
  ['⚙️ Настройки'],
]).resize();

export function welcomeInlineKeyboard(miniAppUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🔐 Подключить VPN', miniAppUrl)],
    [Markup.button.callback('⚡ Возможности Sali', 'features')],
  ]);
}

export function buySubscriptionInlineKeyboard(miniAppUrl: string) {
  return Markup.inlineKeyboard([
    [Markup.button.webApp('🔥 Купить подписку — $5/мес', `${miniAppUrl}#/subscription`)],
  ]);
}

export function openAppInlineKeyboard(miniAppUrl: string, label = '📱 Открыть Sali VPN') {
  return Markup.inlineKeyboard([[Markup.button.webApp(label, miniAppUrl)]]);
}

export const supportCategoriesKeyboard = Markup.inlineKeyboard([
  [Markup.button.callback('VPN не подключается', 'support_vpn_not_connecting')],
  [Markup.button.callback('Не работает интернет', 'support_no_internet')],
  [Markup.button.callback('Проблема с оплатой', 'support_payment_issue')],
  [Markup.button.callback('Как подключить устройство?', 'support_device_setup')],
  [Markup.button.callback('Другой вопрос', 'support_other')],
]);
