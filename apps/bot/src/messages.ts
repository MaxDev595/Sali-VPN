import { BotUserState } from './services/api-client';

export const genericError = 'Что-то пошло не так. Попробуйте ещё раз.';

export const onboarding = [
  '<b>Sali VPN</b>',
  '',
  'Простой и приватный VPN без сложных настроек.',
  '',
  '• приватное подключение',
  '• высокая скорость',
  '• стабильные серверы',
  '• простое подключение',
  '• минимум настроек',
].join('\n');

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
    return `<b>Sali VPN</b>\n\n🟢 VPN доступен\nТариф: Бесплатный\nОсталось: ${duration(state.trial.secondsRemaining)}`;
  }
  if (state.state === 'SUBSCRIPTION_EXPIRED') {
    return '<b>Подписка закончилась</b>\n\nДля продолжения использования Sali VPN необходимо продлить подписку.';
  }
  if (state.state === 'TRIAL_EXPIRED') {
    return '<b>Пробный период закончился</b>\n\nЧтобы продолжить пользоваться Sali VPN, подключите подписку.';
  }
  return '<b>Sali VPN</b>\n\nVPN доступ: неактивен';
}
