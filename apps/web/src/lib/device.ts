import type { DevicePlatform } from '@sali/types';

const DEVICE_KEY_STORAGE = 'sali_device_key';

function getDeviceKey(): string {
  const existing = localStorage.getItem(DEVICE_KEY_STORAGE);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY_STORAGE, generated);
  return generated;
}

function detectPlatform(): DevicePlatform {
  const source = `${navigator.userAgent} ${navigator.platform}`.toLowerCase();
  if (/iphone|ipad|ipod/.test(source)) return 'IOS';
  if (/android/.test(source)) return 'ANDROID';
  if (/windows|win32|win64/.test(source)) return 'WINDOWS';
  if (/macintosh|macintel|mac os/.test(source)) return 'MACOS';
  if (/linux/.test(source)) return 'LINUX';
  return 'OTHER';
}

function deviceName(platform: DevicePlatform): string {
  const names: Record<DevicePlatform, string> = {
    IOS: /ipad/i.test(navigator.userAgent) ? 'iPad' : 'iPhone',
    ANDROID: 'Android',
    WINDOWS: 'Windows PC',
    MACOS: 'Mac',
    LINUX: 'Linux',
    OTHER: 'Устройство',
  };
  return names[platform];
}

export function currentDevice() {
  const platform = detectPlatform();
  return { deviceKey: getDeviceKey(), platform, name: deviceName(platform) };
}
