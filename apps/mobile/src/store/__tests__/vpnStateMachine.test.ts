import { transitionVpn } from '../vpnStateMachine';
test('follows connection lifecycle', () => { expect(transitionVpn('disconnected', 'CONNECT')).toBe('connecting'); expect(transitionVpn('connecting', 'CONNECTED')).toBe('connected'); expect(transitionVpn('connected', 'DISCONNECT')).toBe('disconnecting'); expect(transitionVpn('disconnecting', 'DISCONNECTED')).toBe('disconnected'); });
test('ignores invalid transition', () => expect(transitionVpn('connected', 'CONNECTED')).toBe('connected'));
