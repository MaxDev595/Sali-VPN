import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { VPNStatus } from '../../types';

type NativeVpnModule = { prepare(): Promise<boolean>; connect(config: string): Promise<void>; disconnect(): Promise<void>; getStatus(): Promise<VPNStatus>; getDeviceKey(): Promise<string> };
const nativeModule = NativeModules.SaliVpn as NativeVpnModule | undefined;
export class VpnUnavailableError extends Error {}
export const vpnEngine = {
  async prepare() { if (!nativeModule) throw new VpnUnavailableError(`Нативный VPN-модуль не включён в ${Platform.OS} build`); return nativeModule.prepare(); },
  async connect(config: string) { if (!nativeModule) throw new VpnUnavailableError('Установите development/production build с SaliVpn module'); await nativeModule.connect(config); },
  async disconnect() { if (!nativeModule) throw new VpnUnavailableError('SaliVpn module недоступен'); await nativeModule.disconnect(); },
  async status(): Promise<VPNStatus> { return nativeModule ? nativeModule.getStatus() : 'disconnected'; },
  async deviceKey(): Promise<string> { if (!nativeModule) throw new VpnUnavailableError('Не удалось определить устройство'); return nativeModule.getDeviceKey(); },
  subscribe(listener: (status: VPNStatus) => void) { if (!nativeModule) return () => {}; const sub = new NativeEventEmitter(NativeModules.SaliVpn).addListener('vpnStatusChanged', listener); return () => sub.remove(); },
};
