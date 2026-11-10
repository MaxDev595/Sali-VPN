import { BotUserState } from './services/api-client';
import type { BotPlan, DevicesOverview, IssuedCode, LinkShare, OwnedCode, ReferralStats } from './services/api-client';

export const genericError = 'Сервис временно перезапускается. Повторите команду через несколько секунд.';

export function duration(seconds: number) {
  if (seconds < 60) return 'меньше минуты';
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} мин.`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} ч. ${rest} мин.` : `${hours} ч.`;
}

export function date(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ru-RU', { timeZone: 'UTC' }) : '—';
}

export function accessText(state: BotUserState) {
  if (state.state === 'BLOCKED') return '<b>Sali VPN</b>\n\nДоступ к аккаунту ограничен. Обратитесь в поддержку.';
  if (state.state === 'SUBSCRIPTION_ACTIVE' && state.subscription) {
    return `<b>Sali VPN</b>\n\n🟢 VPN доступен\nТариф: ${state.subscription.plan.name}\nДействует до: ${date(state.subscription.expiresAt)}`;
  }
  if (state.state === 'TRIAL_ACTIVE' && state.trial) {
    return `<b>Sali VPN</b>\n\n🟢 VPN доступен\nТариф: бесплатный\nОсталось: ${duration(state.trial.secondsRemaining)}`;
  }
  if (state.state === 'SUBSCRIPTION_EXPIRED') {
    return '<b>Подписка закончилась</b>\n\nДля продолжения использования Sali VPN необходимо продлить подписку.';
  }
  if (state.state === 'TRIAL_EXPIRED') {
    return '<b>Пробный период закончился</b>\n\nЧтобы продолжить пользоваться Sali VPN, подключите подписку.';
  }
  return '<b>Sali VPN</b>\n\nVPN доступ: неактивен';
}

// ---------------------------------------------------------------------------
// Activation codes & purchases
// ---------------------------------------------------------------------------

export function period(days: number) {
  if (days >= 360) return '1 год';
  if (days >= 28) return `${Math.round(days / 30)} мес.`;
  return `${days} дн.`;
}

export const howItWorks = [
  '<b>Как это работает</b>',
  '',
  '1️⃣ Установите приложение Sali VPN',
  '2️⃣ В приложении нажмите «Привязать Telegram» — мы запомним ваше устройство',
  '3️⃣ Здесь, в боте, получите 24 часа бесплатно или оплатите месяц / год',
  '4️⃣ Бот пришлёт код <code>SALI-XXXX-XXXX-XXXX</code> — введите его в приложении',
  '',
  'Если устройство привязано, код можно активировать одной кнопкой прямо из бота.',
].join('\n');

export function paidCodeMessage(code: IssuedCode) {
  return [
    '✅ <b>Оплата прошла</b>',
    '',
    `Ваш код активации на <b>${period(code.durationDays)}</b>:`,
    `<code>${code.display}</code>`,
    '',
    'Откройте Sali VPN → «Ввести код» и вставьте его.',
    'Нажмите на код, чтобы скопировать. Код одноразовый, действует до ' + date(code.expiresAt) + ' — его можно подарить.',
  ].join('\n');
}

export function freeCodeMessage(code: IssuedCode, again: boolean) {
  return [
    again ? '🎁 <b>Ваш бесплатный код</b> (выдан ранее)' : '🎁 <b>Бесплатный тариф</b>',
    '',
    `<code>${code.display}</code>`,
    '',
    'Даёт <b>24 часа</b> VPN без ограничений, чтобы всё проверить. 24 часа отсчитываются с момента активации кода.',
    'Введите код в приложении Sali VPN → «Ввести код».',
  ].join('\n');
}

export function redeemedMessage(result: { publicId?: string; expiresAt?: string | null; kind?: string; referralBonusHours?: number }) {
  const until = result.expiresAt ? `\nДоступ до: <b>${date(result.expiresAt)}</b>` : '';
  const what = result.kind === 'FREE' ? 'Бесплатные 24 часа включены' : 'Подписка активирована';
  const bonus = result.referralBonusHours ? `\n🎁 +${result.referralBonusHours} часа от друга уже добавлены.` : '';
  return `✅ <b>${what}</b> на устройстве <b>${result.publicId ?? ''}</b>.${until}${bonus}\n\nОткройте приложение и нажмите кнопку подключения.`;
}

export function codesListMessage(codes: OwnedCode[]) {
  if (!codes.length) return '<b>Мои коды</b>\n\nКодов пока нет. Получите бесплатный тариф или купите подписку.';
  const lines = codes.map((code) => {
    const what = code.kind === 'FREE' ? '24 часа бесплатно' : period(code.durationDays);
    if (code.status === 'REDEEMED') return `✅ <s>${code.display}</s> · ${what}\n     активирован на ${code.redeemedOn ?? '—'} ${date(code.redeemedAt)}`;
    return `🟢 <code>${code.display}</code> · ${what}\n     не активирован, действует до ${date(code.expiresAt)}`;
  });
  return ['<b>Мои коды</b>', '', ...lines, '', 'Нажмите на код, чтобы скопировать.'].join('\n');
}

const platformIcon = (p?: string | null) => (p === 'WINDOWS' || p === 'MACOS' ? '💻' : '📱');
const platformName = (p?: string | null) => (p === 'WINDOWS' ? 'ПК (Windows)' : p === 'MACOS' ? 'Mac' : p === 'IOS' ? 'iPhone' : 'Android');
const untilText = (iso: string | null) => (!iso || new Date(iso).getFullYear() > new Date().getFullYear() + 50 ? 'бессрочно' : `до ${date(iso)}`);

export function devicesMessage({ devices, subscription }: DevicesOverview) {
  if (!devices.length) {
    return [
      '<b>Мои устройства</b>',
      '',
      'Пока ни одно устройство не привязано.',
      '',
      'Откройте приложение Sali VPN → «Привязать Telegram». Или просто пришлите сюда ваш Sali ID — он выглядит так: <code>SL-XXXX-XXXX</code>.',
    ].join('\n');
  }
  const head = subscription
    ? [`💎 <b>${subscription.plan}</b> ${untilText(subscription.until)}`, `Работает на <b>${subscription.used} из ${subscription.max}</b> устройств — телефон, ПК, переустановленное приложение.`, '']
    : [];
  const lines = devices.map((device) => {
    const status = device.active
      ? device.until ? `🟢 ${device.tariff} ${untilText(device.until)}${device.shared ? ' · общая подписка' : ''}` : `🟢 ${device.tariff}${device.secondsLeft ? `, осталось ${duration(device.secondsLeft)}` : ''}`
      : subscription ? '⚪️ не входит в подписку — все места заняты' : '⚪️ нет активного тарифа';
    return `${platformIcon(device.platform)} <b>${device.publicId}</b> · ${platformName(device.platform)}\n     ${status}`;
  });
  return ['<b>Мои устройства</b>', '', ...head, ...lines, '', 'Старое или удалённое устройство можно отвязать кнопкой ниже — освободится место.', 'Чтобы добавить новое, откройте в приложении «Привязать Telegram» или пришлите сюда его Sali ID.'].join('\n');
}

export function linkResultMessage(status: string, publicId?: string | null, share?: LinkShare | null) {
  const base = (() => {
    switch (status) {
      case 'linked': return `🔗 <b>Устройство ${publicId} привязано</b>\n\nТеперь коды, напоминания об окончании подписки и ответы поддержки будут приходить сюда.`;
      case 'already': return `Устройство ${publicId} уже привязано к этому Telegram 👌`;
      case 'linked_elsewhere': return 'Это устройство уже привязано к другому Telegram-аккаунту. Если это ошибка — напишите в поддержку.';
      default: return 'Не нашли устройство с таким Sali ID. Проверьте номер в приложении: Аккаунт → Sali ID.';
    }
  })();
  if (!share || (status !== 'linked' && status !== 'already')) return base;
  if (share.covered) {
    return `${base}\n\n✅ <b>Ваша подписка уже работает на нём</b> — ${share.plan} ${untilText(share.until)}.\nУстройств на подписке: ${share.used} из ${share.max}. Откройте приложение и нажмите «Подключить».`;
  }
  return `${base}\n\n⚠️ <b>На подписке уже ${share.max} устройства из ${share.max}.</b>\nЕсли вы переустановили приложение или сменили телефон — отвяжите старое устройство, и подписка сразу заработает здесь 👇`;
}

function money(value: number) {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/** «Купить подписку»: официальная цена зачёркнута, ниже — текущая и, если есть, реферальная скидка. */
export function plansMessage(plans: BotPlan[]) {
  const lines = plans.map((plan) => {
    const old = plan.originalPriceUsd && plan.originalPriceUsd > plan.priceUsd ? `<s>${money(plan.originalPriceUsd)}</s> ` : '';
    const now = plan.discountedPriceUsd
      ? `<s>${money(plan.priceUsd)}</s> <b>${money(plan.discountedPriceUsd)}</b>`
      : `<b>${money(plan.priceUsd)}</b>`;
    const stars = plan.discountedStars ?? plan.stars;
    return `• ${period(plan.durationDays)} — ${old}${now} · ${stars} ⭐`;
  });
  const discount = plans.find((plan) => plan.discountPercent)?.discountPercent;
  return [
    '<b>Подписка Sali VPN</b>',
    '',
    ...lines,
    '',
    '• все серверы и максимальная скорость',
    '• без рекламы и логов',
    '• один код — одно устройство',
    ...(discount ? ['', `🎁 У вас есть реферальная скидка <b>${discount}%</b> — она уже учтена в цене.`] : []),
    '',
    'После оплаты вы получите код — введите его в приложении. Если подписка уже есть, дни добавятся к текущим.',
  ].join('\n');
}

export function referralMessage(stats: ReferralStats) {
  return [
    '<b>Приглашайте друзей в Sali VPN</b>',
    '',
    `• Друг получает <b>+${stats.friendBonusHours} часа</b> VPN бесплатно — сразу после активации первого кода.`,
    `• Вы получаете <b>скидку ${stats.discountPercent}%</b> на следующую оплату за каждого друга.`,
    '',
    `Приглашено: <b>${stats.totalInvited}</b> · бонусов получено: <b>${stats.totalRewarded}</b>`,
    `Скидок ждёт следующей оплаты: <b>${stats.availableDiscounts}</b>`,
    '',
    'Бонус действует только для новых аккаунтов Telegram. Ссылка — в сообщении ниже.',
  ].join('\n');
}

export function referredWelcome(hours: number) {
  return `🎁 <b>Вы пришли по приглашению друга</b>\n\nПосле активации первого кода вы получите <b>+${hours} часа</b> VPN бесплатно.`;
}
