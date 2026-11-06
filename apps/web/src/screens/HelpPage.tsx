import { Fragment, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LogoBadge, LogoWordmark } from '../landing/AnimatedLogo';
import { LanguageSwitch } from '../landing/components';
import { useLandingLanguage, type LandingLanguage } from '../landing/i18n';
import { DOWNLOADS } from '../lib/downloads';
import { ARTICLES, GROUPS, articleBySlug, type Article, type Block } from '../help/articles';
import '../landing/landing.css';
import '../help/help.css';

const UI = {
  ru: { center: 'Справочный центр', title: 'Как работает Sali VPN', lead: 'Короткие ответы без воды. Не нашли нужное — напишите людям в поддержку.', home: 'На главную', all: 'Все статьи', support: 'Написать в поддержку', next: 'Дальше', notFound: 'Такой статьи нет', notFoundText: 'Возможно, ссылка устарела. Вот всё, что у нас есть:', stillStuck: 'Остались вопросы?', stillText: 'В Telegram отвечает живой человек, обычно в течение часа.', privacy: 'Политика конфиденциальности', download: 'Скачать' },
  en: { center: 'Help centre', title: 'How Sali VPN works', lead: 'Short answers, no fluff. Can’t find it — message the humans in support.', home: 'Home', all: 'All articles', support: 'Message support', next: 'Next', notFound: 'No such article', notFoundText: 'The link may be outdated. Here is everything we have:', stillStuck: 'Still have questions?', stillText: 'A real person answers in Telegram, usually within an hour.', privacy: 'Privacy policy', download: 'Download' },
} satisfies Record<LandingLanguage, Record<string, string>>;

function BlockView({ block }: { block: Block }) {
  if ('h' in block) return <h2>{block.h}</h2>;
  if ('p' in block) return block.to ? <p><Link className="sh-inline-link" to={block.to}>{block.p} →</Link></p> : <p>{block.p}</p>;
  if ('list' in block) return <ul className="sh-list">{block.list.map((item) => <li key={item}>{item}</li>)}</ul>;
  if ('steps' in block) return <ol className="sh-steps">{block.steps.map((item, index) => <li key={item}><b>{String(index + 1).padStart(2, '0')}</b><span>{item}</span></li>)}</ol>;
  if ('note' in block) return <aside className="sh-note"><i aria-hidden="true" />{block.note}</aside>;
  return <dl className="sh-facts">{block.facts.map(([term, value]) => <Fragment key={term}><dt>{term}</dt><dd>{value}</dd></Fragment>)}</dl>;
}

function Index({ language, current }: { language: LandingLanguage; current?: string }) {
  return <nav className="sh-index" aria-label={UI[language].all}>
    {(Object.keys(GROUPS) as Article['group'][]).map((group) => <div key={group}>
      <span>{GROUPS[group][language]}</span>
      {ARTICLES.filter((article) => article.group === group).map((article) => <Link key={article.slug} to={`/help/${article.slug}`} className={article.slug === current ? 'active' : ''} aria-current={article.slug === current ? 'page' : undefined}>{article.title[language]}</Link>)}
    </div>)}
  </nav>;
}

function Support({ language }: { language: LandingLanguage }) {
  return <section className="sh-support"><div><h3>{UI[language].stillStuck}</h3><p>{UI[language].stillText}</p></div><a className="sv-btn sv-btn-peach" href={DOWNLOADS.support}>{UI[language].support}</a></section>;
}

export function HelpPage() {
  const { slug } = useParams();
  const { language, setLanguage } = useLandingLanguage();
  const t = UI[language];
  const article = articleBySlug(slug);
  const missing = Boolean(slug) && !article;
  const index = article ? ARTICLES.indexOf(article) : -1;
  const next = index >= 0 ? ARTICLES[(index + 1) % ARTICLES.length] : undefined;

  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = article ? `${article.title[language]} — Sali VPN` : `${t.center} — Sali VPN`;
  }, [slug, language, article, t.center]);

  return <main className="sv-legal sh">
    <header className="sv-legal-nav"><div className="sv-wrap"><Link className="sv-brand" to="/" aria-label={t.home}><LogoBadge className="sv-brand-mark" /><LogoWordmark vpn={false} className="sv-brand-word" /></Link><div><Link to="/help">{t.center}</Link><Link to="/download">{t.download}</Link><LanguageSwitch language={language} onChange={setLanguage} /></div></div></header>

    {!article ? <div className="sv-wrap sh-home" key={`home-${language}`}>
      <p className="sv-eyebrow">{missing ? '404' : t.center}</p>
      <h1>{missing ? t.notFound : t.title}</h1>
      <p className="sh-lead">{missing ? t.notFoundText : t.lead}</p>
      <div className="sh-groups">{(Object.keys(GROUPS) as Article['group'][]).map((group) => <section key={group}>
        <h2>{GROUPS[group][language]}</h2>
        {ARTICLES.filter((item) => item.group === group).map((item, i) => <Link key={item.slug} className="sh-card" style={{ animationDelay: `${i * 50}ms` }} to={`/help/${item.slug}`}><b>{item.title[language]}</b><span>{item.lead[language]}</span><i aria-hidden="true">→</i></Link>)}
      </section>)}</div>
      <Support language={language} />
    </div> : <div className="sv-wrap sh-layout">
      <aside><Index language={language} current={article.slug} /></aside>
      <article className="sh-article" key={`${article.slug}-${language}`}>
        <Link className="sh-crumb" to="/help">← {t.all}</Link>
        <p className="sv-eyebrow">{GROUPS[article.group][language]}</p>
        <h1>{article.title[language]}</h1>
        <p className="sh-lead">{article.lead[language]}</p>
        <div className="sh-body">{article.body[language].map((block, i) => <BlockView key={i} block={block} />)}</div>
        {next && <Link className="sh-next" to={`/help/${next.slug}`}><small>{t.next}</small><b>{next.title[language]}</b><i aria-hidden="true">→</i></Link>}
        <Support language={language} />
      </article>
    </div>}
  </main>;
}
