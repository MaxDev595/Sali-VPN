import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { VPNStatus } from '../../types';

export interface NativeSession { status: VPNStatus; connectedAt: number; serverId: string; label: string }
type NativeVpnModule = { prepare(): Promise<boolean>; connect(config: string, label: string, serverId: string): Promise<void>; getSession?(): Promise<NativeSession>; disconnect(): Promise<void>; getStatus(): Promise<VPNStatus>; getDeviceKey(): Promise<string> };
const nativeModule = NativeModules.SaliVpn as NativeVpnModule | undefined;
export class VpnUnavailableError extends Error {}
export const vpnEngine = {
  async prepare() { if (!nativeModule) throw new VpnUnavailableError(`Нативный VPN-модуль не включён в ${Platform.OS} build`); return nativeModule.prepare(); },
  /** label and serverId go to the ongoing notification and survive the app being closed. */
  async connect(config: string, label = '', serverId = '') { if (!nativeModule) throw new VpnUnavailableError('Установите development/production build с SaliVpn module'); await nativeModule.connect(config, label, serverId); },
  async session(): Promise<NativeSession | null> { return nativeModule?.getSession ? nativeModule.getSession() : null; },
  async disconnect() { if (!nativeModule) throw new VpnUnavailableError('SaliVpn module недоступен'); await nativeModule.disconnect(); },
  async status(): Promise<VPNStatus> { return nativeModule ? nativeModule.getStatus() : 'disconnected'; },
  async deviceKey(): Promise<string> { if (!nativeModule) throw new VpnUnavailableError('Не удалось определить устройство'); return nativeModule.getDeviceKey(); },
  subscribe(listener: (status: VPNStatus) => void) { if (!nativeModule) return () => {}; const sub = new NativeEventEmitter(NativeModules.SaliVpn).addListener('vpnStatusChanged', listener); return () => sub.remove(); },
};
