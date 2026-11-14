import type { LandingLanguage } from './i18n';

const env = import.meta.env as Record<string, string | undefined>;
export const PRICES = {
  month: Number(env.VITE_PRICE_MONTH_USD ?? 5),
  monthOld: Number(env.VITE_PRICE_MONTH_OLD_USD ?? 8),
  year: Number(env.VITE_PRICE_YEAR_USD ?? 40),
  yearOld: Number(env.VITE_PRICE_YEAR_OLD_USD ?? 60),
  freeDays: Number(env.VITE_FREE_HOURS ?? 24),
};

export const copy: Record<LandingLanguage, {
  nav: [string, string][]; help: string; openBot: string; download: string; downloadNav: string; dayWord: string; heroBadge: string; heroTitle: [string, string]; heroText: string;
  trust: string[]; howEyebrow: string; howTitle: string; howText: string; steps: [string, string][];
  plansEyebrow: string; plansTitle: string; plansText: string; free: string; freeText: string; freeCta: string;
  month: string; year: string; perMonth: string; best: string; buyCta: string; benefits: string[]; payMethods: string;
  featuresEyebrow: string; featuresTitle: string; features: [string, string, string][];
  securityEyebrow: string; securityTitle: string; securityText: string; security: [string, string, string][]; securityMore: string;
  faqTitle: string; faqs: [string, string][]; ctaTitle: string; ctaText: string; footer: string; privacy: string; terms: string; support: string;
}> = {
  ru: {
    nav: [['how', 'Как это работает'], ['plans', 'Тарифы'], ['features', 'Возможности'], ['security', 'Безопасность'], ['faq', 'Вопросы']], help: 'Справка',
    openBot: 'Открыть бота', download: 'Скачать приложение', downloadNav: 'Скачать', dayWord: 'часа',
    heroBadge: 'Android и Windows · без логов · WireGuard',
    heroTitle: ['Интернет без границ.', 'В одно касание.'],
    heroText: 'Sali VPN — быстрый и спокойный VPN. Установите приложение, войдите через Telegram — и всё работает. Без кодов, регистрации и паролей.',
    trust: ['24 часа бесплатно', 'До 3 устройств на подписку', 'Оплата Stars или USDT'],
    howEyebrow: 'Как это работает', howTitle: 'Три шага — и вы онлайн', howText: 'Ваш аккаунт — это ваш Telegram. Подписка лежит на аккаунте и сама работает во всех ваших приложениях.',
    steps: [
      ['Установите Sali VPN', 'На Android или Windows — со страницы «Скачать». Без форм, почты и паролей.'],
      ['Войдите через Telegram', 'Одна кнопка в приложении, в Telegram — «Запустить». Сразу включаются 24 часа бесплатно.'],
      ['Подключайтесь', 'Подписку покупаете в боте — она сама появляется во всех ваших приложениях. Ничего вводить не нужно.'],
    ],
    plansEyebrow: 'Тарифы', plansTitle: 'Честные цены', plansText: 'Без автосписаний. Подписка на аккаунт — до 3 устройств. Новая покупка добавляет дни к текущей.',
    free: 'Бесплатно', freeText: '24 часа VPN без ограничений — проверьте всё сами', freeCta: 'Получить в боте',
    month: '1 месяц', year: '1 год', perMonth: '/мес', best: 'Выгоднее всего', buyCta: 'Купить в боте',
    benefits: ['Все серверы', 'До 3 устройств', 'Без логов и рекламы'], payMethods: 'Telegram Stars · USDT (TON)',
    featuresEyebrow: 'Возможности', featuresTitle: 'Всё, что нужно. Ничего лишнего.',
    features: [
      ['bolt', 'Быстро', 'WireGuard — современный протокол, который не тормозит и бережёт батарею.'],
      ['shield', 'Приватно', 'Мы не храним историю посещений. Аккаунт — это только Sali ID.'],
      ['globe', 'Несколько стран', 'Нидерланды, Германия, США — и новые локации каждый месяц.'],
      ['devices', 'Телефон и компьютер', 'Android и Windows. Одна подписка — до 3 устройств, переустановка её не сбрасывает.'],
      ['gift', 'Без кодов', 'Купили, получили подарок или бонус — всё само ложится на ваш аккаунт. Ничего копировать и вводить.'],
      ['chat', 'Поддержка в Telegram', 'Пишете в бота — отвечает живой человек.'],
    ],
    securityEyebrow: 'Безопасность', securityTitle: 'Защищено на каждом уровне', securityText: 'От вашего устройства до наших серверов. Детали защиты мы намеренно не публикуем — так атаковать сложнее.',
    security: [
      ['lock', 'Шифрование', 'Весь трафик шифруется современными протоколами — тем же классом защиты, что у банков и мессенджеров.'],
      ['key', 'Ключи под замком', 'У каждого свои ключи доступа. Они хранятся зашифрованными, отдельным ключом.'],
      ['shield', 'Изоляция', 'Пользователи отделены друг от друга: с сервера нельзя добраться до чужого устройства.'],
      ['check', 'Закрытые серверы', 'Вход — только по ключам команды, пароли отключены, подбор блокируется автоматически.'],
      ['clock', 'Ничего на дисках', 'Служебные журналы живут только в памяти и стираются. Украсть историю нельзя — её нет.'],
      ['telegram', 'Аккаунт без пароля', 'Аккаунт — ваш Telegram. Данные карты к нам не попадают, о новых устройствах бот сообщает сразу.'],
    ],
    securityMore: 'Подробнее о безопасности',
    faqTitle: 'Частые вопросы',
    faqs: [
      ['Насколько Sali защищён от взлома?', 'Трафик шифруется современными протоколами, ключи хранятся зашифрованными, пользователи изолированы друг от друга, вход на серверы — только по ключам команды, журналы не пишутся на диск. Детали мы намеренно не раскрываем. Подробнее — в справке, раздел «Безопасность» (salivpn.com/help/security).'],
      ['Почему оплата в Telegram, а не в приложении?', 'Так быстрее и дешевле для вас: доступны Telegram Stars и USDT. После оплаты подписка сразу появляется во всех ваших приложениях.'],
      ['Как войти в приложение?', 'Нажмите «Войти через Telegram», в Telegram — «Запустить». Если бот не ответил, отправьте ему номер устройства SL-XXXX-XXXX — приложение уже скопировало его.'],
      ['Есть приложение для компьютера?', 'Да, для Windows. Скачайте установщик на странице «Скачать» — там же пошаговая инструкция.'],
      ['Что будет, если переустановить приложение?', 'Ничего страшного: войдите через тот же Telegram — подписка на месте, а старая установка уберётся сама.'],
      ['Подписка продлевается автоматически?', 'Нет. За 3 дня до окончания бот напомнит, а новая покупка добавит дни к текущим.'],
      ['Можно ли пользоваться на нескольких устройствах?', 'Да, до 3: телефон, компьютер и ещё одно. Подписка на аккаунте, поэтому работает на всех сразу. Лишние устройства удаляются во вкладке «Устройства».'],
    ],
    ctaTitle: 'Попробуйте 24 часа бесплатно', ctaText: 'Установите приложение и откройте бота — это займёт меньше минуты.',
    footer: 'Простой и приватный VPN.', privacy: 'Конфиденциальность', terms: 'Условия', support: 'Поддержка',
  },
  en: {
    nav: [['how', 'How it works'], ['plans', 'Pricing'], ['features', 'Features'], ['security', 'Security'], ['faq', 'FAQ']], help: 'Help',
    openBot: 'Open the bot', download: 'Get the app', downloadNav: 'Download', dayWord: 'hours',
    heroBadge: 'Android & Windows · no logs · WireGuard',
    heroTitle: ['Internet without borders.', 'In one tap.'],
    heroText: 'Sali VPN is fast and calm. Install the app, sign in with Telegram — and you are online. No codes, no sign-up, no passwords.',
    trust: ['24 hours free', 'Up to 3 devices per plan', 'Pay with Stars or USDT'],
    howEyebrow: 'How it works', howTitle: 'Three steps and you are online', howText: 'Your account is your Telegram. The plan lives on the account and works in all your apps by itself.',
    steps: [
      ['Install Sali VPN', 'On Android or Windows from the Download page. No forms, e-mail or passwords.'],
      ['Sign in with Telegram', 'One button in the app, then "Start" in Telegram. Your free 24 hours start right away.'],
      ['Connect', 'Buy a plan in the bot — it shows up in all your apps by itself. Nothing to type.'],
    ],
    plansEyebrow: 'Pricing', plansTitle: 'Honest prices', plansText: 'No auto-renewals. One plan per account — up to 3 devices. A new purchase adds days on top.',
    free: 'Free', freeText: '24 hours of unlimited VPN to try everything', freeCta: 'Get it in the bot',
    month: '1 month', year: '1 year', perMonth: '/mo', best: 'Best value', buyCta: 'Buy in the bot',
    benefits: ['All servers', 'Up to 3 devices', 'No logs, no ads'], payMethods: 'Telegram Stars · USDT (TON)',
    featuresEyebrow: 'Features', featuresTitle: 'Everything you need. Nothing you don’t.',
    features: [
      ['bolt', 'Fast', 'WireGuard is modern, quick and easy on the battery.'],
      ['shield', 'Private', 'We keep no browsing history. Your account is just a Sali ID.'],
      ['globe', 'Several countries', 'Netherlands, Germany, USA — and new locations every month.'],
      ['devices', 'Phone and computer', 'Android and Windows. One plan — up to 3 devices; reinstalling does not reset it.'],
      ['gift', 'No codes', 'Bought a plan, got a gift or a bonus — it lands on your account by itself. Nothing to copy or type.'],
      ['chat', 'Support in Telegram', 'Message the bot — a real person answers.'],
    ],
    securityEyebrow: 'Security', securityTitle: 'Protected at every level', securityText: 'From your device to our servers. We deliberately keep the details private — it makes attacks harder.',
    security: [
      ['lock', 'Encryption', 'All traffic is encrypted with modern protocols — the same class of protection banks and messengers use.'],
      ['key', 'Keys under lock', 'Everyone has their own access keys. They are stored encrypted, with a separate key.'],
      ['shield', 'Isolation', 'Users are separated from each other: nobody on a server can reach your device.'],
      ['check', 'Locked-down servers', 'Logins only with the team’s keys, passwords off, guessing blocked automatically.'],
      ['clock', 'Nothing on disk', 'Service logs live only in memory and are wiped. There is no history to steal.'],
      ['telegram', 'No password to leak', 'Your account is your Telegram. Card details never reach us; the bot tells you about every new device.'],
    ],
    securityMore: 'More about security',
    faqTitle: 'FAQ',
    faqs: [
      ['How well is Sali protected from hackers?', 'Traffic is encrypted with modern protocols, keys are stored encrypted, users are isolated from each other, servers accept only the team’s keys, and logs are never written to disk. We deliberately keep the details private. More in the Help centre, "Security" (salivpn.com/help/security).'],
      ['Why pay in Telegram instead of the app?', 'It is faster and cheaper for you: Stars and USDT are available. After paying, the plan appears in all your apps at once.'],
      ['How do I sign in?', 'Tap "Sign in with Telegram", then "Start" in Telegram. If the bot stays silent, send it your device number SL-XXXX-XXXX — the app has already copied it.'],
      ['Is there a desktop app?', 'Yes, for Windows. Get the installer on the Download page — step-by-step guide included.'],
      ['What if I reinstall the app?', 'No problem: sign in with the same Telegram — your plan is still there and the old install is removed by itself.'],
      ['Does it renew automatically?', 'No. The bot reminds you 3 days before the end, and a new purchase adds days on top.'],
      ['Can I use several devices?', 'Yes, up to 3: phone, computer and one more. The plan is on your account, so it works on all of them. Remove extra devices in the Devices tab.'],
    ],
    ctaTitle: 'Try it free for 24 hours', ctaText: 'Install the app and open the bot — it takes less than a minute.',
    footer: 'Simple, private VPN.', privacy: 'Privacy', terms: 'Terms', support: 'Support',
  },
};
