import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedLogo, LogoBadge, LogoMarkStatic, LogoWordmark } from '../landing/AnimatedLogo';
import { LanguageSwitch } from '../landing/components';
import { useLandingLanguage } from '../landing/i18n';
import { copy, PRICES } from '../landing/copy';
import '../landing/landing.css';

const env = import.meta.env as Record<string, string | undefined>;
const BOT_URL = (env.VITE_TELEGRAM_BOT_URL ?? 'https://t.me/SaliVPNOfficialBot').replace(/\/$/, '');
const SUPPORT_URL = env.VITE_SUPPORT_URL ?? 'https://t.me/SaliVPNHelpBot';
const STORE_URL = env.VITE_ANDROID_STORE_URL ?? 'https://play.google.com/store/apps/details?id=app.sali.vpn';

/** Fades sections in as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const items = document.querySelectorAll('.sv-reveal');
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    }), { threshold: .14 });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);
}

function PhoneMock() {
  return <div className="sv-phone" aria-hidden="true">
    <div className="sv-phone-screen">
      <div className="sv-phone-top"><LogoBadge className="sv-phone-logo" /><div><b>Sali VPN</b><small>ID SL-7K4P-Q2M9</small></div><span className="sv-phone-code">Ввести код</span></div>
      <p className="sv-phone-status">Ваше соединение защищено</p>
      <div className="sv-phone-button"><span className="sv-phone-halo" /><div className="sv-phone-ring"><div className="sv-phone-core"><LogoMarkStatic ink="#F3F6FC" className="sv-phone-core-logo" /><b>В сети</b><small>ЗАЩИЩЕНО</small></div></div></div>
      <div className="sv-phone-pill"><i />Подписка до <b>03.12.2026</b></div>
      <div className="sv-phone-stats"><div><b>94</b><small>↓ МБИТ/С</small></div><div><b>41</b><small>↑ МБИТ/С</small></div><div><b>32</b><small>ПИНГ МС</small></div></div>
      <div className="sv-phone-server"><span>🇳🇱</span><div><small>ТЕКУЩИЙ СЕРВЕР</small><b>Нидерланды</b><em>Амстердам · 32 мс</em></div><i>›</i></div>
    </div>
  </div>;
}

export function LandingPage() {
  const { language, setLanguage } = useLandingLanguage();
  const c = copy[language];
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [replay, setReplay] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  useReveal();
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 12); onScroll(); window.addEventListener('scroll', onScroll, { passive: true }); return () => window.removeEventListener('scroll', onScroll); }, []);
  const go = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  const monthlyOfYear = (PRICES.year / 12).toFixed(2);
  const saving = Math.round((1 - PRICES.year / (PRICES.month * 12)) * 100);

  return <main className="sv">
    <header className={`sv-nav${scrolled ? ' scrolled' : ''}`}>
      <div className="sv-wrap sv-nav-inner">
        <button className="sv-brand" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}><LogoBadge className="sv-brand-mark" /><LogoWordmark vpn={false} className="sv-brand-word" /></button>
        <nav>{c.nav.map(([id, label]) => <button key={id} onClick={() => go(id)}>{label}</button>)}</nav>
        <LanguageSwitch language={language} onChange={setLanguage} />
        <a className="sv-btn sv-btn-dark sv-nav-cta" href={BOT_URL}>{c.openBot}</a>
      </div>
    </header>

    <section className="sv-hero" id="top">
      <div className="sv-blob sv-blob-a" /><div className="sv-blob sv-blob-b" />
      <div className="sv-wrap sv-hero-grid">
        <div className="sv-hero-copy">
          <button className="sv-hero-logo" onClick={() => setReplay((n) => n + 1)} aria-label="Sali VPN"><AnimatedLogo replayKey={replay} wordmark={false} /></button>
          <p className="sv-badge"><i />{c.heroBadge}</p>
          <h1>{c.heroTitle[0]}<br /><span>{c.heroTitle[1]}</span></h1>
          <p className="sv-lead">{c.heroText}</p>
          <div className="sv-actions">
            <a className="sv-btn sv-btn-peach" href={STORE_URL}>▶ {c.download}</a>
            <a className="sv-btn sv-btn-ghost" href={`${BOT_URL}?start=free`}>✈︎ {c.openBot}</a>
          </div>
          <ul className="sv-trust">{c.trust.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
        <PhoneMock />
      </div>
    </section>

    <section className="sv-section" id="how">
      <div className="sv-wrap">
        <div className="sv-head sv-reveal"><p className="sv-eyebrow">{c.howEyebrow}</p><h2>{c.howTitle}</h2><p>{c.howText}</p></div>
        <ol className="sv-steps">{c.steps.map(([title, body], index) => <li className="sv-reveal" style={{ transitionDelay: `${index * 80}ms` }} key={title}><b>{index + 1}</b><h3>{title}</h3><p>{body}</p>{index === 2 && <code className="sv-code">SALI-7K4P-Q2M9-XR3D</code>}</li>)}</ol>
      </div>
    </section>

    <section className="sv-section sv-section-soft" id="plans">
      <div className="sv-wrap">
        <div className="sv-head sv-reveal"><p className="sv-eyebrow">{c.plansEyebrow}</p><h2>{c.plansTitle}</h2><p>{c.plansText}</p></div>
        <div className="sv-plans">
          <article className="sv-plan sv-reveal"><h3>{c.free}</h3><p className="sv-price"><strong>{PRICES.freeMinutes}</strong><s style={{ textDecoration: "none" }}>{language === "ru" ? "мин" : "min"}</s><span>{c.freeText}</span></p><a className="sv-btn sv-btn-ghost-dark" href={`${BOT_URL}?start=free`}>{c.freeCta}</a></article>
          <article className="sv-plan sv-reveal"><h3>{c.month}</h3><p className="sv-price"><strong>${PRICES.month}</strong><s>${PRICES.monthOld}</s></p><ul>{c.benefits.map((b) => <li key={b}>{b}</li>)}</ul><a className="sv-btn sv-btn-dark" href={`${BOT_URL}?start=buy`}>{c.buyCta}</a></article>
          <article className="sv-plan sv-plan-best sv-reveal"><em>{c.best} · −{saving}%</em><h3>{c.year}</h3><p className="sv-price"><strong>${PRICES.year}</strong><s>${PRICES.yearOld}</s><span>${monthlyOfYear}{c.perMonth}</span></p><ul>{c.benefits.map((b) => <li key={b}>{b}</li>)}</ul><a className="sv-btn sv-btn-peach" href={`${BOT_URL}?start=buy`}>{c.buyCta}</a></article>
        </div>
        <p className="sv-pay">{c.payMethods}</p>
      </div>
    </section>

    <section className="sv-section" id="features">
      <div className="sv-wrap">
        <div className="sv-head sv-reveal"><p className="sv-eyebrow">{c.featuresEyebrow}</p><h2>{c.featuresTitle}</h2></div>
        <div className="sv-features">{c.features.map(([icon, title, body], index) => <article className="sv-reveal" style={{ transitionDelay: `${(index % 3) * 70}ms` }} key={title}><span>{icon}</span><h3>{title}</h3><p>{body}</p></article>)}</div>
      </div>
    </section>

    <section className="sv-section sv-section-soft" id="faq">
      <div className="sv-wrap sv-faq">
        <div className="sv-head sv-reveal"><p className="sv-eyebrow">FAQ</p><h2>{c.faqTitle}</h2></div>
        <div>{c.faqs.map(([q, a], index) => <article key={q} className={openFaq === index ? 'open' : ''}><button aria-expanded={openFaq === index} onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{q}</span><b>+</b></button><div><p>{a}</p></div></article>)}</div>
      </div>
    </section>

    <section className="sv-cta">
      <div className="sv-wrap sv-reveal">
        <div className="sv-cta-card"><AnimatedLogo className="sv-cta-logo" replayKey={replay} /></div>
        <h2>{c.ctaTitle}</h2><p>{c.ctaText}</p>
        <div className="sv-actions sv-actions-center"><a className="sv-btn sv-btn-peach" href={STORE_URL}>▶ {c.download}</a><a className="sv-btn sv-btn-ghost" href={`${BOT_URL}?start=free`}>✈︎ {c.openBot}</a></div>
      </div>
    </section>

    <footer className="sv-footer"><div className="sv-wrap sv-footer-inner"><div className="sv-brand"><LogoBadge className="sv-brand-mark" /><LogoWordmark vpn={false} className="sv-brand-word" /></div><p>{c.footer}</p><nav><a href={SUPPORT_URL}>{c.support}</a><Link to="/privacy">{c.privacy}</Link><Link to="/terms">{c.terms}</Link><a href={BOT_URL}>Telegram</a></nav><small>© {new Date().getFullYear()} Sali VPN</small></div></footer>
  </main>;
}
