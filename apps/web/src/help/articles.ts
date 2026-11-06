import type { LandingLanguage } from '../landing/i18n';

/**
 * Справочный центр salivpn.com/help/<slug>.
 * На эти slug ведут кнопки в приложениях (Android, Windows) и раздел «Документация» в боте —
 * менять их нельзя, только добавлять новые.
 */
export type Block =
  | { p: string; to?: string }
  | { h: string }
  | { list: string[] }
  | { steps: string[] }
  | { note: string }
  | { facts: [string, string][] };

export interface Article {
  slug: string;
  group: 'start' | 'connection' | 'account';
  title: Record<LandingLanguage, string>;
  lead: Record<LandingLanguage, string>;
  body: Record<LandingLanguage, Block[]>;
}

export const GROUPS: Record<Article['group'], Record<LandingLanguage, string>> = {
  start: { ru: 'Начало', en: 'Getting started' },
  connection: { ru: 'Подключение', en: 'Connection' },
  account: { ru: 'Аккаунт и оплата', en: 'Account & billing' },
};

export const ARTICLES: Article[] = [
  {
    slug: 'start',
    group: 'start',
    title: { ru: 'Как начать', en: 'Getting started' },
    lead: { ru: 'От установки до первого подключения — около минуты.', en: 'From install to first connection in about a minute.' },
    body: {
      ru: [
        { steps: [
          'Скачайте Sali VPN для Android или Windows на странице «Скачать».',
          'Откройте приложение. Оно сразу создаст ваш Sali ID — без почты и паролей.',
          'Нажмите «Привязать Telegram». Откроется бот и запомнит устройство.',
          'В боте получите бесплатный код или купите подписку.',
          'Нажмите «Активировать на моём устройстве» под кодом — или введите код в приложении вручную.',
          'Нажмите кнопку подключения и разрешите системе создать VPN-профиль.',
        ] },
        { note: 'Разрешение на VPN Android спрашивает один раз. Без него ни одно VPN-приложение не может работать.' },
      ],
      en: [
        { steps: [
          'Download Sali VPN for Android or Windows from the Download page.',
          'Open the app. It creates your Sali ID instantly — no e-mail, no passwords.',
          'Tap "Link Telegram". The bot opens and remembers this device.',
          'Get a free code or buy a plan in the bot.',
          'Tap "Activate on my device" under the code — or type the code into the app.',
          'Tap the connect button and allow the system to create a VPN profile.',
        ] },
        { note: 'Android asks for the VPN permission once. No VPN app can work without it.' },
      ],
    },
  },
  {
    slug: 'protocol',
    group: 'connection',
    title: { ru: 'Протокол', en: 'Protocol' },
    lead: { ru: 'Sali VPN работает на WireGuard, а там, где его блокируют, — на AmneziaWG.', en: 'Sali VPN runs on WireGuard, and on AmneziaWG where WireGuard is blocked.' },
    body: {
      ru: [
        { h: 'WireGuard' },
        { p: 'Современный VPN-протокол с открытым кодом. Его ядро — около четырёх тысяч строк, поэтому его легко проверить, а ошибок в нём на порядки меньше, чем в OpenVPN или IPsec.' },
        { list: [
          'Быстрее старых протоколов и меньше расходует батарею.',
          'Мгновенно восстанавливает соединение при переходе с Wi-Fi на мобильную сеть.',
          'Не держит открытых портов для чужих: сервер молчит, пока не получит правильно подписанный пакет.',
        ] },
        { h: 'AmneziaWG' },
        { p: 'Тот же WireGuard, но с маскировкой: служебные пакеты меняют размер и вид, поэтому системы фильтрации труднее отличить VPN от обычного трафика. Приложение выбирает AmneziaWG само, вручную ничего включать не нужно.' },
        { h: 'Шифрование' },
        { facts: [['Шифр', 'ChaCha20-Poly1305'], ['Обмен ключами', 'Curve25519'], ['Хеширование', 'BLAKE2s'], ['MTU', '1280']] },
        { note: 'Приватный ключ создаётся для вашего устройства и хранится в зашифрованном виде. На VPN-сервер он не передаётся.' },
      ],
      en: [
        { h: 'WireGuard' },
        { p: 'A modern open-source VPN protocol. Its core is about four thousand lines, so it is easy to audit and has far fewer bugs than OpenVPN or IPsec.' },
        { list: [
          'Faster than older protocols and easier on the battery.',
          'Reconnects instantly when you switch from Wi-Fi to mobile data.',
          'Keeps no doors open: the server stays silent until it gets a correctly signed packet.',
        ] },
        { h: 'AmneziaWG' },
        { p: 'The same WireGuard with camouflage: handshake packets change size and shape, so filtering systems find it harder to tell VPN from ordinary traffic. The app picks AmneziaWG on its own.' },
        { h: 'Encryption' },
        { facts: [['Cipher', 'ChaCha20-Poly1305'], ['Key exchange', 'Curve25519'], ['Hashing', 'BLAKE2s'], ['MTU', '1280']] },
        { note: 'Your private key is created for your device and stored encrypted. It is never sent to the VPN server.' },
      ],
    },
  },
  {
    slug: 'dns',
    group: 'connection',
    title: { ru: 'DNS', en: 'DNS' },
    lead: { ru: 'Все DNS-запросы идут внутри туннеля — провайдер не видит, какие сайты вы открываете.', en: 'All DNS queries travel inside the tunnel — your provider cannot see which sites you open.' },
    body: {
      ru: [
        { p: 'DNS — это «телефонная книга» интернета: она превращает адрес сайта в IP-адрес. Без VPN эти запросы обычно уходят провайдеру открытым текстом — он видит каждый сайт и может подменить ответ.' },
        { p: 'Когда Sali VPN включён, запросы уходят только через зашифрованный туннель к публичным резолверам:' },
        { facts: [['Основной', 'Cloudflare 1.1.1.1'], ['Резервный', 'Google 8.8.8.8']] },
        { list: [
          'Оператор связи и владелец Wi-Fi не видят адреса сайтов.',
          'Подменить ответ и увести вас на поддельную страницу на стороне сети нельзя.',
          'Мы не записываем DNS-запросы.',
        ] },
        { note: 'Свой DNS (например, в настройках «Частный DNS» Android) может отправлять запросы мимо туннеля. Если сайты не открываются с включённым VPN — выключите «Частный DNS».' },
      ],
      en: [
        { p: 'DNS is the internet’s phone book: it turns a site name into an IP address. Without a VPN these queries usually go to your provider in plain text — they see every site and can tamper with the answer.' },
        { p: 'With Sali VPN on, queries go only through the encrypted tunnel to public resolvers:' },
        { facts: [['Primary', 'Cloudflare 1.1.1.1'], ['Fallback', 'Google 8.8.8.8']] },
        { list: [
          'Your carrier and the Wi-Fi owner cannot see site names.',
          'Nobody on the network can swap the answer and send you to a fake page.',
          'We do not record DNS queries.',
        ] },
        { note: 'A custom DNS (such as Android’s "Private DNS") may send queries outside the tunnel. If sites will not open with the VPN on, turn Private DNS off.' },
      ],
    },
  },
  {
    slug: 'devices',
    group: 'account',
    title: { ru: 'Устройства', en: 'Devices' },
    lead: { ru: 'Каждая установка приложения — отдельное устройство со своим Sali ID.', en: 'Every app install is a separate device with its own Sali ID.' },
    body: {
      ru: [
        { h: 'Sali ID' },
        { p: 'Номер вида SL-XXXX-XXXX. Он появляется при первом запуске и виден в разделе «Аккаунт». По нему поддержка находит ваше устройство, а бот — привязывает его к Telegram.' },
        { h: 'Привязка к Telegram' },
        { list: [
          'В приложении: «Привязать Telegram» — бот откроется и запомнит устройство.',
          'Или пришлите Sali ID в чат с ботом.',
          'Привязанное устройство появится в «Мои устройства», а коды можно будет активировать одной кнопкой.',
        ] },
        { h: 'Несколько устройств' },
        { p: 'Один код активирует одно устройство. Для второго телефона или компьютера купите ещё один код и активируйте его на нужном устройстве — бот спросит, на какое.' },
        { h: 'Если сменили телефон' },
        { p: 'Напишите в поддержку старый и новый Sali ID — поможем перенести оставшиеся дни.' },
      ],
      en: [
        { h: 'Sali ID' },
        { p: 'A number like SL-XXXX-XXXX. It appears on first launch under "Account". Support uses it to find your device, and the bot uses it to link the device to Telegram.' },
        { h: 'Linking to Telegram' },
        { list: [
          'In the app: "Link Telegram" — the bot opens and remembers the device.',
          'Or send the Sali ID to the bot.',
          'A linked device shows up in "My devices", and codes can be activated with one tap.',
        ] },
        { h: 'Several devices' },
        { p: 'One code activates one device. For a second phone or computer buy another code and activate it there — the bot asks which device.' },
        { h: 'Changed phones?' },
        { p: 'Send support your old and new Sali ID — we will help move the remaining days.' },
      ],
    },
  },
  {
    slug: 'servers',
    group: 'connection',
    title: { ru: 'Серверы', en: 'Servers' },
    lead: { ru: 'Приложение само выбирает быстрый сервер и переносит вас, если он перестал отвечать.', en: 'The app picks a fast server and moves you if it stops answering.' },
    body: {
      ru: [
        { list: [
          'Страну можно сменить на главном экране приложения.',
          'Мы проверяем каждый сервер раз в 15 минут.',
          'Если сервер не отвечает, при следующем подключении вас перенесёт на рабочий — с теми же ключами, настраивать ничего не нужно.',
        ] },
        { note: 'Чем ближе сервер, тем ниже пинг. Для игр и звонков выбирайте ближайшую страну.' },
      ],
      en: [
        { list: [
          'Change the country on the app’s home screen.',
          'We check every server every 15 minutes.',
          'If a server is down, your next connection goes to a working one with the same keys — nothing to set up.',
        ] },
        { note: 'The closer the server, the lower the ping. For games and calls pick the nearest country.' },
      ],
    },
  },
  {
    slug: 'kill-switch',
    group: 'connection',
    title: { ru: 'Kill Switch', en: 'Kill Switch' },
    lead: { ru: 'Блокирует интернет, если VPN внезапно отключился, — чтобы ничего не ушло мимо туннеля.', en: 'Blocks the internet if the VPN drops, so nothing leaks outside the tunnel.' },
    body: {
      ru: [
        { p: 'На Android это встроенная функция системы, Sali VPN её включает через системные настройки:' },
        { steps: [
          'В приложении включите «Kill Switch» — откроются настройки VPN.',
          'Нажмите на шестерёнку рядом с Sali VPN.',
          'Включите «Постоянная VPN» и «Блокировать соединения без VPN».',
        ] },
        { note: 'Пока Kill Switch включён, без VPN интернет на телефоне работать не будет. Чтобы выйти в сеть без VPN, выключите «Блокировать соединения без VPN».' },
      ],
      en: [
        { p: 'On Android this is a built-in system feature; Sali VPN switches it on through system settings:' },
        { steps: [
          'Turn on "Kill Switch" in the app — VPN settings open.',
          'Tap the gear next to Sali VPN.',
          'Turn on "Always-on VPN" and "Block connections without VPN".',
        ] },
        { note: 'While Kill Switch is on, the phone has no internet without the VPN. To go online without it, turn "Block connections without VPN" off.' },
      ],
    },
  },
  {
    slug: 'auto-connect',
    group: 'connection',
    title: { ru: 'Автоподключение', en: 'Auto-connect' },
    lead: { ru: 'Sali VPN подключается сам, как только вы открываете приложение.', en: 'Sali VPN connects by itself as soon as you open the app.' },
    body: {
      ru: [
        { p: 'Включите «Автоподключение» в настройках приложения. При следующем запуске Sali VPN подключится к последнему серверу без нажатия кнопки.' },
        { note: 'Чтобы VPN включался и после перезагрузки телефона, включите «Постоянная VPN» в системных настройках — см. Kill Switch.' },
      ],
      en: [
        { p: 'Turn on "Auto-connect" in the app settings. Next time you open Sali VPN it connects to the last server without a tap.' },
        { note: 'For the VPN to come back after a reboot as well, turn on "Always-on VPN" in system settings — see Kill Switch.' },
      ],
    },
  },
  {
    slug: 'privacy',
    group: 'account',
    title: { ru: 'Приватность', en: 'Privacy' },
    lead: { ru: 'Мы не храним историю сайтов, DNS-запросы и содержимое трафика.', en: 'We keep no browsing history, DNS queries or traffic contents.' },
    body: {
      ru: [
        { h: 'Что мы знаем' },
        { list: ['Telegram ID — чтобы бот мог прислать код и напоминание.', 'Sali ID ваших устройств и сроки тарифов.', 'Платежи: сумма, способ и дата.', 'Технические данные сервера: сколько устройств подключено сейчас — без адресов сайтов.'] },
        { h: 'Чего мы не знаем' },
        { list: ['Какие сайты и приложения вы открываете.', 'Ваши DNS-запросы.', 'Содержимое трафика.'] },
        { p: 'Подробно — в политике конфиденциальности.', to: '/privacy' },
      ],
      en: [
        { h: 'What we know' },
        { list: ['Your Telegram ID — so the bot can send codes and reminders.', 'Your devices’ Sali IDs and plan dates.', 'Payments: amount, method and date.', 'Server health data: how many devices are connected right now — no site addresses.'] },
        { h: 'What we don’t' },
        { list: ['Which sites and apps you open.', 'Your DNS queries.', 'The contents of your traffic.'] },
        { p: 'Details are in the privacy policy.', to: '/privacy' },
      ],
    },
  },
  {
    slug: 'payments',
    group: 'account',
    title: { ru: 'Оплата и коды', en: 'Payments & codes' },
    lead: { ru: 'Оплата — только в Telegram-боте. Взамен вы получаете код активации.', en: 'You pay only in the Telegram bot and get an activation code back.' },
    body: {
      ru: [
        { facts: [['Способы', 'Telegram Stars, USDT (сеть TON)'], ['Формат кода', 'SALI-XXXX-XXXX-XXXX'], ['Срок жизни кода', '90 дней до активации'], ['Автосписания', 'нет']] },
        { list: [
          'Код одноразовый, его можно подарить.',
          'Если подписка уже есть, новый код добавит дни к текущим.',
          'Все коды хранятся в боте: «Мои коды».',
          'За 3 дня до окончания бот напомнит о продлении.',
        ] },
        { note: 'Оплатили, а кода нет? Не платите повторно. Для USDT нажмите «Я оплатил — проверить». Через 10 минут — пишите в поддержку.' },
      ],
      en: [
        { facts: [['Methods', 'Telegram Stars, USDT (TON network)'], ['Code format', 'SALI-XXXX-XXXX-XXXX'], ['Code lifetime', '90 days before activation'], ['Auto-renewal', 'none']] },
        { list: [
          'A code is single-use and can be gifted.',
          'With an active plan, a new code adds days on top.',
          'All codes are kept in the bot under "My codes".',
          'The bot reminds you 3 days before the end.',
        ] },
        { note: 'Paid but no code? Do not pay again. For USDT tap "I paid — check". After 10 minutes, message support.' },
      ],
    },
  },
  {
    slug: 'referrals',
    group: 'account',
    title: { ru: 'Приглашения', en: 'Invites' },
    lead: { ru: 'Другу — 3 часа VPN, вам — скидка 10% на следующую оплату.', en: 'Your friend gets 3 hours of VPN, you get 10% off your next payment.' },
    body: {
      ru: [
        { steps: [
          'В боте откройте «Пригласить друга» и отправьте ссылку.',
          'Друг открывает бота по ссылке и активирует свой первый код.',
          'Друг сразу получает +3 часа VPN, а вам приходит скидка 10%.',
        ] },
        { list: ['Скидка применяется к следующей покупке автоматически.', 'За каждого друга — отдельная скидка.', 'Бонус работает только для новых аккаунтов Telegram.'] },
      ],
      en: [
        { steps: [
          'Open "Invite a friend" in the bot and send the link.',
          'Your friend opens the bot from the link and activates their first code.',
          'They get +3 hours of VPN right away; you get a 10% discount.',
        ] },
        { list: ['The discount applies to your next purchase automatically.', 'Every friend brings a separate discount.', 'Only new Telegram accounts count.'] },
      ],
    },
  },
  {
    slug: 'troubleshooting',
    group: 'start',
    title: { ru: 'VPN не подключается', en: 'VPN won’t connect' },
    lead: { ru: 'Пять шагов, которые решают почти все проблемы.', en: 'Five steps that fix almost everything.' },
    body: {
      ru: [
        { steps: [
          'Проверьте тариф: в боте «Мои устройства» рядом с устройством должна быть зелёная точка.',
          'Выключите другие VPN, блокировщики рекламы и «Частный DNS».',
          'Переключитесь между Wi-Fi и мобильной сетью.',
          'Выберите другой сервер.',
          'Закройте приложение полностью и откройте снова.',
        ] },
        { note: 'Не помогло — напишите в поддержку и укажите Sali ID. Отвечает живой человек.' },
      ],
      en: [
        { steps: [
          'Check your plan: in the bot, "My devices" should show a green dot next to the device.',
          'Turn off other VPNs, ad blockers and "Private DNS".',
          'Switch between Wi-Fi and mobile data.',
          'Pick another server.',
          'Close the app completely and open it again.',
        ] },
        { note: 'Still stuck? Message support with your Sali ID. A real person answers.' },
      ],
    },
  },
];

export const articleBySlug = (slug?: string) => ARTICLES.find((article) => article.slug === slug);
