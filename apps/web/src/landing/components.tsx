import { LandingLanguage } from './i18n';
import { LogoMarkStatic } from './AnimatedLogo';

export const SaliMark = LogoMarkStatic;

export function LanguageSwitch({ language, onChange }: { language: LandingLanguage; onChange: (language: LandingLanguage) => void }) {
  return <div className="sl-language" role="group" aria-label="Language / Язык"><button className={language === 'ru' ? 'active' : ''} onClick={() => onChange('ru')} aria-pressed={language === 'ru'}>RU</button><span>/</span><button className={language === 'en' ? 'active' : ''} onClick={() => onChange('en')} aria-pressed={language === 'en'}>EN</button></div>;
}
