import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { LandingLanguage, landingCopy } from './i18n';

export function SaliMark() {
  return <svg className="sl-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M48 13A23 23 0 1 0 51 35C43 45 34 50 22 47c-5-2-9-5-12-10 10 3 20 2 28-4l11-10 3 6c2 5 1 11-4 16"/><path d="m47 16 7-7 5 5-7 7z" className="sl-mark-accent"/></svg>;
}

export function SectionEyebrow({ children }: { children: ReactNode }) { return <p className="sl-eyebrow"><i/>{children}</p>; }

export function TelegramButton({ href, children }: { href: string; children: ReactNode }) {
  return <a className="sl-button sl-button-primary" href={href}>{children}<span>↗</span></a>;
}

export function LanguageSwitch({ language, onChange }: { language: LandingLanguage; onChange: (language: LandingLanguage) => void }) {
  return <div className="sl-language" role="group" aria-label="Language / Язык"><button className={language === 'ru' ? 'active' : ''} onClick={() => onChange('ru')} aria-pressed={language === 'ru'}>RU</button><span>/</span><button className={language === 'en' ? 'active' : ''} onClick={() => onChange('en')} aria-pressed={language === 'en'}>EN</button></div>;
}

export function LandingNavbar({ botUrl, language, onLanguageChange }: { botUrl: string; language: LandingLanguage; onLanguageChange: (language: LandingLanguage) => void }) {
  const [open, setOpen] = useState(false);
  const c = landingCopy[language];
  const links = c.nav.map((label, index) => [label, ['features','servers','security','pricing','faq'][index]] as const);
  const go = (id:string) => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setOpen(false); };
  return <header className="sl-navbar"><div className="sl-container sl-nav-inner"><button className="sl-logo" onClick={()=>go('top')} aria-label={c.topLabel}><SaliMark/><span>sali <small>VPN</small></span></button><nav className={open?'open':''} aria-label={c.navLabel}>{links.map(([label,id])=><button key={id} onClick={()=>go(id)}>{label}</button>)}<a href={botUrl}>Telegram</a></nav><LanguageSwitch language={language} onChange={onLanguageChange}/><TelegramButton href={botUrl}>{c.connect}</TelegramButton><button className="sl-menu" onClick={()=>setOpen(!open)} aria-expanded={open} aria-label={c.menuLabel}><span/><span/></button></div></header>;
}

export function VpnStatusPanel() {
  return <div className="sl-status-panel"><div className="sl-panel-bar"><span>VPN STATUS / LIVE</span><span>v1.0</span></div><div className="sl-status-main"><div className="sl-connected"><i/><span>STATUS</span><strong>CONNECTED</strong></div><div className="sl-orbit"><div className="sl-node client">YOU</div><svg viewBox="0 0 280 110" aria-hidden="true"><path d="M42 55H238"/><circle cx="92" cy="55" r="3"/><circle cx="140" cy="55" r="3"/><circle cx="188" cy="55" r="3"/></svg><div className="sl-node server">NL-01</div></div></div><div className="sl-status-grid"><div><span>SERVER</span><b>Netherlands</b><small>Amsterdam / NL-01</small></div><div><span>PROTOCOL</span><b>WireGuard</b><small>Encrypted tunnel</small></div><div><span>LATENCY</span><b className="accent">32 ms</b><small>Estimated</small></div><div><span>PUBLIC IP</span><b>•••.•••.42.17</b><small>Masked</small></div></div><div className="sl-transfer"><span>SECURE ROUTE</span><div><i/><i/><i/><i/></div><b>ENCRYPTED</b></div></div>;
}

export function LandingFooter({ botUrl, supportUrl, language }: { botUrl:string; supportUrl:string; language: LandingLanguage }) {
  const c = landingCopy[language];
  const go=(id:string)=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'});
  const [taglineA, taglineB] = c.tagline.split('\n');
  return <footer className="sl-footer"><div className="sl-container sl-footer-grid"><div className="sl-footer-brand"><SaliMark/><b>sali <small>VPN</small></b><p>{taglineA}<br/>{taglineB}</p></div><div><h3>{c.product}</h3><button onClick={()=>go('features')}>{c.featuresLink}</button><button onClick={()=>go('servers')}>{c.serversLink}</button><button onClick={()=>go('pricing')}>{c.pricingLink}</button></div><div><h3>{c.support}</h3><a href={supportUrl}>{c.supportLink}</a><button onClick={()=>go('faq')}>FAQ</button><a href={botUrl}>Telegram</a></div><div><h3>{c.legal}</h3><Link to="/privacy">{c.privacy}</Link><Link to="/terms">{c.terms}</Link></div><p className="sl-copyright">© {new Date().getFullYear()} Sali VPN <span>WIREGUARD INFRASTRUCTURE</span></p></div></footer>;
}
