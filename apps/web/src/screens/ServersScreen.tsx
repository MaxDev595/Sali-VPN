import { useEffect, useState } from 'react';
import type { VpnServerDTO } from '@sali/types';
import { api } from '../lib/api';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';
import { useI18n } from '../lib/i18n';

const flags: Record<string, string> = { NL: '🇳🇱', DE: '🇩🇪', US: '🇺🇸' };

export function ServersScreen() {
  const { t } = useI18n();
  const [servers, setServers] = useState<VpnServerDTO[] | null>(null);
  const [error, setError] = useState(false);
  const load = async () => { setError(false); try { setServers(await api.getServers()); } catch { setError(true); } };
  useEffect(() => { void load(); }, []);
  if (error) return <ErrorState onRetry={load} />;
  if (!servers) return <div className="px-5 pt-4 space-y-3"><Skeleton className="h-8 w-32" /><Skeleton className="h-24 w-full" /></div>;
  return <div className="px-5 pt-4 pb-8 space-y-4 screen-enter">
    <h1 className="text-2xl font-semibold tracking-tight">{t('servers')}</h1>
    {servers.map((server) => <Card key={server.id} className={`relative overflow-hidden transition-transform duration-200 ${server.recommended ? 'border-sali-gray-500' : ''}`}>
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flags[server.countryCode] ?? '🌐'}</span>
        <div className="flex-1"><div className="flex items-center gap-2"><p className="font-medium">{server.location}</p><span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${server.premiumOnly ? 'bg-white text-black' : 'border border-sali-gray-600'}`}>{server.premiumOnly ? t('premium') : t('free')}</span></div><p className="text-sm text-sali-gray-500">{server.city} · {server.pingMs} ms · {t('load')} {Math.round(server.currentLoad / server.capacity * 100)}%</p></div>
      </div>
      {server.recommended && <p className="mt-3 text-xs text-sali-gray-300 animate-pulse">{t('closest')} · {t('free')}</p>}
      {server.premiumOnly && <p className="mt-3 text-xs text-sali-gray-500">{t('availableWithSubscription')}</p>}
    </Card>)}
  </div>;
}
