import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LogoBadge, LogoWordmark } from '../landing/AnimatedLogo';
import { LanguageSwitch } from '../landing/components';
import { useLandingLanguage, type LandingLanguage } from '../landing/i18n';
import { DOWNLOADS } from '../lib/downloads';
import { Icon } from './LandingPage';
import '../landing/landing.css';

type Platform = 'android' | 'windows';
type Step = { icon: string; title: string; text: string; tip?: string };

const APP_VERSION: Record<Platform, string> = { android: '0.6.0', windows: '0.6.0' };

const t = {
  ru: {
    back: 'На главную', eyebrow: 'Скачать', title: 'Sali VPN на телефон и компьютер',
    lead: 'Выберите своё устройство, скачайте приложение и подключитесь за пару минут.',
    detected: 'Похоже, у вас', recommended: 'Рекомендуем',
    android: { name: 'Android', sub: 'Телефон или планшет', req: 'Android 7.0 и новее · ~35 МБ', main: 'Скачать APK', alt: 'Как установить' },
    windows: { name: 'Windows', sub: 'Компьютер или ноутбук', req: 'Windows 10 / 11, 64-бит · ~90 МБ', main: 'Скачать установщик', alt: 'Портативная версия' },
    apple: { name: 'iPhone и Mac', sub: 'Пока не поддерживается', text: 'Sali VPN работает на Android и Windows. Одна подписка — до 3 устройств.' },
    version: 'Версия', free: '3 дня бесплатно', freeText: 'Установите приложение и нажмите «Включить» — 3 дня бесплатно, без регистрации.',
    guideEyebrow: 'Инструкция', guideTitle: 'Как установить и подключиться', tabs: { android: 'Android', windows: 'Windows' },
    stepsAndroid: [
      { icon: 'download', title: 'Скачайте приложение', text: 'Нажмите «Скачать APK» на этой странице прямо с телефона.' },
      { icon: 'lock', title: 'Разрешите установку', text: 'Откройте скачанный файл sali-vpn.apk. Если Android спросит — разрешите браузеру «Установку неизвестных приложений» и нажмите «Установить».', tip: 'Это стандартный запрос Android для приложений не из Google Play.' },
      { icon: 'check', title: 'Нажмите «Включить»', text: 'Откройте Sali VPN и нажмите большую кнопку. Android один раз попросит разрешить VPN — нажмите «ОК». Первые 3 дня — бесплатно, без регистрации.' },
      { icon: 'telegram', title: 'Оформите подписку', text: 'Во вкладке «Подписка» выберите тариф и оплатите в USDT. Для оплаты один раз привяжите Telegram — подписка будет на вашем аккаунте и заработает на всех ваших устройствах.' },
    ] as Step[],
    stepsWindows: [
      { icon: 'download', title: 'Скачайте установщик', text: 'Нажмите «Скачать установщик» — загрузится файл SaliVPN-Setup.exe.' },
      { icon: 'shield', title: 'Запустите установку', text: 'Откройте файл. Если появится окно SmartScreen «Windows защитила ваш компьютер», нажмите «Подробнее» → «Выполнить в любом случае».', tip: 'Так Windows реагирует на новые программы без платной подписи. Файл скачивается только с официального GitHub Sali VPN.' },
      { icon: 'lock', title: 'Разрешите права администратора', text: 'Они нужны, чтобы создать защищённое VPN-подключение. Если на компьютере нет WireGuard, Sali VPN установит его сам — ничего настраивать не нужно.' },
      { icon: 'telegram', title: 'Войдите через Telegram', text: 'Откройте Sali VPN и нажмите «Войти через Telegram», в Telegram — «Запустить». Компьютер подключится к вашему аккаунту — если подписка уже есть, она заработает и здесь.' },
      { icon: 'check', title: 'Подключитесь', text: 'Нажмите на знак Sali в центре окна. Значок в трее показывает статус, VPN работает и со свёрнутым окном.' },
    ] as Step[],
    infoEyebrow: 'Полезно знать', infoTitle: 'Аккаунт и устройства',
    info: [
      ['key', 'Один Sali ID на аккаунт', 'У аккаунта один номер навсегда. Подписка, баланс и подарки лежат на аккаунте и работают во всех ваших приложениях — без кодов. Для оплаты один раз привяжите Telegram.'],
      ['clock', '3 дня бесплатно', 'Просто нажмите «Включить» — без регистрации и привязки. Один раз на устройство и на аккаунт.'],
      ['devices', 'До 3 устройств', 'Телефон, компьютер и ещё одно — привяжите на них тот же Telegram. Лишние удаляются в «Подписка» → «Устройства».'],
      ['star', 'Продление', 'Новая покупка добавляет дни к текущей подписке. Хотите без забот — пополните баланс и включите автопродление; иначе напомним в Telegram за 3 дня до окончания.'],
      ['globe', 'Серверы', 'Нидерланды, Германия, США — выбирайте страну в приложении. Список растёт каждый месяц.'],
      ['chat', 'Поддержка', 'Что-то не работает — напишите в бот поддержки, отвечает живой человек.'],
    ] as [string, string, string][],
    reqTitle: 'Системные требования',
    req: [['Android', 'Android 7.0+, 35 МБ свободного места'], ['Windows', 'Windows 10 или 11 (64-бит), права администратора для установки'], ['Интернет', 'Любое подключение: Wi-Fi, мобильный, проводной']],
    troubleTitle: 'Если что-то не получается',
    trouble: [
      ['Не устанавливается APK', 'Проверьте, что разрешили установку из браузера (Настройки → Приложения → Специальный доступ → Установка неизвестных приложений). Если стоит старая версия из другого источника — удалите её.'],
      ['Windows блокирует файл', 'В окне SmartScreen нажмите «Подробнее» → «Выполнить в любом случае». Антивирус может попросить подтверждение — добавьте Sali VPN в исключения.'],
      ['Не привязывается Telegram', 'В Telegram нажмите «Запустить» — бот ответит «Аккаунт привязан». Если бот молчит — вставьте ему номер, который приложение скопировало перед переходом. Приложение обновится само за пару секунд.'],
      ['VPN подключился, но сайты не открываются', 'Смените сервер в приложении и переподключитесь. На Windows закройте другие VPN-программы.'],
      ['Как удалить Sali VPN?', 'Android — как обычное приложение. Windows — «Параметры → Приложения → Sali VPN → Удалить».'],
    ] as [string, string][],
    safety: 'Загрузки идут с официального GitHub Sali VPN. Версия и контрольные суммы — на странице релизов.',
    releases: 'Все версии', ctaTitle: 'Готово? Возьмите 3 дня бесплатно', ctaText: 'Установите приложение и нажмите «Включить» — бесплатные дни включатся сразу.', openBot: 'Открыть бота',
    channel: 'Скачать в Telegram', channelText: 'Каждая новая версия выходит файлом в нашем канале @SaliVpnNews — удобно, если GitHub грузится медленно. Там же новости и обновления.', openChannel: 'Открыть канал',
  },
  en: {
    back: 'Back home', eyebrow: 'Download', title: 'Sali VPN for phone and computer',
    lead: 'Pick your device, download the app and connect in a couple of minutes.',
    detected: 'Looks like you are on', recommended: 'Recommended',
    android: { name: 'Android', sub: 'Phone or tablet', req: 'Android 7.0+ · ~35 MB', main: 'Download APK', alt: 'How to install' },
    windows: { name: 'Windows', sub: 'Desktop or laptop', req: 'Windows 10 / 11, 64-bit · ~90 MB', main: 'Download installer', alt: 'Portable version' },
    apple: { name: 'iPhone and Mac', sub: 'Not supported yet', text: 'Sali VPN runs on Android and Windows. One plan — up to 3 devices.' },
    version: 'Version', free: '3 days free', freeText: 'Install the app and tap “Turn on” — your free 3 days start right away.',
    guideEyebrow: 'Guide', guideTitle: 'How to install and connect', tabs: { android: 'Android', windows: 'Windows' },
    stepsAndroid: [
      { icon: 'download', title: 'Download the app', text: 'Tap "Download APK" on this page from your phone.' },
      { icon: 'lock', title: 'Allow the install', text: 'Open sali-vpn.apk. If Android asks, allow your browser to "Install unknown apps", then tap Install.', tip: 'This is the standard Android prompt for apps outside Google Play.' },
      { icon: 'check', title: 'Tap “Turn on”', text: 'Open Sali VPN and tap the big button. Android asks once to allow the VPN — tap OK. The first 3 days are free, no sign-up.' },
      { icon: 'telegram', title: 'Get a plan', text: 'In the “Plan” tab pick a plan and pay in USDT. Link Telegram once to pay — the plan belongs to your account and works on all your devices.' },
    ] as Step[],
    stepsWindows: [
      { icon: 'download', title: 'Download the installer', text: 'Click "Download installer" to get SaliVPN-Setup.exe.' },
      { icon: 'shield', title: 'Run it', text: 'If SmartScreen says "Windows protected your PC", click "More info" → "Run anyway".', tip: 'Windows shows this for new apps without a paid signature. The file comes only from the official Sali VPN GitHub.' },
      { icon: 'lock', title: 'Allow administrator rights', text: 'They are needed to create the secure VPN connection. If WireGuard is missing, Sali VPN installs it for you — nothing to configure.' },
      { icon: 'telegram', title: 'Sign in with Telegram', text: 'Open Sali VPN, click "Sign in with Telegram", then "Start" in Telegram. The PC joins your account — an existing plan works here too.' },
      { icon: 'check', title: 'Connect', text: 'Click the Sali mark in the middle of the window. The tray icon shows the status; the VPN keeps working when the window is closed.' },
    ] as Step[],
    infoEyebrow: 'Good to know', infoTitle: 'Account and devices',
    info: [
      ['key', 'One Sali ID per account', 'Your account has one number for life. The plan, balance and gifts live on the account and work in all your apps — no codes. Link Telegram once to pay.'],
      ['clock', '3 days free', 'Just tap “Turn on” — no sign-up, no linking. Once per device and per account.'],
      ['devices', 'Up to 3 devices', 'Phone, computer and one more — link the same Telegram on them. Remove extras in “Plan” → “Devices”.'],
      ['star', 'Renewal', 'No auto-charges. A new purchase adds days on top, and the bot reminds you 3 days before the end.'],
      ['globe', 'Servers', 'Netherlands, Germany, USA — pick a country in the app. New locations every month.'],
      ['chat', 'Support', 'Something not working? Message the support bot — a real person answers.'],
    ] as [string, string, string][],
    reqTitle: 'System requirements',
    req: [['Android', 'Android 7.0+, 35 MB free space'], ['Windows', 'Windows 10 or 11 (64-bit), admin rights to install'], ['Internet', 'Any connection: Wi-Fi, mobile, wired']],
    troubleTitle: 'Troubleshooting',
    trouble: [
      ['The APK will not install', 'Make sure your browser may install apps (Settings → Apps → Special access → Install unknown apps). Remove an older version from another source first.'],
      ['Windows blocks the file', 'In SmartScreen click "More info" → "Run anyway". If your antivirus asks, add Sali VPN to its exceptions.'],
      ['Telegram does not link', 'Tap “Start” in Telegram — the bot replies “Account linked”. If it stays silent, paste the number the app copied before opening Telegram. The app updates by itself in a few seconds.'],
      ['Connected but sites do not open', 'Switch the server in the app and reconnect. On Windows, close other VPN apps.'],
      ['How do I uninstall?', 'Android — like any app. Windows — Settings → Apps → Sali VPN → Uninstall.'],
    ] as [string, string][],
    safety: 'Downloads come from the official Sali VPN GitHub. Versions and checksums are on the releases page.',
    releases: 'All versions', ctaTitle: 'Ready? Get 3 days free', ctaText: 'Install the app and tap “Turn on” — the free days start right away.', openBot: 'Open the bot',
    channel: 'Download in Telegram', channelText: 'Every new version is posted as a file in our channel @SaliVpnNews — handy if GitHub is slow. News and updates are there too.', openChannel: 'Open the channel',
  },
} satisfies Record<LandingLanguage, unknown>;

function detectPlatform(): Platform | 'apple' | null {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod|macintosh/i.test(ua)) return 'apple';
  if (/windows/i.test(ua)) return 'windows';
  return null;
}

function Steps({ steps }: { steps: Step[] }) {
  return <ol className="sv-dl-steps">{steps.map((step, index) => <li key={step.title}>
    <div className="sv-dl-step-icon"><Icon name={step.icon} /><b>{index + 1}</b></div>
    <div><h3>{step.title}</h3><p>{step.text}</p>{step.tip && <p className="sv-dl-tip"><Icon name="shield-glyph" />{step.tip}</p>}</div>
  </li>)}</ol>;
}

export function DownloadPage() {
  const { language, setLanguage } = useLandingLanguage();
  const c = t[language];
  const detected = useMemo(detectPlatform, []);
  const [tab, setTab] = useState<Platform>(detected === 'windows' ? 'windows' : 'android');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  useEffect(() => { window.scrollTo({ top: 0 }); document.title = language === 'ru' ? 'Скачать Sali VPN — Android и Windows' : 'Download Sali VPN — Android & Windows'; }, [language]);

  const card = (id: Platform) => {
    const p = c[id];
    const main = id === 'android' ? DOWNLOADS.apk : DOWNLOADS.windows;
    const alt = id === 'android' ? '#guide' : DOWNLOADS.windowsPortable;
    return <article className={`sv-dl-card${detected === id ? ' is-detected' : ''}`}>
      {detected === id && <em>{c.recommended}</em>}
      <Icon name={id} className="sv-dl-card-icon" />
      <h2>{p.name}</h2><p className="sv-dl-sub">{p.sub}</p>
      <a className="sv-btn sv-btn-peach" href={main}><Icon name="download-glyph-dark" />{p.main}</a>
      <a className="sv-dl-alt" href={alt} onClick={id === 'android' ? (event) => { event.preventDefault(); setTab('android'); document.getElementById('guide')?.scrollIntoView({ behavior: 'smooth' }); } : undefined} rel="noreferrer">{p.alt} →</a>
      <p className="sv-dl-req">{p.req} · {c.version} {APP_VERSION[id]}</p>
    </article>;
  };

  return <main className="sv sv-dl">
    <header className="sv-legal-nav"><div className="sv-wrap"><Link className="sv-brand" to="/" aria-label={c.back}><LogoBadge className="sv-brand-mark" /><LogoWordmark vpn={false} className="sv-brand-word" /></Link><div><Link to="/">← {c.back}</Link><LanguageSwitch language={language} onChange={setLanguage} /></div></div></header>

    <section className="sv-dl-hero">
      <div className="sv-blob sv-blob-a" />
      <div className="sv-wrap">
        <div className="sv-head"><p className="sv-eyebrow">{c.eyebrow}</p><h1>{c.title}</h1><p>{c.lead}</p></div>
        <div className="sv-dl-cards">
          {card('android')}
          {card('windows')}
          <article className={`sv-dl-card sv-dl-card-muted${detected === 'apple' ? ' is-detected' : ''}`}>
            <Icon name="devices" className="sv-dl-card-icon" />
            <h2>{c.apple.name}</h2><p className="sv-dl-sub">{c.apple.sub}</p><p className="sv-dl-note">{c.apple.text}</p>
          </article>
        </div>
        <div className="sv-dl-free sv-dl-channel"><Icon name="telegram" /><div><b>{c.channel}</b><span>{c.channelText}</span></div><a className="sv-btn sv-btn-ghost" href={DOWNLOADS.channel} target="_blank" rel="noreferrer"><Icon name="telegram-glyph" />{c.openChannel}</a></div>
        <div className="sv-dl-free"><Icon name="gift" /><div><b>{c.free}</b><span>{c.freeText}</span></div></div>
      </div>
    </section>

    <section className="sv-section sv-section-soft" id="guide">
      <div className="sv-wrap">
        <div className="sv-head"><p className="sv-eyebrow">{c.guideEyebrow}</p><h2>{c.guideTitle}</h2></div>
        <div className="sv-dl-tabs" role="tablist">{(['android', 'windows'] as Platform[]).map((id) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon name={`${id}-glyph`} />{c.tabs[id]}</button>)}</div>
        <div className="sv-dl-guide">
          <Steps steps={tab === 'android' ? c.stepsAndroid : c.stepsWindows} />
          <figure className={`sv-dl-shot sv-dl-shot-${tab}`}><img src={tab === 'android' ? '/assets/screens/android.png' : '/assets/screens/windows.png'} alt={tab === 'android' ? 'Sali VPN Android' : 'Sali VPN Windows'} loading="lazy" /></figure>
        </div>
      </div>
    </section>

    <section className="sv-section" id="info">
      <div className="sv-wrap">
        <div className="sv-head"><p className="sv-eyebrow">{c.infoEyebrow}</p><h2>{c.infoTitle}</h2></div>
        <div className="sv-features">{c.info.map(([icon, title, body]) => <article key={title}><span><Icon name={icon} /></span><h3>{title}</h3><p>{body}</p></article>)}</div>
        <div className="sv-dl-more">
          <div className="sv-dl-req-table"><h3>{c.reqTitle}</h3><dl>{c.req.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><p className="sv-dl-safety"><Icon name="shield-glyph" />{c.safety} <a href="https://github.com/MaxDev595/Sali-VPN/releases" target="_blank" rel="noreferrer">{c.releases} →</a></p></div>
          <div className="sv-faq sv-dl-faq"><div><h3>{c.troubleTitle}</h3>{c.trouble.map(([q, a], index) => <article key={q} className={openFaq === index ? 'open' : ''}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{q}</span><b>+</b></button><div><p>{a}</p></div></article>)}</div></div>
        </div>
      </div>
    </section>

    <section className="sv-cta"><div className="sv-wrap"><h2>{c.ctaTitle}</h2><p>{c.ctaText}</p><div className="sv-actions sv-actions-center"><a className="sv-btn sv-btn-peach" href={DOWNLOADS.apk}><Icon name="download-glyph-dark" />{c.android.main}</a></div></div></section>
  </main>;
}
