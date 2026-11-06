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

const APP_VERSION: Record<Platform, string> = { android: '0.5.1', windows: '0.5.0' };

const t = {
  ru: {
    back: 'На главную', eyebrow: 'Скачать', title: 'Sali VPN на телефон и компьютер',
    lead: 'Выберите своё устройство, скачайте приложение и подключитесь за пару минут.',
    detected: 'Похоже, у вас', recommended: 'Рекомендуем',
    android: { name: 'Android', sub: 'Телефон или планшет', req: 'Android 7.0 и новее · ~35 МБ', main: 'Скачать APK', alt: 'Google Play' },
    windows: { name: 'Windows', sub: 'Компьютер или ноутбук', req: 'Windows 10 / 11, 64-бит · ~90 МБ', main: 'Скачать установщик', alt: 'Портативная версия' },
    apple: { name: 'iPhone и Mac', sub: 'Пока не поддерживается', text: 'Sali VPN работает на Android и Windows. Один код активирует одно устройство.' },
    version: 'Версия', free: '24 часа бесплатно', freeText: 'После установки получите в боте бесплатный код на 24 часа.',
    guideEyebrow: 'Инструкция', guideTitle: 'Как установить и подключиться', tabs: { android: 'Android', windows: 'Windows' },
    stepsAndroid: [
      { icon: 'download', title: 'Скачайте приложение', text: 'Нажмите «Скачать APK» на этой странице прямо с телефона. Или установите Sali VPN из Google Play.' },
      { icon: 'lock', title: 'Разрешите установку', text: 'Откройте скачанный файл sali-vpn.apk. Если Android спросит — разрешите браузеру «Установку неизвестных приложений» и нажмите «Установить».', tip: 'Это стандартный запрос Android для приложений не из Google Play.' },
      { icon: 'key', title: 'Откройте Sali VPN', text: 'Приложение сразу создаст ваш Sali ID (например, SL-7K4P-Q2M9). Регистрация и пароли не нужны.' },
      { icon: 'telegram', title: 'Привяжите Telegram', text: 'Нажмите «Привязать Telegram» — откроется бот Sali, и он запомнит ваше устройство.' },
      { icon: 'gift', title: 'Получите код', text: 'В боте выберите «24 часа бесплатно» или купите подписку на месяц / год. Бот пришлёт код SALI-XXXX-XXXX-XXXX.' },
      { icon: 'check', title: 'Введите код и подключитесь', text: 'В приложении нажмите «Ввести код» (или «Активировать на моём устройстве» в боте), затем большую кнопку подключения. Android один раз попросит разрешить VPN — нажмите «ОК».' },
    ] as Step[],
    stepsWindows: [
      { icon: 'download', title: 'Скачайте установщик', text: 'Нажмите «Скачать установщик» — загрузится файл SaliVPN-Setup.exe.' },
      { icon: 'shield', title: 'Запустите установку', text: 'Откройте файл. Если появится окно SmartScreen «Windows защитила ваш компьютер», нажмите «Подробнее» → «Выполнить в любом случае».', tip: 'Так Windows реагирует на новые программы без платной подписи. Файл скачивается только с официального GitHub Sali VPN.' },
      { icon: 'lock', title: 'Разрешите права администратора', text: 'Они нужны, чтобы создать защищённое VPN-подключение. Если на компьютере нет WireGuard, Sali VPN установит его сам — ничего настраивать не нужно.' },
      { icon: 'key', title: 'Откройте Sali VPN', text: 'Ярлык появится на рабочем столе и в меню «Пуск». Приложение покажет ваш Sali ID.' },
      { icon: 'telegram', title: 'Получите код в боте', text: 'Нажмите «Привязать Telegram» или откройте бота вручную, возьмите 24 часа бесплатно или подписку.' },
      { icon: 'check', title: 'Введите код и подключитесь', text: 'Нажмите «Ввести код», вставьте код (Ctrl+V) и нажмите «Подключить». Значок Sali в трее показывает статус.' },
    ] as Step[],
    infoEyebrow: 'Полезно знать', infoTitle: 'Всё о кодах и устройствах',
    info: [
      ['key', 'Код — одноразовый', 'Каждый код активируется один раз на одном устройстве. Купленный код можно подарить — он действует 90 дней до активации.'],
      ['clock', '24 часа бесплатно', 'Один раз на аккаунт Telegram — 24 часа VPN без ограничений с момента активации кода.'],
      ['devices', 'Несколько устройств', 'Один код — одно устройство. Купите код для каждого телефона или компьютера и активируйте его кнопкой в боте.'],
      ['star', 'Продление', 'Автосписаний нет. Новый код добавляет дни к текущей подписке, бот напомнит за 3 дня до окончания.'],
      ['globe', 'Серверы', 'Нидерланды, Германия, США — выбирайте страну в приложении. Список растёт каждый месяц.'],
      ['chat', 'Поддержка', 'Что-то не работает — напишите в бот поддержки, отвечает живой человек.'],
    ] as [string, string, string][],
    reqTitle: 'Системные требования',
    req: [['Android', 'Android 7.0+, 35 МБ свободного места'], ['Windows', 'Windows 10 или 11 (64-бит), права администратора для установки'], ['Интернет', 'Любое подключение: Wi-Fi, мобильный, проводной']],
    troubleTitle: 'Если что-то не получается',
    trouble: [
      ['Не устанавливается APK', 'Проверьте, что разрешили установку из браузера (Настройки → Приложения → Специальный доступ → Установка неизвестных приложений). Если стоит старая версия из другого источника — удалите её.'],
      ['Windows блокирует файл', 'В окне SmartScreen нажмите «Подробнее» → «Выполнить в любом случае». Антивирус может попросить подтверждение — добавьте Sali VPN в исключения.'],
      ['Код не принимается', 'Код вводится без пробелов, регистр и дефисы не важны. Если пишет «уже активирован» — проверьте раздел «Мои коды» в боте.'],
      ['VPN подключился, но сайты не открываются', 'Смените сервер в приложении и переподключитесь. На Windows закройте другие VPN-программы.'],
      ['Как удалить Sali VPN?', 'Android — как обычное приложение. Windows — «Параметры → Приложения → Sali VPN → Удалить».'],
    ] as [string, string][],
    safety: 'Загрузки идут с официального GitHub Sali VPN. Версия и контрольные суммы — на странице релизов.',
    releases: 'Все версии', ctaTitle: 'Готово? Возьмите 24 часа бесплатно', ctaText: 'Откройте бота — он пришлёт код за пару секунд.', openBot: 'Открыть бота',
  },
  en: {
    back: 'Back home', eyebrow: 'Download', title: 'Sali VPN for phone and computer',
    lead: 'Pick your device, download the app and connect in a couple of minutes.',
    detected: 'Looks like you are on', recommended: 'Recommended',
    android: { name: 'Android', sub: 'Phone or tablet', req: 'Android 7.0+ · ~35 MB', main: 'Download APK', alt: 'Google Play' },
    windows: { name: 'Windows', sub: 'Desktop or laptop', req: 'Windows 10 / 11, 64-bit · ~90 MB', main: 'Download installer', alt: 'Portable version' },
    apple: { name: 'iPhone and Mac', sub: 'Not supported yet', text: 'Sali VPN runs on Android and Windows. One code activates one device.' },
    version: 'Version', free: '24 hours free', freeText: 'After installing, get a free 24-hour code from the bot.',
    guideEyebrow: 'Guide', guideTitle: 'How to install and connect', tabs: { android: 'Android', windows: 'Windows' },
    stepsAndroid: [
      { icon: 'download', title: 'Download the app', text: 'Tap "Download APK" on this page from your phone, or install Sali VPN from Google Play.' },
      { icon: 'lock', title: 'Allow the install', text: 'Open sali-vpn.apk. If Android asks, allow your browser to "Install unknown apps", then tap Install.', tip: 'This is the standard Android prompt for apps outside Google Play.' },
      { icon: 'key', title: 'Open Sali VPN', text: 'The app creates your Sali ID right away (e.g. SL-7K4P-Q2M9). No sign-up, no passwords.' },
      { icon: 'telegram', title: 'Link Telegram', text: 'Tap "Link Telegram" — the Sali bot opens and remembers your device.' },
      { icon: 'gift', title: 'Get a code', text: 'In the bot choose "24 hours free" or buy a month / year. The bot sends a SALI-XXXX-XXXX-XXXX code.' },
      { icon: 'check', title: 'Enter it and connect', text: 'Tap "Enter code" (or "Activate on my device" in the bot), then the big connect button. Android asks once to allow the VPN — tap OK.' },
    ] as Step[],
    stepsWindows: [
      { icon: 'download', title: 'Download the installer', text: 'Click "Download installer" to get SaliVPN-Setup.exe.' },
      { icon: 'shield', title: 'Run it', text: 'If SmartScreen says "Windows protected your PC", click "More info" → "Run anyway".', tip: 'Windows shows this for new apps without a paid signature. The file comes only from the official Sali VPN GitHub.' },
      { icon: 'lock', title: 'Allow administrator rights', text: 'They are needed to create the secure VPN connection. If WireGuard is missing, Sali VPN installs it for you — nothing to configure.' },
      { icon: 'key', title: 'Open Sali VPN', text: 'Find it on the desktop or in the Start menu. The app shows your Sali ID.' },
      { icon: 'telegram', title: 'Get a code in the bot', text: 'Click "Link Telegram" or open the bot yourself and take 24 hours free or a plan.' },
      { icon: 'check', title: 'Enter it and connect', text: 'Click "Enter code", paste it (Ctrl+V) and press Connect. The Sali tray icon shows the status.' },
    ] as Step[],
    infoEyebrow: 'Good to know', infoTitle: 'Codes and devices',
    info: [
      ['key', 'One-time codes', 'Each code activates once on one device. A purchased code can be gifted — valid for 90 days until activated.'],
      ['clock', '24 hours free', 'Once per Telegram account — 24 hours of unlimited VPN from the moment you activate the code.'],
      ['devices', 'Several devices', 'One code activates one device. Get a code for each phone or computer and activate it from the bot.'],
      ['star', 'Renewal', 'No auto-charges. A new code adds days on top, and the bot reminds you 3 days before the end.'],
      ['globe', 'Servers', 'Netherlands, Germany, USA — pick a country in the app. New locations every month.'],
      ['chat', 'Support', 'Something not working? Message the support bot — a real person answers.'],
    ] as [string, string, string][],
    reqTitle: 'System requirements',
    req: [['Android', 'Android 7.0+, 35 MB free space'], ['Windows', 'Windows 10 or 11 (64-bit), admin rights to install'], ['Internet', 'Any connection: Wi-Fi, mobile, wired']],
    troubleTitle: 'Troubleshooting',
    trouble: [
      ['The APK will not install', 'Make sure your browser may install apps (Settings → Apps → Special access → Install unknown apps). Remove an older version from another source first.'],
      ['Windows blocks the file', 'In SmartScreen click "More info" → "Run anyway". If your antivirus asks, add Sali VPN to its exceptions.'],
      ['The code is rejected', 'Case and dashes do not matter. If it says "already activated", check "My codes" in the bot.'],
      ['Connected but sites do not open', 'Switch the server in the app and reconnect. On Windows, close other VPN apps.'],
      ['How do I uninstall?', 'Android — like any app. Windows — Settings → Apps → Sali VPN → Uninstall.'],
    ] as [string, string][],
    safety: 'Downloads come from the official Sali VPN GitHub. Versions and checksums are on the releases page.',
    releases: 'All versions', ctaTitle: 'Ready? Get 24 hours free', ctaText: 'Open the bot — it sends a code in seconds.', openBot: 'Open the bot',
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
    const alt = id === 'android' ? DOWNLOADS.googlePlay : DOWNLOADS.windowsPortable;
    return <article className={`sv-dl-card${detected === id ? ' is-detected' : ''}`}>
      {detected === id && <em>{c.recommended}</em>}
      <Icon name={id} className="sv-dl-card-icon" />
      <h2>{p.name}</h2><p className="sv-dl-sub">{p.sub}</p>
      <a className="sv-btn sv-btn-peach" href={main}><Icon name="download-glyph-dark" />{p.main}</a>
      <a className="sv-dl-alt" href={alt} target={id === 'android' ? '_blank' : undefined} rel="noreferrer">{p.alt} →</a>
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
        <div className="sv-dl-free"><Icon name="gift" /><div><b>{c.free}</b><span>{c.freeText}</span></div><a className="sv-btn sv-btn-ghost" href={`${DOWNLOADS.bot}?start=free`}><Icon name="telegram-glyph" />{c.openBot}</a></div>
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

    <section className="sv-cta"><div className="sv-wrap"><h2>{c.ctaTitle}</h2><p>{c.ctaText}</p><div className="sv-actions sv-actions-center"><a className="sv-btn sv-btn-peach" href={`${DOWNLOADS.bot}?start=free`}><Icon name="telegram-glyph-dark" />{c.openBot}</a></div></div></section>
  </main>;
}
