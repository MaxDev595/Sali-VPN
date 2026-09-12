import type { VPNServer } from '../types';

export const fallbackServers: VPNServer[] = [
  { id: 'nl-free', country: 'Нидерланды', countryCode: 'NL', city: 'Амстердам', ping: 34, load: 38, availability: true, premiumOnly: false, access: 'free' },
  { id: 'de-premium', country: 'Германия', countryCode: 'DE', city: 'Франкфурт', ping: 39, load: 27, availability: true, premiumOnly: true, access: 'premium' },
  { id: 'fi-premium', country: 'Финляндия', countryCode: 'FI', city: 'Хельсинки', ping: 43, load: 21, availability: true, premiumOnly: true, access: 'premium' },
  { id: 'ch-premium', country: 'Швейцария', countryCode: 'CH', city: 'Цюрих', ping: 51, load: 31, availability: true, premiumOnly: true, access: 'premium' },
  { id: 'is-soon', country: 'Исландия', countryCode: 'IS', city: 'Рейкьявик', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'se-soon', country: 'Швеция', countryCode: 'SE', city: 'Стокгольм', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'no-soon', country: 'Норвегия', countryCode: 'NO', city: 'Осло', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'fr-soon', country: 'Франция', countryCode: 'FR', city: 'Париж', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'gb-soon', country: 'Великобритания', countryCode: 'GB', city: 'Лондон', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'us-soon', country: 'США', countryCode: 'US', city: 'Нью-Йорк', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'ca-soon', country: 'Канада', countryCode: 'CA', city: 'Торонто', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'jp-soon', country: 'Япония', countryCode: 'JP', city: 'Токио', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'sg-soon', country: 'Сингапур', countryCode: 'SG', city: 'Сингапур', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
  { id: 'au-soon', country: 'Австралия', countryCode: 'AU', city: 'Сидней', ping: 0, load: 0, availability: false, premiumOnly: true, access: 'soon' },
];
