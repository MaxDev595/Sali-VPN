import type { VPNStatus } from '../types';
export type VpnEvent = 'CONNECT' | 'CONNECTED' | 'DISCONNECT' | 'DISCONNECTED' | 'FAIL' | 'RETRY';
const transitions: Record<VPNStatus, Partial<Record<VpnEvent, VPNStatus>>> = { disconnected: { CONNECT: 'connecting' }, connecting: { CONNECTED: 'connected', FAIL: 'error', DISCONNECT: 'disconnecting' }, connected: { DISCONNECT: 'disconnecting', FAIL: 'error' }, disconnecting: { DISCONNECTED: 'disconnected', FAIL: 'error' }, error: { RETRY: 'connecting', DISCONNECT: 'disconnecting' } };
export function transitionVpn(status: VPNStatus, event: VpnEvent): VPNStatus { return transitions[status][event] ?? status; }
