import type { LandingLanguage } from '../landing/i18n';

/**
 * Справочный центр salivpn.com/help/<slug>.
 * На эти slug ведут кнопки в приложениях (Android, Windows) и раздел «❓ Помощь» в боте —
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
          'Скачайте Sali VPN для Android на странице «Скачать».',
          'Откройте приложение и нажмите «Включить» — 3 дня бесплатно, без регистрации.',
          'Разрешите системе создать VPN-профиль (Android спрашивает один раз).',
          'Понравилось — оформите подписку во вкладке «Подписка» и оплатите в USDT.',
          'Для оплаты один раз привяжите Telegram: «Привязать Telegram», в Telegram — «Запустить». Подписка будет на вашем аккаунте.',
        ] },
        { note: 'Бот не ответил после «Запустить»? Отправьте ему номер, который приложение скопировало перед переходом в Telegram.' },
      ],
      en: [
        { steps: [
          'Download Sali VPN for Android from the Download page.',
          'Open the app and tap “Turn on” — 3 days free, no sign-up.',
          'Allow the system to create a VPN profile (Android asks once).',
          'Like it? Get a plan in the “Plan” tab and pay in USDT.',
          'To pay, link Telegram once: “Link Telegram”, then “Start” in Telegram. The plan belongs to your account.',
        ] },
        { note: 'Bot silent after "Start"? Send it the number the app copied before opening Telegram.' },
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
    lead: { ru: 'У аккаунта один Sali ID навсегда. Одна подписка — до 3 устройств.', en: 'Your account has one Sali ID for life. One plan covers up to 3 devices.' },
    body: {
      ru: [
        { h: 'Sali ID' },
        { p: 'Номер аккаунта вида SL-XXXX-XXXX. Он один на весь аккаунт и не меняется — на всех ваших устройствах вы видите один и тот же номер. По нему поддержка находит ваш аккаунт, а друзья могут подарить вам подписку. У каждого устройства есть только технический ярлык вида D-XXXXXX.' },
        { h: 'Привязка Telegram' },
        { list: [
          'Нужна только для оплаты: «Подписка» → «Привязать Telegram», в Telegram — «Запустить».',
          'Подписка на аккаунте сразу заработает на этом устройстве.',
        ] },
        { h: 'Несколько устройств' },
        { p: 'Одна подписка — до 3 устройств: телефон, компьютер и ещё одно. Все видны в приложении: «Подписка» → «Устройства»; лишние удаляются одной кнопкой. Подключаете четвёртое — место освободит то, которым дольше всех не пользовались.' },
        { h: 'Если сменили телефон или переустановили приложение' },
        { p: 'Просто привяжите тот же Telegram — подписка на месте, а старая установка уберётся сама.' },
      ],
      en: [
        { h: 'Sali ID' },
        { p: 'An account number like SL-XXXX-XXXX. There is one per account and it never changes — all your devices show the same number. Devices only carry a technical label like D-XXXXXX.' },
        { h: 'Linking Telegram' },
        { list: [
          'Needed only to pay: “Plan” → “Link Telegram”, then “Start” in Telegram.',
          'The plan on your account starts working on this device right away.',
        ] },
        { h: 'Several devices' },
        { p: 'One plan — up to 3 devices: phone, computer and one more. All are listed in the app under “Plan” → “Devices”; remove extras with one tap. Adding a fourth frees the place of the one unused the longest.' },
        { h: 'New phone or reinstalled app?' },
        { p: 'Just link the same Telegram — your plan is still there and the old install is removed by itself.' },
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
        { list: ['Telegram ID — после привязки на аккаунте лежит подписка, напоминания приходят в Telegram.', 'Sali ID аккаунта, ярлыки устройств и сроки тарифов.', 'Платежи: сумма, способ и дата.', 'Технические данные сервера: сколько устройств подключено сейчас — без адресов сайтов.', 'Пока вы подключены, сервер держит в оперативной памяти ваш IP-адрес — без него ответы не дойдут. На диск он не пишется и забывается после отключения.'] },
        { h: 'Чего мы не знаем' },
        { list: ['Какие сайты и приложения вы открываете.', 'Ваши DNS-запросы.', 'Содержимое трафика.', 'Историю подключений: когда и откуда вы подключались.'] },
        { p: 'Другие пользователи VPN не видят ваше устройство: трафик между клиентами на серверах заблокирован.' },
        { p: 'Подробно — в политике конфиденциальности.', to: '/privacy' },
      ],
      en: [
        { h: 'What we know' },
        { list: ['Your Telegram ID — once linked, the plan lives on the account and reminders come to Telegram.', 'Your account’s Sali ID, device labels and plan dates.', 'Payments: amount, method and date.', 'Server health data: how many devices are connected right now — no site addresses.', 'While you are connected, the server keeps your IP address in memory — replies can’t reach you without it. It is never written to disk and is forgotten after you disconnect.'] },
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
          'Оплата проходит в USDT через блокчейн TON. Данные карты к нам не попадают.',
          'О каждом новом устройстве и активации вам приходит сообщение в Telegram. Чужое устройство можно отвязать в один клик.',
          'Ссылка для запасного подключения (Happ и другие) — личная и работает как пароль. Если она попала к чужим, сбросьте её в приложении: «Профиль» → «Запасное подключение» → «Сбросить ссылку». Старая сразу перестанет работать.',
          'Важные действия в системе (новый сервер, ручная выдача доступа) мгновенно видит вся команда.',
        ] },
        { h: 'Приложение' },
        { list: ['Скачивайте Sali VPN только с нашего сайта и из канала. Каждая сборка подписана нашим ключом — подделку с чужой подписью Android не установит поверх настоящей.'] },
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
          'You pay with USDT over the TON blockchain. Card details never reach us.',
          'You get a Telegram message about every new device and activation, and can unlink a stranger’s device in one tap.',
          'Your backup link (Happ and others) is personal and works like a password. If someone else got it, reset it in the app: “Profile” → “Backup connection” → “Reset link”. The old one stops working at once.',
          'The whole team instantly sees sensitive actions in the system (a new server, access granted by hand).',
        ] },
        { h: 'The app' },
        { list: ['Download Sali VPN only from our website and channel. Every build is signed with our key — Android will not install a fake with someone else’s signature over the real app.'] },
        { note: 'We deliberately do not publish the details of our defences: the less an attacker knows about how the system is built, the harder it is to attack. Found a vulnerability? Write to support — we’ll reply personally.' },
      ],
    },
  },
  {
    slug: 'payments',
    group: 'account',
    title: { ru: 'Оплата', en: 'Payments' },
    lead: { ru: 'Оплата — прямо в приложении. Подписка сразу появляется на вашем аккаунте, без кодов.', en: 'You pay right in the app. The plan lands on your account at once — no codes.' },
    body: {
      ru: [
        { facts: [['Способы', 'USDT (сеть TON)'], ['Устройств', 'до 3 на подписку'], ['Автосписания', 'нет']] },
        { list: [
          'В приложении: «Подписка» → тариф → «Открыть кошелёк» или переведите вручную: сумма, адрес и комментарий копируются одним нажатием.',
          'Платите с любого кошелька: Telegram Wallet, Tonkeeper, биржа. Обязательно вставьте комментарий к переводу.',
          'Для оплаты один раз привяжите Telegram — подписка будет на вашем аккаунте.',
          'Если подписка уже есть, новая покупка добавит дни к текущим.',
          'Баланс: «Подписка» → «Баланс» → пополните в USDT. С баланса тариф оплачивается в одно нажатие, а автопродление само покупает выбранный тариф за сутки до конца подписки. Не хватит денег — напомним в Telegram. Без автопродления продлевайте сами: «Баланс» → «Продлить с баланса» → выберите срок → «Списать».',
          'Деньги с баланса тратятся только на Sali VPN и не выводятся. Нужен возврат — напишите в поддержку: вернём на кошелёк, с которого пришёл перевод.',
          'Подарок другу: «Подписка» → «Подарить подписку», введите его Sali ID.',
          'Есть промокод? «Подписка» → «Промокод».',
          'Подписка есть, а VPN не подключается? Напишите в поддержку @SaliVPNHelpBot — разберёмся.',
        ] },
        { note: 'Оплатили, а подписки нет? Не платите повторно: обычно перевод подтверждается за минуту, экран оплаты обновится сам. Прошло 10 минут — пишите в поддержку.' },
      ],
      en: [
        { facts: [['Methods', 'USDT (TON network)'], ['Devices', 'up to 3 per plan'], ['Auto-renewal', 'none']] },
        { list: [
          'In the app: “Plan” → pick a plan → “Open wallet”, or transfer by hand: amount, address and comment copy with one tap.',
          'Pay from any wallet: Telegram Wallet, Tonkeeper, an exchange. Always paste the comment.',
          'Link Telegram once to pay — the plan belongs to your account.',
          'With an active plan, a new purchase adds days on top.',
          'Balance: “Plan” → “Balance” → top up in USDT. Pay any plan with one tap, or turn on auto-renewal — it buys your plan a day before the end.',
          'The balance is spent only on Sali VPN and is not paid out. Need a refund? Message support — we send it back to the wallet it came from.',
          'Gift for a friend: “Plan” → “Gift a plan”, enter their Sali ID.',
          'Have a promo code? “Plan” → “Promo code”.',
          'Have a plan but the VPN will not connect? Message support @SaliVPNHelpBot — we will sort it out.',
        ] },
        { note: 'Paid but no plan? Do not pay again: a transfer usually confirms within a minute and the payment screen updates by itself. After 10 minutes, message support.' },
      ],
    },
  },
  {
    slug: 'referrals',
    group: 'account',
    title: { ru: 'Приглашения', en: 'Invites' },
    lead: { ru: 'Другу — 1 день VPN, вам — скидка 10% на следующую оплату.', en: 'Your friend gets 1 day of VPN, you get 10% off your next payment.' },
    body: {
      ru: [
        { steps: [
          'В приложении: «Подписка» → «Пригласить друга» → «Отправить другу».',
          'Друг ставит Sali VPN и вводит ваш Sali ID в «Подписка» → «Промокод».',
          'Друг получает +1 день VPN, а вам — скидка 10% на следующую оплату.',
        ] },
        { list: ['Скидка применяется к следующей покупке автоматически.', 'За каждого друга — отдельная скидка.', 'Бонус работает только для новых пользователей.'] },
      ],
      en: [
        { steps: [
          'In the app: “Plan” → “Invite a friend” → “Send”.',
          'Your friend installs Sali VPN and enters your Sali ID in “Plan” → “Promo code”.',
          'They get +1 day of VPN; you get 10% off your next payment.',
        ] },
        { list: ['The discount applies to your next purchase automatically.', 'Every friend brings a separate discount.', 'Only new users count.'] },
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
          'Проверьте доступ: в приложении во вкладке «Подписка» должна быть активная подписка или бесплатные 3 дня.',
          'Выключите другие VPN, блокировщики рекламы и «Частный DNS».',
          'Переключитесь между Wi-Fi и мобильной сетью.',
          'Выберите другой сервер.',
          'Закройте приложение полностью и откройте снова.',
        ] },
        { note: 'Не помогло — напишите в поддержку и укажите Sali ID. Отвечает живой человек.' },
      ],
      en: [
        { steps: [
          'Check your access: the app’s “Plan” tab should show an active plan or the free 3 days.',
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
