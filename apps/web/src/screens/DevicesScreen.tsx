import { useEffect, useState } from 'react';
import type { DeviceDTO, DevicePlatform } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

const PLATFORM_OPTIONS: { value: DevicePlatform; label: string }[] = [
  { value: 'IOS', label: 'iPhone' },
  { value: 'ANDROID', label: 'Android' },
  { value: 'WINDOWS', label: 'Windows PC' },
  { value: 'MACOS', label: 'Mac' },
  { value: 'LINUX', label: 'Linux' },
  { value: 'OTHER', label: 'Другое' },
];

export function DevicesScreen() {
  const [devices, setDevices] = useState<DeviceDTO[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setError(false);
    try {
      setDevices(await api.getDevices());
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(platform: DevicePlatform, label: string) {
    setAdding(true);
    try {
      await api.addDevice(label, platform);
      telegram.haptic.success();
      await load();
    } catch {
      telegram.haptic.error();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await api.removeDevice(id);
      telegram.haptic.light();
      await load();
    } catch {
      telegram.haptic.error();
    }
  }

  if (error) return <ErrorState onRetry={load} />;
  if (!devices) {
    return (
      <div className="px-5 pt-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Мои устройства</h1>

      <div className="space-y-3">
        {devices.length === 0 && (
          <p className="text-sali-gray-400 text-[15px]">Устройства ещё не добавлены.</p>
        )}
        {devices.map((d) => (
          <Card key={d.id} className="flex items-center justify-between py-4">
            <div>
              <p className="text-[15px] font-medium">{d.name}</p>
              <p className="text-sali-gray-500 text-sm">
                {d.isActive
                  ? 'Active'
                  : d.lastActiveAt
                  ? `Last active ${new Date(d.lastActiveAt).toLocaleString('ru-RU')}`
                  : 'Не активно'}
              </p>
            </div>
            <button
              onClick={() => handleRemove(d.id)}
              className="press-feedback text-sali-danger text-sm font-medium"
            >
              Удалить
            </button>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {PLATFORM_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            variant="secondary"
            disabled={adding}
            onClick={() => handleAdd(opt.value, opt.label)}
            className="py-3 text-sm"
          >
            + {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
