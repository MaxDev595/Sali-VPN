import { useEffect, useState } from 'react';

export type LandingLanguage = 'ru' | 'en';

export function getLandingLanguage(): LandingLanguage {
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query === 'ru' || query === 'en') return query;
  const saved = localStorage.getItem('sali-landing-language');
  if (saved === 'ru' || saved === 'en') return saved;
  return navigator.language.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function useLandingLanguage() {
  const [language, setLanguageState] = useState<LandingLanguage>(getLandingLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (next: LandingLanguage) => {
    setLanguageState(next);
    localStorage.setItem('sali-landing-language', next);
    document.documentElement.lang = next;
  };

  return { language, setLanguage };
}
