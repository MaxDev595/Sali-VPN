import type { VPNServer } from '../types';

/**
 * Shown only while the API is unreachable. Real locations come from GET /servers;
 * these have no ids the API knows, so connecting from them lets the API pick the server.
 */
export const fallbackServers: VPNServer[] = [
  { id: 'local-nl', country: 'Нидерланды', countryCode: 'NL', city: 'Амстердам', ping: null, load: null, availability: true, premiumOnly: false, access: 'free' },
  { id: 'local-de', country: 'Германия', countryCode: 'DE', city: 'Франкфурт', ping: null, load: null, availability: true, premiumOnly: true, access: 'premium' },
  { id: 'local-us', country: 'США', countryCode: 'US', city: 'Нью-Йорк', ping: null, load: null, availability: true, premiumOnly: true, access: 'premium' },
];

export const COUNTRY_NAMES: Record<string, { ru: string; en: string }> = {
  NL: { ru: 'Нидерланды', en: 'Netherlands' }, DE: { ru: 'Германия', en: 'Germany' }, FI: { ru: 'Финляндия', en: 'Finland' },
  US: { ru: 'США', en: 'United States' }, CH: { ru: 'Швейцария', en: 'Switzerland' }, SE: { ru: 'Швеция', en: 'Sweden' },
  NO: { ru: 'Норвегия', en: 'Norway' }, FR: { ru: 'Франция', en: 'France' }, GB: { ru: 'Великобритания', en: 'United Kingdom' },
  PL: { ru: 'Польша', en: 'Poland' }, TR: { ru: 'Турция', en: 'Turkey' }, KZ: { ru: 'Казахстан', en: 'Kazakhstan' },
  AT: { ru: 'Австрия', en: 'Austria' }, CA: { ru: 'Канада', en: 'Canada' }, JP: { ru: 'Япония', en: 'Japan' }, SG: { ru: 'Сингапур', en: 'Singapore' },
};

export const FLAGS: Record<string, string> = { NL: '🇳🇱', DE: '🇩🇪', FI: '🇫🇮', US: '🇺🇸', CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴', FR: '🇫🇷', GB: '🇬🇧', PL: '🇵🇱', TR: '🇹🇷', KZ: '🇰🇿', AT: '🇦🇹', CA: '🇨🇦', JP: '🇯🇵', SG: '🇸🇬' };
