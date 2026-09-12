import { useEffect, useState } from 'react';
import type { DevicesStateDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';
import { useI18n } from '../lib/i18n';

export function DevicesScreen() {
  const { t } = useI18n();
  const [state, setState] = useState<DevicesStateDTO | null>(null);
  const [error, setError] = useState(false);
  const load = async () => { setError(false); try { setState(await api.getDevices()); } catch { setError(true); } };
  useEffect(() => { void load(); }, []);
  async function remove(id: string) { try { await api.removeDevice(id); telegram.haptic.light(); await load(); } catch { telegram.haptic.error(); } }
  if (error) return <ErrorState onRetry={load} />;
  if (!state) return <div className="px-5 pt-4 space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-16 w-full" /></div>;
  return <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
    <div className="flex items-end justify-between"><div><h1 className="text-2xl font-semibold tracking-tight">{t('myDevices')}</h1><p className="text-sm text-sali-gray-500 mt-1">{t('connectedDevices')}</p></div><div className="text-2xl font-semibold tabular-nums">{state.activeCount}<span className="text-sali-gray-600">/{state.maxDevices}</span></div></div>
    <div className="h-1 rounded-full bg-sali-gray-900 overflow-hidden"><div className="h-full bg-white transition-all duration-500" style={{ width: `${Math.min(100, state.activeCount / state.maxDevices * 100)}%` }} /></div>
    <div className="space-y-3">{state.devices.length === 0 && <p className="text-sali-gray-400 text-[15px]">{t('noDevices')}</p>}{state.devices.map((device) => <Card key={device.id} className="flex items-center justify-between py-4"><div><p className="text-[15px] font-medium">{device.name}</p><p className="text-sali-gray-500 text-sm"><span className={`inline-block w-1.5 h-1.5 rounded-full mr-2 ${device.isActive ? 'bg-sali-accent' : 'bg-sali-gray-600'}`} />{device.isActive ? t('active') : 'Ожидает свободного слота'}</p></div><button onClick={() => remove(device.id)} className="press-feedback text-sali-danger text-sm font-medium">{t('remove')}</button></Card>)}</div>
    <p className="text-xs text-sali-gray-500">Устройства определяются автоматически при открытии приложения через Telegram.</p>
  </div>;
}
