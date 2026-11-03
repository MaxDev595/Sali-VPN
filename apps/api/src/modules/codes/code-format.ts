import { randomInt } from 'node:crypto';

/** Crockford base32: no I, L, O, U — nothing a customer can misread. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomToken(length: number) {
  let out = '';
  for (let i = 0; i < length; i += 1) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

/** Activation code: 12 symbols (60 bits), shown as SALI-XXXX-XXXX-XXXX. */
export const newActivationCode = () => randomToken(12);
/** Sali ID: 8 symbols, shown as SL-XXXX-XXXX. */
export const newPublicId = () => randomToken(8);

/** Accepts whatever the customer typed: lowercase, spaces, dashes, O/0 and I/1 mix-ups, the "SALI" prefix. */
export function normalizeCode(input: string) {
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('SALI') && s.length === 16) s = s.slice(4);
  return s.replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
}

export function normalizePublicId(input: string) {
  let s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('SL') && s.length === 10) s = s.slice(2);
  return s.replace(/O/g, '0').replace(/[IL]/g, '1');
}

export const formatCode = (code: string) => `SALI-${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
export const formatPublicId = (id: string) => `SL-${id.slice(0, 4)}-${id.slice(4, 8)}`;
