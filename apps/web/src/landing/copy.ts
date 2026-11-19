import type { LandingLanguage } from './i18n';

const env = import.meta.env as Record<string, string | undefined>;
export const PRICES = {
  month: Number(env.VITE_PRICE_MONTH_USD ?? 3),
  monthOld: Number(env.VITE_PRICE_MONTH_OLD_USD ?? 5),
  year: Number(env.VITE_PRICE_YEAR_USD ?? 30),
  yearOld: Number(env.VITE_PRICE_YEAR_OLD_USD ?? 40),
  /** Cheapest tariff in the app (7 days). */
  from: Number(env.VITE_PRICE_FROM_USD ?? 1.2),
  freeDays: Number(env.VITE_FREE_DAYS ?? 3),
};

/** All tariffs, as in the app (API: migration 20261119120000_tariffs). */
export const TARIFFS: Array<{ days: number; price: number; title: { ru: string; en: string }; note: { ru: string; en: string }; main?: boolean }> = [
  { days: 7, price: 1.2, title: { ru: '7 дней', en: '7 days' }, note: { ru: 'Недельное использование', en: 'A week' } },
  { days: 14, price: 2, title: { ru: '14 дней', en: '14 days' }, note: { ru: 'Две недели', en: 'Two weeks' } },
  { days: 30, price: 3, title: { ru: '30 дней', en: '30 days' }, note: { ru: 'Основная подписка', en: 'The main plan' }, main: true },
  { days: 90, price: 8, title: { ru: '90 дней', en: '90 days' }, note: { ru: 'Постоянные пользователи', en: 'For regulars' } },
  { days: 180, price: 15, title: { ru: 'Полгода', en: 'Half a year' }, note: { ru: '6 месяцев', en: '6 months' } },
  { days: 365, price: 30, title: { ru: 'Год', en: 'Year' }, note: { ru: '12 месяцев', en: '12 months' } },
];

export const copy: Record<LandingLanguage, {
  nav: [string, string][]; help: string; openBot: string; download: string; downloadNav: string; dayWord: string; heroBadge: string; heroTitle: [string, string]; heroText: string;
  trust: string[]; howEyebrow: string; howTitle: string; howText: string; steps: [string, string][];
  plansEyebrow: string; plansTitle: string; plansText: string; free: string; freeText: string; freeCta: string;
  month: string; year: string; perMonth: string; best: string; buyCta: string; benefits: string[]; payMethods: string; mainBadge: string; per30: string; saving: string; included: string;
  featuresEyebrow: string; featuresTitle: string; features: [string, string, string][];
  securityEyebrow: string; securityTitle: string; securityText: string; security: [string, string, string][]; securityMore: string;
  faqTitle: string; faqs: [string, string][]; ctaTitle: string; ctaText: string; footer: string; privacy: string; terms: string; support: string;
}> = {
  ru: {
    nav: [['how', 'Как это работает'], ['plans', 'Тарифы'], ['features', 'Возможности'], ['security', 'Безопасность'], ['faq', 'Вопросы']], help: 'Справка',
    openBot: 'Открыть бота', download: 'Скачать приложение', downloadNav: 'Скачать', dayWord: 'дня',
    heroBadge: 'Android и Windows · без логов · WireGuard',
    heroTitle: ['Интернет без границ.', 'В одно касание.'],
    heroText: 'Sali VPN — быстрый и спокойный VPN. Установите приложение и нажмите «Включить» — первые 3 дня бесплатно. Без кодов, регистрации и паролей.',
    trust: ['3 дня бесплатно', 'До 3 устройств на подписку', 'Оплата в USDT'],
    howEyebrow: 'Как это работает', howTitle: 'Три шага — и вы онлайн', howText: 'Всё — в приложении. У аккаунта один Sali ID навсегда, подписка лежит на аккаунте и работает на всех ваших устройствах.',
    steps: [
      ['Установите Sali VPN', 'На Android или Windows — со страницы «Скачать». Без форм, почты и паролей.'],
      ['Нажмите «Включить»', 'И всё — 3 дня бесплатно. Ничего вводить и привязывать не нужно.'],
      ['Оформите подписку', 'Прямо в приложении: выберите тариф и оплатите в USDT. Один раз привяжите Telegram — подписка будет на вашем аккаунте.'],
    ],
    plansEyebrow: 'Тарифы', plansTitle: 'Честные цены', plansText: 'Подписка на аккаунт — до 3 устройств. Новая покупка добавляет дни к текущей, а автопродление с баланса — только если вы сами его включите.',
    free: 'Бесплатно', freeText: '3 дня VPN без ограничений — проверьте всё сами', freeCta: 'Скачать и включить',
    month: '30 дней', year: '1 год', perMonth: '/мес', best: 'Выгоднее всего', buyCta: 'Оформить в приложении', mainBadge: 'Основной', per30: 'за 30 дней', saving: 'экономия', included: 'В каждом тарифе:',
    benefits: ['Быстрая сеть', 'Конфиденциальность превыше всего', 'Все серверы', 'До 3 устройств'], payMethods: 'USDT (TON)',
    featuresEyebrow: 'Возможности', featuresTitle: 'Всё, что нужно. Ничего лишнего.',
    features: [
      ['bolt', 'Быстрая сеть', 'Современный протокол и серверы без перегрузки — видео, игры и звонки без задержек.'],
      ['shield', 'Конфиденциальность превыше всего', 'Не храним историю посещений, не показываем рекламу. Аккаунт — это только Sali ID.'],
      ['globe', 'Несколько стран', 'Нидерланды, Германия, США — и новые локации каждый месяц.'],
      ['devices', 'Телефон и компьютер', 'Android и Windows. Одна подписка — до 3 устройств, переустановка её не сбрасывает.'],
      ['gift', 'Без кодов', 'Купили, получили подарок или бонус — всё само ложится на ваш аккаунт. Ничего копировать и вводить.'],
      ['chat', 'Живая поддержка', 'Пишете нам в Telegram — отвечает живой человек.'],
    ],
    securityEyebrow: 'Безопасность', securityTitle: 'Защищено на каждом уровне', securityText: 'От вашего устройства до наших серверов. Детали защиты мы намеренно не публикуем — так атаковать сложнее.',
    security: [
      ['lock', 'Шифрование', 'Весь трафик шифруется современными протоколами — тем же классом защиты, что у банков и мессенджеров.'],
      ['key', 'Ключи под замком', 'У каждого свои ключи доступа. Они хранятся зашифрованными, отдельным ключом.'],
      ['shield', 'Изоляция', 'Пользователи отделены друг от друга: с сервера нельзя добраться до чужого устройства.'],
      ['check', 'Закрытые серверы', 'Вход — только по ключам команды, пароли отключены, подбор блокируется автоматически.'],
      ['clock', 'Ничего на дисках', 'Служебные журналы живут только в памяти и стираются. Украсть историю нельзя — её нет.'],
      ['telegram', 'Аккаунт без пароля', 'Вход без пароля: аккаунт привязан к вашему Telegram. Данные карты к нам не попадают, о новых устройствах мы сообщаем сразу.'],
    ],
    securityMore: 'Подробнее о безопасности',
    faqTitle: 'Частые вопросы',
    faqs: [
      ['Насколько Sali защищён от взлома?', 'Трафик шифруется современными протоколами, ключи хранятся зашифрованными, пользователи изолированы друг от друга, вход на серверы — только по ключам команды, журналы не пишутся на диск. Детали мы намеренно не раскрываем. Подробнее — в справке, раздел «Безопасность» (salivpn.com/help/security).'],
      ['Как оплатить?', 'В приложении: «Подписка» → тариф. Оплата в USDT (сеть TON) с любого кошелька — Telegram Wallet, Tonkeeper, биржа. Подписка появляется сразу после перевода.'],
      ['Зачем привязывать Telegram?', 'Только для оплаты: так подписка будет на вашем аккаунте, заработает на всех устройствах и не пропадёт при переустановке. Бесплатные 3 дня работают без привязки.'],
      ['Есть баланс и автопродление?', 'Да. Пополните баланс Sali в USDT — тарифы оплачиваются в одно нажатие, а автопродление само продлит подписку за сутки до конца. Без автопродления продлевайте сами: «Баланс» → «Продлить с баланса» → «Списать». Деньги с баланса тратятся только на Sali VPN и не выводятся; возврат — через поддержку.'],
      ['Можно подарить подписку другу?', 'Да: «Подписка» → «Подарить подписку», введите Sali ID друга. А если пригласить друга, он получит +1 день, а вы — скидку.'],
      ['Есть приложение для компьютера?', 'Да, для Windows. Скачайте установщик на странице «Скачать» — там же пошаговая инструкция.'],
      ['Что будет, если переустановить приложение?', 'Ничего страшного: войдите через тот же Telegram — подписка на месте, а старая установка уберётся сама.'],
      ['Подписка продлевается автоматически?', 'Только если вы сами включили автопродление с баланса. Иначе — нет: за 3 дня до окончания мы напомним в Telegram, а продлить можно в приложении одним нажатием — «Баланс» → «Продлить с баланса».'],
      ['Можно ли пользоваться на нескольких устройствах?', 'Да, до 3: телефон, компьютер и ещё одно. Подписка на аккаунте, поэтому работает на всех сразу. Лишние устройства удаляются во вкладке «Устройства».'],
    ],
    ctaTitle: 'Попробуйте 3 дня бесплатно', ctaText: 'Установите приложение и нажмите «Включить» — это займёт меньше минуты.',
    footer: 'Простой и приватный VPN.', privacy: 'Конфиденциальность', terms: 'Условия', support: 'Поддержка',
  },
  en: {
    nav: [['how', 'How it works'], ['plans', 'Pricing'], ['features', 'Features'], ['security', 'Security'], ['faq', 'FAQ']], help: 'Help',
    openBot: 'Open the bot', download: 'Get the app', downloadNav: 'Download', dayWord: 'days',
    heroBadge: 'Android & Windows · no logs · WireGuard',
    heroTitle: ['Internet without borders.', 'In one tap.'],
    heroText: 'Sali VPN is fast and calm. Install the app and tap “Turn on” — the first 3 days are free. No codes, no sign-up, no passwords.',
    trust: ['3 days free', 'Up to 3 devices per plan', 'Pay with USDT'],
    howEyebrow: 'How it works', howTitle: 'Three steps and you are online', howText: 'Everything is in the app. Your account has one Sali ID for life; the plan lives on the account and works on all your devices.',
    steps: [
      ['Install Sali VPN', 'On Android or Windows from the Download page. No forms, e-mail or passwords.'],
      ['Tap “Turn on”', 'That’s it — 3 days free. Nothing to enter or link.'],
      ['Get a plan', 'Right in the app: pick a plan and pay in USDT. Link Telegram once so the plan belongs to your account.'],
    ],
    plansEyebrow: 'Pricing', plansTitle: 'Honest prices', plansText: 'One plan per account — up to 3 devices. A new purchase adds days on top; auto-renewal from your balance only if you turn it on.',
    free: 'Free', freeText: '3 days of unlimited VPN to try everything', freeCta: 'Download and turn on',
    month: '30 days', year: '1 year', perMonth: '/mo', best: 'Best value', buyCta: 'Get it in the app', mainBadge: 'Main', per30: 'per 30 days', saving: 'save', included: 'Every plan includes:',
    benefits: ['Fast network', 'Privacy above all', 'All servers', 'Up to 3 devices'], payMethods: 'USDT (TON)',
    featuresEyebrow: 'Features', featuresTitle: 'Everything you need. Nothing you don’t.',
    features: [
      ['bolt', 'Fast network', 'A modern protocol and uncrowded servers — video, games and calls without lag.'],
      ['shield', 'Privacy above all', 'No browsing history, no ads. Your account is just a Sali ID.'],
      ['globe', 'Several countries', 'Netherlands, Germany, USA — and new locations every month.'],
      ['devices', 'Phone and computer', 'Android and Windows. One plan — up to 3 devices; reinstalling does not reset it.'],
      ['gift', 'No codes', 'Bought a plan, got a gift or a bonus — it lands on your account by itself. Nothing to copy or type.'],
      ['chat', 'Real support', 'Message us in Telegram — a real person answers.'],
    ],
    securityEyebrow: 'Security', securityTitle: 'Protected at every level', securityText: 'From your device to our servers. We deliberately keep the details private — it makes attacks harder.',
    security: [
      ['lock', 'Encryption', 'All traffic is encrypted with modern protocols — the same class of protection banks and messengers use.'],
      ['key', 'Keys under lock', 'Everyone has their own access keys. They are stored encrypted, with a separate key.'],
      ['shield', 'Isolation', 'Users are separated from each other: nobody on a server can reach your device.'],
      ['check', 'Locked-down servers', 'Logins only with the team’s keys, passwords off, guessing blocked automatically.'],
      ['clock', 'Nothing on disk', 'Service logs live only in memory and are wiped. There is no history to steal.'],
      ['telegram', 'No password to leak', 'No password: your account is linked to your Telegram. Card details never reach us; we tell you about every new device.'],
    ],
    securityMore: 'More about security',
    faqTitle: 'FAQ',
    faqs: [
      ['How well is Sali protected from hackers?', 'Traffic is encrypted with modern protocols, keys are stored encrypted, users are isolated from each other, servers accept only the team’s keys, and logs are never written to disk. We deliberately keep the details private. More in the Help centre, "Security" (salivpn.com/help/security).'],
      ['How do I pay?', 'In the app: “Plan” → pick a plan. Pay with USDT (TON network) from any wallet. The plan appears right after the transfer.'],
      ['Why link Telegram?', 'Only to pay: the plan then belongs to your account, works on all your devices and survives reinstalling. The free 3 days need no linking.'],
      ['Is there a desktop app?', 'Yes, for Windows. Get the installer on the Download page — step-by-step guide included.'],
      ['What if I reinstall the app?', 'No problem: sign in with the same Telegram — your plan is still there and the old install is removed by itself.'],
      ['Does it renew automatically?', 'Only if you turn on auto-renewal from your balance. Otherwise no: we remind you in Telegram 3 days before the end, and a new purchase adds days on top.'],
      ['Can I use several devices?', 'Yes, up to 3: phone, computer and one more. The plan is on your account, so it works on all of them. Remove extra devices in the Devices tab.'],
    ],
    ctaTitle: 'Try it free for 3 days', ctaText: 'Install the app and tap “Turn on” — it takes less than a minute.',
    footer: 'Simple, private VPN.', privacy: 'Privacy', terms: 'Terms', support: 'Support',
  },
};
