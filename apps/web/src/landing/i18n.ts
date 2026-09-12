import { useEffect, useState } from 'react';

export type LandingLanguage = 'ru' | 'en';

export function getLandingLanguage(): LandingLanguage {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'ru' || query === 'en') return query;
  const saved = localStorage.getItem('sali-landing-language');
  if (saved === 'ru' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function useLandingLanguage() {
  const [language, setLanguageState] = useState<LandingLanguage>(getLandingLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (next: LandingLanguage) => {
    setLanguageState(next);
    localStorage.setItem('sali-landing-language', next);
    document.documentElement.lang = next;
  };

  return { language, setLanguage };
}

export const landingCopy = {
  ru: {
    nav: ['Возможности', 'Серверы', 'Безопасность', 'Тариф', 'FAQ'], connect: 'Подключить VPN', openTelegram: 'Открыть Telegram',
    heroTitle: 'VPN без лишних сложностей.', heroText: 'Sali VPN — быстрое защищённое подключение с управлением прямо в Telegram. Выбирайте сервер, подключайте устройства и контролируйте подписку без отдельного кабинета.',
    whyTitle: 'Всё необходимое для защищённого подключения.', whyText: 'Технически надёжная основа без сложного интерфейса и неподтверждённых обещаний.',
    features: [['01','Быстрое подключение','Получение доступа и управление VPN без долгой ручной настройки.'],['02','WireGuard','Современный лёгкий протокол для быстрого и стабильного VPN-туннеля.'],['03','Несколько серверов','Переключение между доступными локациями в интерфейсе Sali.'],['04','До 3 устройств','Одна подписка для телефона, компьютера и ещё одного устройства.']],
    howTitle: 'Подключение в три шага.', steps: [['01','Откройте Telegram-бота','Telegram используется как безопасная точка входа. Отдельный логин и пароль не нужны.'],['02','Активируйте доступ','Запустите 60 бесплатных минут или оформите подписку на 30 дней.'],['03','Получите конфигурацию','Выберите сервер, добавьте приватную конфигурацию WireGuard и подключитесь.']],
    serversTitle: 'Доступные VPN-узлы.', serversText: 'Текущие локации из конфигурации Sali. Показанная задержка — ориентир, фактическое значение зависит от вашей сети.', locations: ['Нидерланды','Германия','США'],
    securityTitle: 'Защита без громких обещаний.', securityLead: 'Sali шифрует соединение между устройством и VPN-сервером и заменяет видимый сайтам IP-адрес. VPN повышает приватность, но не делает пользователя абсолютно анонимным.', securityMuted: 'Cookies, входы в аккаунты, отпечаток браузера и информация, которую вы публикуете сами, остаются отдельными способами идентификации.',
    devicesTitle: 'Одна подписка. До трёх устройств.', devicesText: 'Добавляйте, удаляйте и заменяйте устройства прямо в mini app. Sali работает через совместимые клиенты WireGuard.',
    pricingTitle: 'Один понятный тариф.', pricingText: 'Перед оплатой можно проверить подключение: 60 минут фактического VPN-времени бесплатно.', per30: 'за 30 дней', benefits: ['Все доступные серверы','До трёх устройств','Без установленного Sali лимита трафика','Управление через Telegram','Поддержка внутри сервиса'], startFree: 'Начать бесплатно', noRenew: 'Подписка не продлевается без вашего действия.',
    faqTitle: 'Коротко о главном.', faqs: [['Как подключиться?','Откройте Telegram-бота, запустите Sali, выберите сервер и добавьте выданную конфигурацию WireGuard на устройство.'],['На каких устройствах работает Sali?','Подключение через WireGuard доступно на iOS, Android, Windows, macOS и Linux.'],['Сколько устройств можно использовать?','Активная подписка поддерживает до трёх устройств одновременно. Во время бесплатного теста доступно одно устройство.'],['Как выбрать другой сервер?','Откройте раздел «Серверы» в mini app и выберите доступную локацию.'],['Как оплачивается подписка?','Подписка оформляется внутри Telegram. Способ оплаты отображается перед подтверждением.'],['Что произойдёт после окончания подписки?','VPN-доступ будет приостановлен. Продлить подписку можно в mini app.'],['Что делать, если VPN не подключается?','Проверьте интернет и подписку, попробуйте другой сервер или напишите в поддержку.']],
    ctaTitle: 'Подключение начинается в Telegram.', ctaText: 'Откройте Sali VPN, активируйте доступ и получите конфигурацию подключения.', openSali: 'Открыть Sali VPN',
    product: 'ПРОДУКТ', support: 'ПОДДЕРЖКА', legal: 'ДОКУМЕНТЫ', featuresLink: 'Возможности', serversLink: 'Серверы', pricingLink: 'Тариф', supportLink: 'Поддержка', privacy: 'Политика конфиденциальности', terms: 'Условия использования', tagline: 'Защищённое подключение.\nУправление через Telegram.', menuLabel: 'Открыть меню', topLabel: 'Sali VPN — наверх', navLabel: 'Навигация по странице',
  },
  en: {
    nav: ['Features', 'Servers', 'Security', 'Pricing', 'FAQ'], connect: 'Connect VPN', openTelegram: 'Open Telegram',
    heroTitle: 'VPN without the hassle.', heroText: 'Sali VPN is a fast, secure connection managed right in Telegram. Choose a server, connect your devices, and manage your subscription without a separate account portal.',
    whyTitle: 'Everything you need for a secure connection.', whyText: 'A reliable technical foundation without a complicated interface or inflated promises.',
    features: [['01','Quick connection','Get access and manage your VPN without lengthy manual setup.'],['02','WireGuard','A modern, lightweight protocol for a fast and stable VPN tunnel.'],['03','Multiple servers','Switch between available locations in the Sali interface.'],['04','Up to 3 devices','One subscription for your phone, computer, and one more device.']],
    howTitle: 'Connect in three steps.', steps: [['01','Open the Telegram bot','Telegram is your secure entry point. No separate login or password is required.'],['02','Activate access','Start with 60 free minutes or get a 30-day subscription.'],['03','Get your configuration','Choose a server, add your private WireGuard configuration, and connect.']],
    serversTitle: 'Available VPN nodes.', serversText: 'Current locations in the Sali network. Latency is an estimate; the actual result depends on your connection.', locations: ['Netherlands','Germany','United States'],
    securityTitle: 'Security without exaggerated claims.', securityLead: 'Sali encrypts the connection between your device and the VPN server and replaces the IP address visible to websites. A VPN improves privacy but does not make you completely anonymous.', securityMuted: 'Cookies, signed-in accounts, browser fingerprints, and information you share remain separate ways to identify you.',
    devicesTitle: 'One subscription. Up to three devices.', devicesText: 'Add, remove, and replace devices right in the mini app. Sali works with compatible WireGuard clients.',
    pricingTitle: 'One straightforward plan.', pricingText: 'Try the connection before paying: get 60 minutes of actual VPN usage for free.', per30: 'per 30 days', benefits: ['All available servers','Up to three devices','No traffic limit imposed by Sali','Manage through Telegram','In-service support'], startFree: 'Start for free', noRenew: 'Your subscription will not renew without your action.',
    faqTitle: 'The essentials, clearly explained.', faqs: [['How do I connect?','Open the Telegram bot, launch Sali, choose a server, and add the WireGuard configuration to your device.'],['Which devices are supported?','WireGuard connections are available on iOS, Android, Windows, macOS, and Linux.'],['How many devices can I use?','An active subscription supports up to three devices at once. The free trial supports one device.'],['How do I choose another server?','Open Servers in the mini app and select an available location.'],['How do I pay?','Subscriptions are purchased in Telegram. The available payment method appears before confirmation.'],['What happens when my subscription ends?','VPN access is paused. You can renew in the mini app without creating a new account.'],['What if the VPN does not connect?','Check your internet and subscription, try another server, or contact Sali support.']],
    ctaTitle: 'Your connection starts in Telegram.', ctaText: 'Open Sali VPN, activate access, and receive your connection configuration.', openSali: 'Open Sali VPN',
    product: 'PRODUCT', support: 'SUPPORT', legal: 'LEGAL', featuresLink: 'Features', serversLink: 'Servers', pricingLink: 'Pricing', supportLink: 'Support', privacy: 'Privacy Policy', terms: 'Terms of Use', tagline: 'Secure connection.\nManaged through Telegram.', menuLabel: 'Open menu', topLabel: 'Sali VPN — back to top', navLabel: 'Page navigation',
  },
} as const;
