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
          'Откройте приложение и нажмите «Войти через Telegram».',
          'В Telegram нажмите «Запустить». Устройство подключится к вашему аккаунту, и сразу включатся 24 часа бесплатно.',
          'Нажмите кнопку подключения и разрешите системе создать VPN-профиль.',
          'Понравилось — купите подписку в боте. Она сама появится во всех ваших приложениях, ничего вводить не нужно.',
        ] },
        { note: 'Бот не ответил после «Запустить»? Отправьте ему номер устройства SL-XXXX-XXXX — приложение уже скопировало его. Разрешение на VPN Android спрашивает один раз.' },
      ],
      en: [
        { steps: [
          'Download Sali VPN for Android or Windows from the Download page.',
          'Open the app and tap "Sign in with Telegram".',
          'Tap "Start" in Telegram. The device joins your account and your free 24 hours start right away.',
          'Tap the connect button and allow the system to create a VPN profile.',
          'Like it? Buy a plan in the bot — it appears in all your apps by itself, nothing to type.',
        ] },
        { note: 'Bot silent after "Start"? Send it your device number SL-XXXX-XXXX — the app has already copied it. Android asks for the VPN permission once.' },
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
        { p: 'Когда Sali VPN включён, запросы уходят через зашифрованный туннель на собственный DNS-сервер на том же VPN-сервере. Он сам опрашивает корневые серверы интернета, проверяет подписи DNSSEC и ничего не записывает. Ни Google, ни Cloudflare ваших запросов не видят.' },
        { facts: [['Резолвер', 'свой, на VPN-сервере (10.67.0.1)'], ['Журнал запросов', 'выключен'], ['Защита', 'DNSSEC, QNAME minimisation']] },
        { list: [
          'Оператор связи и владелец Wi-Fi не видят адреса сайтов.',
          'Подменить ответ и увести вас на поддельную страницу на стороне сети нельзя.',
          'Мы не записываем DNS-запросы.',
        ] },
        { note: 'Свой DNS (например, в настройках «Частный DNS» Android) может отправлять запросы мимо туннеля. Если сайты не открываются с включённым VPN — выключите «Частный DNS».' },
      ],
      en: [
        { p: 'DNS is the internet’s phone book: it turns a site name into an IP address. Without a VPN these queries usually go to your provider in plain text — they see every site and can tamper with the answer.' },
        { p: 'With Sali VPN on, queries go through the encrypted tunnel to our own resolver on the same VPN server. It asks the internet’s root servers itself, checks DNSSEC signatures and records nothing. Neither Google nor Cloudflare sees your queries.' },
        { facts: [['Resolver', 'our own, on the VPN server (10.67.0.1)'], ['Query log', 'off'], ['Protection', 'DNSSEC, QNAME minimisation']] },
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
    lead: { ru: 'Аккаунт — это ваш Telegram. На нём до 3 устройств, у каждого свой постоянный номер.', en: 'Your account is your Telegram. It holds up to 3 devices, each with its own permanent number.' },
    body: {
      ru: [
        { h: 'Sali ID' },
        { p: 'Номер устройства вида SL-XXXX-XXXX. Он постоянный: переустановка приложения его не меняет. По нему поддержка находит ваше устройство.' },
        { h: 'Вход через Telegram' },
        { list: [
          'В приложении: «Войти через Telegram», в Telegram — «Запустить».',
          'Если бот молчит — пришлите ему номер устройства (приложение уже скопировало его).',
          'Подписка на аккаунте сразу заработает на этом устройстве.',
        ] },
        { h: 'Несколько устройств' },
        { p: 'Одна подписка — до 3 устройств: телефон, компьютер и ещё одно. Все видны во вкладке «Устройства» в приложении и в «💎 Моя подписка» в боте; лишние удаляются одной кнопкой. Подключаете четвёртое — место освободит то, которым дольше всех не пользовались.' },
        { h: 'Если сменили телефон или переустановили приложение' },
        { p: 'Просто войдите через тот же Telegram — подписка на месте, а старая установка уберётся сама.' },
      ],
      en: [
        { h: 'Sali ID' },
        { p: 'A device number like SL-XXXX-XXXX. It is permanent: reinstalling the app does not change it. Support uses it to find your device.' },
        { h: 'Signing in with Telegram' },
        { list: [
          'In the app: "Sign in with Telegram", then "Start" in Telegram.',
          'If the bot stays silent, send it the device number (the app has already copied it).',
          'The plan on your account starts working on this device right away.',
        ] },
        { h: 'Several devices' },
        { p: 'One plan — up to 3 devices: phone, computer and one more. All are listed in the app\'s Devices tab and under "💎 My plan" in the bot; remove extras with one tap. Adding a fourth frees the place of the one unused the longest.' },
        { h: 'New phone or reinstalled app?' },
        { p: 'Just sign in with the same Telegram — your plan is still there and the old install is removed by itself.' },
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
        { list: ['Telegram ID — это ваш аккаунт: на нём подписка, по нему бот присылает напоминания.', 'Sali ID ваших устройств и сроки тарифов.', 'Платежи: сумма, способ и дата.', 'Технические данные сервера: сколько устройств подключено сейчас — без адресов сайтов.', 'Пока вы подключены, сервер держит в оперативной памяти ваш IP-адрес — без него ответы не дойдут. На диск он не пишется и забывается после отключения.'] },
        { h: 'Чего мы не знаем' },
        { list: ['Какие сайты и приложения вы открываете.', 'Ваши DNS-запросы.', 'Содержимое трафика.', 'Историю подключений: когда и откуда вы подключались.'] },
        { p: 'Другие пользователи VPN не видят ваше устройство: трафик между клиентами на серверах заблокирован.' },
        { p: 'Подробно — в политике конфиденциальности.', to: '/privacy' },
      ],
      en: [
        { h: 'What we know' },
        { list: ['Your Telegram ID — it is your account: the plan lives on it and the bot sends reminders.', 'Your devices’ Sali IDs and plan dates.', 'Payments: amount, method and date.', 'Server health data: how many devices are connected right now — no site addresses.', 'While you are connected, the server keeps your IP address in memory — replies can’t reach you without it. It is never written to disk and is forgotten after you disconnect.'] },
        { h: 'What we don’t' },
        { list: ['Which sites and apps you open.', 'Your DNS queries.', 'The contents of your traffic.', 'Your connection history: when and from where you connected.'] },
        { p: 'Other VPN users can’t see your device: traffic between clients is blocked on our servers.' },
        { p: 'Details are in the privacy policy.', to: '/privacy' },
      ],
    },
  },
  {
    slug: 'security',
    group: 'account',
    title: { ru: 'Безопасность', en: 'Security' },
    lead: { ru: 'Как мы защищаем ваше соединение, аккаунт и наши серверы.', en: 'How we protect your connection, your account and our servers.' },
    body: {
      ru: [
        { h: 'Ваше соединение' },
        { list: [
          'Весь трафик между устройством и сервером зашифрован современными протоколами — теми же классами шифрования, что используют банки и мессенджеры.',
          'Ключи доступа уникальны для каждого пользователя. Хранятся в зашифрованном виде, отдельным ключом, — утечка одной части системы не раскрывает их.',
          'Пользователи изолированы друг от друга: с одного сервера нельзя «увидеть» чужое устройство.',
          'Из VPN закрыт доступ к внутренним сетям дата-центра — сервер нельзя использовать как вход внутрь инфраструктуры.',
        ] },
        { h: 'Серверы' },
        { list: [
          'Вход на серверы — только по криптографическим ключам команды. Пароли не работают, попытки подбора автоматически блокируются.',
          'Обновления безопасности ставятся автоматически каждый день.',
          'Служебные журналы живут только в оперативной памяти и стираются — на дисках нет истории, которую можно украсть.',
          'Управление серверами идёт по закрытому шифрованному каналу, недоступному из интернета без ключа.',
        ] },
        { h: 'Аккаунт и оплата' },
        { list: [
          'Аккаунт — это ваш Telegram: нет паролей, которые можно подобрать или украсть из базы.',
          'Оплата проходит через Telegram Stars, блокчейн или защищённую страницу платёжного сервиса. Данные карты к нам не попадают.',
          'О каждом новом устройстве и активации вам приходит сообщение в Telegram. Чужое устройство можно отвязать в один клик.',
          'Ссылка для Happ — личная и работает как пароль. Если она попала к чужим, сбросьте её в боте: старая сразу перестанет работать.',
          'Важные действия в системе (новый сервер, ручная выдача доступа) мгновенно видит вся команда.',
        ] },
        { h: 'Приложение' },
        { list: ['Скачивайте Sali VPN только из нашего бота, канала и сайта. Каждая сборка подписана нашим ключом — подделку с чужой подписью Android не установит поверх настоящей.'] },
        { note: 'Подробности защиты мы намеренно не публикуем: чем меньше злоумышленник знает об устройстве системы, тем сложнее ему атаковать. Нашли уязвимость? Напишите в поддержку — ответим лично.' },
      ],
      en: [
        { h: 'Your connection' },
        { list: [
          'All traffic between your device and the server is encrypted with modern protocols — the same class of encryption banks and messengers use.',
          'Access keys are unique per user. They are stored encrypted with a separate key, so a leak of one part of the system does not expose them.',
          'Users are isolated from each other: nobody on a server can reach your device.',
          'The VPN cannot reach the data centre’s internal networks — a server can’t be used as a way into the infrastructure.',
        ] },
        { h: 'Servers' },
        { list: [
          'Servers accept logins only with the team’s cryptographic keys. Passwords do not work, and guessing attempts are blocked automatically.',
          'Security updates install automatically every day.',
          'Service logs live only in memory and are wiped — there is no history on disk to steal.',
          'Servers are managed over a closed, encrypted channel that can’t be used without a key.',
        ] },
        { h: 'Account & payments' },
        { list: [
          'Your account is your Telegram — there are no passwords to guess or steal from a database.',
          'You pay through Telegram Stars, a blockchain, or the payment provider’s secure page. Card details never reach us.',
          'You get a Telegram message about every new device and activation, and can unlink a stranger’s device in one tap.',
          'Your Happ link is personal and works like a password. If someone else got it, reset it in the bot — the old one stops working at once.',
          'The whole team instantly sees sensitive actions in the system (a new server, access granted by hand).',
        ] },
        { h: 'The app' },
        { list: ['Download Sali VPN only from our bot, channel and website. Every build is signed with our key — Android will not install a fake with someone else’s signature over the real app.'] },
        { note: 'We deliberately do not publish the details of our defences: the less an attacker knows about how the system is built, the harder it is to attack. Found a vulnerability? Write to support — we’ll reply personally.' },
      ],
    },
  },
  {
    slug: 'payments',
    group: 'account',
    title: { ru: 'Оплата', en: 'Payments' },
    lead: { ru: 'Оплата — в Telegram-боте. Подписка сразу появляется на вашем аккаунте, без кодов.', en: 'You pay in the Telegram bot. The plan lands on your account at once — no codes.' },
    body: {
      ru: [
        { facts: [['Способы', 'Telegram Stars, USDT (сеть TON)'], ['Устройств', 'до 3 на подписку'], ['Автосписания', 'нет']] },
        { list: [
          'После оплаты подписка сразу работает во всех ваших приложениях.',
          'Если подписка уже есть, новая покупка добавит дни к текущим.',
          'Срок подписки и устройства — в боте: «💎 Моя подписка».',
          'За 3 дня до окончания бот напомнит о продлении.',
          'Есть промокод? В приложении: «Подписка» → «Промокод». Купленные раньше и не введённые коды применятся сами при входе через Telegram.',
          'Подписка есть, а VPN не подключается? Напишите в поддержку @SaliVPNHelpBot — разберёмся.',
        ] },
        { note: 'Оплатили, а подписки нет? Не платите повторно. Для USDT нажмите «Я оплатил — проверить». Через 10 минут — пишите в поддержку.' },
      ],
      en: [
        { facts: [['Methods', 'Telegram Stars, USDT (TON network)'], ['Devices', 'up to 3 per plan'], ['Auto-renewal', 'none']] },
        { list: [
          'After paying, the plan works in all your apps at once.',
          'With an active plan, a new purchase adds days on top.',
          'Your plan and devices are in the bot under "💎 My plan".',
          'The bot reminds you 3 days before the end.',
          'Have a promo code? In the app: "Plan" → "Promo code". Codes bought earlier and never entered apply themselves when you sign in with Telegram.',
          'Have a plan but the VPN will not connect? Message support @SaliVPNHelpBot — we will sort it out.',
        ] },
        { note: 'Paid but no plan? Do not pay again. For USDT tap "I paid — check". After 10 minutes, message support.' },
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
          'Друг открывает бота по ссылке и входит через Telegram в приложении.',
          'Друг сразу получает +3 часа VPN, а вам приходит скидка 10%.',
        ] },
        { list: ['Скидка применяется к следующей покупке автоматически.', 'За каждого друга — отдельная скидка.', 'Бонус работает только для новых аккаунтов Telegram.'] },
      ],
      en: [
        { steps: [
          'Open "Invite a friend" in the bot and send the link.',
          'Your friend opens the bot from the link and signs in to the app with Telegram.',
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
