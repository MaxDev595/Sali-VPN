import type { VPNServer } from '../types';
export const fallbackServers: VPNServer[] = [
  { id: 'auto', country: 'Оптимальный сервер', countryCode: 'AUTO', city: 'Автовыбор', ping: 18, load: 20, availability: true, premiumOnly: false },
  { id: 'is-rek', country: 'Исландия', countryCode: 'IS', city: 'Рейкьявик', ping: 28, load: 24, availability: true, premiumOnly: false },
  { id: 'nl-ams', country: 'Нидерланды', countryCode: 'NL', city: 'Амстердам', ping: 35, load: 42, availability: true, premiumOnly: false },
  { id: 'de-fra', country: 'Германия', countryCode: 'DE', city: 'Франкфурт', ping: 41, load: 56, availability: true, premiumOnly: false },
  { id: 'fi-hel', country: 'Финляндия', countryCode: 'FI', city: 'Хельсинки', ping: 48, load: 31, availability: true, premiumOnly: true },
  { id: 'ch-zrh', country: 'Швейцария', countryCode: 'CH', city: 'Цюрих', ping: 55, load: 38, availability: true, premiumOnly: true },
];
