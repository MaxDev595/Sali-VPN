import { selectOptimalServer } from '../serverSelection';
import type { VPNServer } from '../../types';
const server = (id: string, ping: number, load: number, premiumOnly = false): VPNServer => ({ id, ping, load, premiumOnly, availability: true, country: id, countryCode: id, city: id });
test('selects lowest combined latency and load', () => expect(selectOptimalServer([server('a', 10, 90), server('b', 30, 10)])?.id).toBe('b'));
test('ignores premium in free selection', () => expect(selectOptimalServer([server('a', 1, 1, true), server('b', 50, 50)])?.id).toBe('b'));
