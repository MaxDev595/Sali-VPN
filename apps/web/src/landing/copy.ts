import type { LandingLanguage } from './i18n';

const env = import.meta.env as Record<string, string | undefined>;
export const PRICES = {
  month: Number(env.VITE_PRICE_MONTH_USD ?? 5),
  monthOld: Number(env.VITE_PRICE_MONTH_OLD_USD ?? 8),
  year: Number(env.VITE_PRICE_YEAR_USD ?? 40),
  yearOld: Number(env.VITE_PRICE_YEAR_OLD_USD ?? 60),
  freeDays: Number(env.VITE_FREE_DAYS ?? 1),
};

export const copy: Record<LandingLanguage, {
  nav: [string, string][]; openBot: string; download: string; downloadNav: string; dayWord: string; heroBadge: string; heroTitle: [string, string]; heroText: string;
  trust: string[]; howEyebrow: string; howTitle: string; howText: string; steps: [string, string][];
  plansEyebrow: string; plansTitle: string; plansText: string; free: string; freeText: string; freeCta: string;
  month: string; year: string; perMonth: string; best: string; buyCta: string; benefits: string[]; payMethods: string;
  featuresEyebrow: string; featuresTitle: string; features: [string, string, string][];
  faqTitle: string; faqs: [string, string][]; ctaTitle: string; ctaText: string; footer: string; privacy: string; terms: string; support: string;
}> = {
  ru: {
    nav: [['how', 'Как это работает'], ['plans', 'Тарифы'], ['features', 'Возможности'], ['faq', 'Вопросы']],
    openBot: 'Открыть бота', download: 'Скачать приложение', downloadNav: 'Скачать', dayWord: 'день',
    heroBadge: 'Android и Windows · без логов · до 3 устройств',
    heroTitle: ['Интернет без границ.', 'В одно касание.'],
    heroText: 'Sali VPN — быстрый и спокойный VPN. Установите приложение, получите код в Telegram-боте — и всё работает. Без регистрации и паролей.',
    trust: ['1 день бесплатно', 'Оплата Stars, USDT или картой', 'Код можно подарить'],
    howEyebrow: 'Как это работает', howTitle: 'Четыре шага — и вы онлайн', howText: 'Оплата живёт в Telegram, приложение только подключает. Поэтому всё просто и прозрачно.',
    steps: [
      ['Установите Sali VPN', 'На Android или Windows — со страницы «Скачать». Приложение сразу выдаст ваш Sali ID — без форм и почты.'],
      ['Привяжите Telegram', 'Одна кнопка в приложении открывает бота, и он запоминает ваше устройство.'],
      ['Получите код', 'Бесплатный день или подписка на месяц / год. Бот пришлёт код SALI-XXXX-XXXX-XXXX.'],
      ['Введите код и подключайтесь', 'Или нажмите «Активировать на моём устройстве» прямо в боте — без ввода.'],
    ],
    plansEyebrow: 'Тарифы', plansTitle: 'Честные цены', plansText: 'Без автосписаний. Новый код добавляет дни к текущей подписке.',
    free: 'Бесплатно', freeText: 'целые сутки VPN без ограничений — проверьте всё сами', freeCta: 'Получить в боте',
    month: '1 месяц', year: '1 год', perMonth: '/мес', best: 'Выгоднее всего', buyCta: 'Купить в боте',
    benefits: ['Все серверы', 'До 3 устройств', 'Без логов и рекламы'], payMethods: 'Telegram Stars · USDT (TON) · банковская карта',
    featuresEyebrow: 'Возможности', featuresTitle: 'Всё, что нужно. Ничего лишнего.',
    features: [
      ['bolt', 'Быстро', 'WireGuard — современный протокол, который не тормозит и бережёт батарею.'],
      ['shield', 'Приватно', 'Мы не храним историю посещений. Аккаунт — это только Sali ID.'],
      ['globe', 'Несколько стран', 'Нидерланды, Германия, США — и новые локации каждый месяц.'],
      ['devices', 'Телефон и компьютер', 'Android и Windows — до 3 устройств на одной подписке.'],
      ['gift', 'Коды-подарки', 'Купили код — можете отдать другу. Он одноразовый и действует 90 дней.'],
      ['chat', 'Поддержка в Telegram', 'Пишете в бота — отвечает живой человек.'],
    ],
    faqTitle: 'Частые вопросы',
    faqs: [
      ['Почему оплата в Telegram, а не в приложении?', 'Так быстрее и дешевле для вас: доступны Telegram Stars, USDT и карты, а коды можно дарить и хранить в чате.'],
      ['Куда вводить код?', 'В приложении Sali VPN (на телефоне или компьютере) кнопка «Ввести код» на главном экране. Регистр и дефисы не важны.'],
      ['Есть приложение для компьютера?', 'Да, для Windows. Скачайте установщик на странице «Скачать» — там же пошаговая инструкция.'],
      ['Что если я потеряю код?', 'Все ваши коды хранятся в боте в разделе «Мои коды».'],
      ['Подписка продлевается автоматически?', 'Нет. За 3 дня до окончания бот напомнит, а новый код добавит дни к текущим.'],
      ['Можно ли пользоваться на нескольких устройствах?', 'Да, до трёх. Пришлите боту Sali ID каждого устройства или привяжите их кнопкой в приложении.'],
    ],
    ctaTitle: 'Попробуйте день бесплатно', ctaText: 'Установите приложение и откройте бота — это займёт меньше минуты.',
    footer: 'Простой и приватный VPN.', privacy: 'Конфиденциальность', terms: 'Условия', support: 'Поддержка',
  },
  en: {
    nav: [['how', 'How it works'], ['plans', 'Pricing'], ['features', 'Features'], ['faq', 'FAQ']],
    openBot: 'Open the bot', download: 'Get the app', downloadNav: 'Download', dayWord: 'day',
    heroBadge: 'Android & Windows · no logs · up to 3 devices',
    heroTitle: ['Internet without borders.', 'In one tap.'],
    heroText: 'Sali VPN is fast and calm. Install the app, get a code from our Telegram bot — and you are online. No sign-up, no passwords.',
    trust: ['1 day free', 'Pay with Stars, USDT or card', 'Codes can be gifted'],
    howEyebrow: 'How it works', howTitle: 'Four steps and you are online', howText: 'Payments live in Telegram, the app just connects. Simple and transparent.',
    steps: [
      ['Install Sali VPN', 'On Android or Windows from the Download page. You get your Sali ID instantly — no forms, no e-mail.'],
      ['Link Telegram', 'One button in the app opens the bot, which remembers your device.'],
      ['Get a code', 'A free day or a monthly / yearly plan. The bot sends a SALI-XXXX-XXXX-XXXX code.'],
      ['Enter it and connect', 'Or tap "Activate on my device" right in the bot — no typing.'],
    ],
    plansEyebrow: 'Pricing', plansTitle: 'Honest prices', plansText: 'No auto-renewals. A new code adds days on top of your current plan.',
    free: 'Free', freeText: 'a full day of unlimited VPN to try everything', freeCta: 'Get it in the bot',
    month: '1 month', year: '1 year', perMonth: '/mo', best: 'Best value', buyCta: 'Buy in the bot',
    benefits: ['All servers', 'Up to 3 devices', 'No logs, no ads'], payMethods: 'Telegram Stars · USDT (TON) · bank card',
    featuresEyebrow: 'Features', featuresTitle: 'Everything you need. Nothing you don’t.',
    features: [
      ['bolt', 'Fast', 'WireGuard is modern, quick and easy on the battery.'],
      ['shield', 'Private', 'We keep no browsing history. Your account is just a Sali ID.'],
      ['globe', 'Several countries', 'Netherlands, Germany, USA — and new locations every month.'],
      ['devices', 'Phone and computer', 'Android and Windows — up to 3 devices on one plan.'],
      ['gift', 'Gift codes', 'Bought a code? Give it to a friend. One-time, valid for 90 days.'],
      ['chat', 'Support in Telegram', 'Message the bot — a real person answers.'],
    ],
    faqTitle: 'FAQ',
    faqs: [
      ['Why pay in Telegram instead of the app?', 'It is faster and cheaper for you: Stars, USDT and cards are available, and codes can be gifted and kept in the chat.'],
      ['Where do I enter the code?', 'In the Sali VPN app (phone or computer), "Enter code" on the main screen. Case and dashes do not matter.'],
      ['Is there a desktop app?', 'Yes, for Windows. Get the installer on the Download page — step-by-step guide included.'],
      ['What if I lose my code?', 'All your codes are stored in the bot under "My codes".'],
      ['Does it renew automatically?', 'No. The bot reminds you 3 days before the end, and a new code adds days on top.'],
      ['Can I use several devices?', 'Yes, up to three. Send the bot each device’s Sali ID or link them from the app.'],
    ],
    ctaTitle: 'Try it free for a day', ctaText: 'Install the app and open the bot — it takes less than a minute.',
    footer: 'Simple, private VPN.', privacy: 'Privacy', terms: 'Terms', support: 'Support',
  },
};
