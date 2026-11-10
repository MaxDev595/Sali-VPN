import { Fragment, ReactNode, useEffect } from 'react';
import { Link } from 'react-router-dom';
import privacyRu from '../landing/privacy.ru.md?raw';
import privacyEn from '../landing/privacy.en.md?raw';
import termsRu from '../landing/terms.ru.md?raw';
import termsEn from '../landing/terms.en.md?raw';
import { LanguageSwitch } from '../landing/components';
import { LogoBadge, LogoWordmark } from '../landing/AnimatedLogo';
import '../landing/landing.css';
import { useLandingLanguage } from '../landing/i18n';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|https?:\/\/\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|@[A-Za-z0-9_]+)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (/^https?:\/\//.test(part)) return <a key={index} href={part} target="_blank" rel="noreferrer">{part}</a>;
    if (/^[\w.+-]+@/.test(part)) return <a key={index} href={`mailto:${part}`}>{part}</a>;
    if (/^@[A-Za-z0-9_]+$/.test(part)) return <a key={index} href={`https://t.me/${part.slice(1)}`} target="_blank" rel="noreferrer">{part}</a>;
    return <Fragment key={index}>{part.replace(/\\$/,'')}</Fragment>;
  });
}

function MarkdownDocument({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r/g, '').split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line || line === '---') { i++; continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = `h${Math.min(heading[1].length, 3)}` as 'h1' | 'h2' | 'h3';
      blocks.push(<Tag key={i}>{inline(heading[2])}</Tag>); i++; continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('- ')) items.push(lines[i++].trim().slice(2).replace(/;$/, ''));
      blocks.push(<ul key={i}>{items.map((item, j) => <li key={j}>{inline(item)}</li>)}</ul>); continue;
    }
    if (line.startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i++].trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
        if (!cells.every((cell) => /^:?-{3,}:?$/.test(cell))) rows.push(cells);
      }
      const [head, ...body] = rows;
      blocks.push(<div key={i} className="sl-legal-table"><table>
        <thead><tr>{head.map((cell, j) => <th key={j}>{inline(cell)}</th>)}</tr></thead>
        <tbody>{body.map((row, r) => <tr key={r}>{row.map((cell, j) => <td key={j}>{inline(cell)}</td>)}</tr>)}</tbody>
      </table></div>); continue;
    }
    const paragraph: string[] = [];
    // A line ending with "\" or two spaces is a hard line break (Markdown); otherwise lines join.
    const breaks: boolean[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s/.test(lines[i].trim()) && !lines[i].trim().startsWith('- ') && !lines[i].trim().startsWith('|') && lines[i].trim() !== '---') {
      const raw = lines[i++];
      breaks.push(/(\\|\s{2})$/.test(raw.replace(/\r$/, '')));
      paragraph.push(raw.trim().replace(/\\$/, '').trim());
    }
    blocks.push(<p key={i}>{paragraph.map((text, j) => <Fragment key={j}>{inline(text)}{j < paragraph.length - 1 ? (breaks[j] ? <br /> : ' ') : null}</Fragment>)}</p>);
  }
  return <article className="sl-legal-content">{blocks}</article>;
}

export function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  const { language, setLanguage } = useLandingLanguage();
  const source = type === 'privacy' ? (language === 'ru' ? privacyRu : privacyEn) : (language === 'ru' ? termsRu : termsEn);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [type, language]);
  return <main className="sv-legal">
    <header className="sv-legal-nav"><div className="sv-wrap"><Link className="sv-brand" to="/" aria-label={language === 'ru' ? 'На главную' : 'Back to home'}><LogoBadge className="sv-brand-mark"/><LogoWordmark vpn={false} className="sv-brand-word"/></Link><div><Link to="/">← {language === 'ru' ? 'На главную' : 'Back home'}</Link><LanguageSwitch language={language} onChange={setLanguage}/></div></div></header>
    <div className="sl-legal-layout sv-wrap"><aside><span>LEGAL / {type.toUpperCase()}</span><nav><Link className={type === 'privacy' ? 'active' : ''} to="/privacy">{language === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy'}</Link><Link className={type === 'terms' ? 'active' : ''} to="/terms">{language === 'ru' ? 'Условия использования' : 'Terms of Use'}</Link></nav></aside><MarkdownDocument source={source}/></div>
  </main>;
}
