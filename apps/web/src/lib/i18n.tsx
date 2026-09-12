import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';

export type Language = 'ru' | 'en';

const messages = {
  ru: {
    home: 'Главная', subscription: 'Подписка', devices: 'Устройства', servers: 'Серверы', settings: 'Настройки',
    myDevices: 'Мои устройства', connectedDevices: 'Подключённые устройства', noDevices: 'Нет подключённых устройств.', active: 'Активно', remove: 'Удалить',
    language: 'Язык', notifications: 'Уведомления', notificationsHint: 'Получать важные сообщения о подписке и VPN', faq: 'Частые вопросы', terms: 'Условия использования', privacy: 'Политика конфиденциальности', invite: 'Пригласить друга',
    free: 'Бесплатный', premium: 'Premium', closest: 'Ближайший', availableWithSubscription: 'Доступен с подпиской', load: 'нагрузка',
    vpnOn: 'VPN активен', vpnOff: 'VPN выключен', connected: 'Подключено', disconnected: 'Нет подключения', connect: 'Подключить VPN', disconnect: 'Отключить', connecting: 'Подключение…', currentSession: 'Текущая сессия', trialLeft: 'Осталось пробного времени:', buy: 'Купить подписку', trialEnded: 'Пробный период закончился', enjoy: 'Приятного пользования!',
  },
  en: {
    home: 'Home', subscription: 'Plan', devices: 'Devices', servers: 'Servers', settings: 'Settings',
    myDevices: 'My devices', connectedDevices: 'Connected devices', noDevices: 'No connected devices.', active: 'Active', remove: 'Remove',
    language: 'Language', notifications: 'Notifications', notificationsHint: 'Receive important subscription and VPN updates', faq: 'FAQ', terms: 'Terms of use', privacy: 'Privacy policy', invite: 'Invite a friend',
    free: 'Free', premium: 'Premium', closest: 'Closest', availableWithSubscription: 'Available with subscription', load: 'load',
    vpnOn: 'VPN is active', vpnOff: 'VPN is off', connected: 'Connected', disconnected: 'Not connected', connect: 'Connect VPN', disconnect: 'Disconnect', connecting: 'Connecting…', currentSession: 'Current session', trialLeft: 'Trial time left:', buy: 'Buy subscription', trialEnded: 'Trial period has ended', enjoy: 'Enjoy your privacy!',
  },
} as const;

type Key = keyof typeof messages.ru;
type I18nValue = { language: Language; setLanguage(language: Language): Promise<void>; t(key: Key): string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => new URLSearchParams(location.search).get('lang') === 'en' || localStorage.getItem('sali-language') === 'en' ? 'en' : 'ru');
  useEffect(() => { void api.getPreferences().then((value) => setLanguageState(value.preferredLanguage)).catch(() => undefined); }, []);
  const value = useMemo<I18nValue>(() => ({
    language,
    async setLanguage(next) {
      setLanguageState(next);
      localStorage.setItem('sali-language', next);
      document.documentElement.lang = next;
      await api.updatePreferences({ preferredLanguage: next });
    },
    t: (key) => messages[language][key],
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('I18nProvider is missing');
  return value;
}
