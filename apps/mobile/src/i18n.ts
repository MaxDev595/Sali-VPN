import { usePreferencesStore } from './store/preferencesStore';

const dictionary = {
  ru: {
    vpn: 'VPN', locations: 'Локации', devices: 'Устройства', profile: 'Профиль',
    connect: 'Подключить', disconnect: 'Отключить', connecting: 'Подключаемся…', disconnecting: 'Отключаемся…',
    stateOff: 'VPN выключен', stateOn: 'Соединение защищено', stateConnecting: 'Рисуем туннель', stateError: 'Не получилось подключиться',
    tapToConnect: 'Нажмите на знак, чтобы подключиться', tapToDisconnect: 'Нажмите ещё раз, чтобы отключиться',
    enterCode: 'Код', tariff: 'ТАРИФ', location: 'ЛОКАЦИЯ', auto: 'Авто', unknownPing: 'пинг измеряется',
    chooseLocation: 'Выберите, откуда вы будто бы выходите в интернет.', recommended: 'Рекомендуем', needsPlan: 'По подписке', offline: 'Список с сервера не загрузился — показываем основные локации.',
    autoConnect: 'Автоподключение', autoConnectHint: 'Подключаться при открытии приложения', killSwitch: 'Kill Switch', killSwitchHint: 'Блокировать интернет без VPN',
    protocol: 'Протокол', dns: 'DNS', serversHelp: 'Как работают серверы',
    language: 'Язык', russian: 'Русский', english: 'English', notifications: 'Уведомления', selectLanguage: 'Выберите язык',
    help: 'Помощь и поддержка', docs: 'Справочный центр', privacyPolicy: 'Политика конфиденциальности', terms: 'Условия использования', version: 'Версия',
    account: 'АККАУНТ', connection: 'СОЕДИНЕНИЕ', app: 'ПРИЛОЖЕНИЕ', support: 'ПОМОЩЬ',
    faq: 'ЧАСТЫЕ ВОПРОСЫ', writeSupport: 'Написать в поддержку', supportIntro: 'Короткие ответы — ниже. Если не помогло, напишите нам в Telegram: отвечает живой человек.', allArticles: 'Все статьи на сайте',
  },
  en: {
    vpn: 'VPN', locations: 'Locations', devices: 'Devices', profile: 'Profile',
    connect: 'Connect', disconnect: 'Disconnect', connecting: 'Connecting…', disconnecting: 'Disconnecting…',
    stateOff: 'VPN is off', stateOn: 'Connection protected', stateConnecting: 'Drawing the tunnel', stateError: 'Could not connect',
    tapToConnect: 'Tap the mark to connect', tapToDisconnect: 'Tap again to disconnect',
    enterCode: 'Code', tariff: 'PLAN', location: 'LOCATION', auto: 'Auto', unknownPing: 'measuring ping',
    chooseLocation: 'Choose where your traffic appears to come from.', recommended: 'Recommended', needsPlan: 'With a plan', offline: 'Could not load the list — showing the main locations.',
    autoConnect: 'Auto-connect', autoConnectHint: 'Connect when the app opens', killSwitch: 'Kill Switch', killSwitchHint: 'Block the internet without VPN',
    protocol: 'Protocol', dns: 'DNS', serversHelp: 'How servers work',
    language: 'Language', russian: 'Русский', english: 'English', notifications: 'Notifications', selectLanguage: 'Choose language',
    help: 'Help and support', docs: 'Help centre', privacyPolicy: 'Privacy policy', terms: 'Terms of use', version: 'Version',
    account: 'ACCOUNT', connection: 'CONNECTION', app: 'APP', support: 'HELP',
    faq: 'FAQ', writeSupport: 'Message support', supportIntro: 'Quick answers are below. If they don’t help, message us in Telegram — a real person answers.', allArticles: 'All articles on the site',
  },
} as const;

export type Dictionary = { [K in keyof typeof dictionary.ru]: string };

export function useI18n(): { language: 'ru' | 'en'; t: Dictionary } {
  const language = usePreferencesStore(state => state.language);
  return { language, t: dictionary[language] };
}
