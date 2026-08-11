import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeStateDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, HomeSkeleton } from '../components/StatusStates';
import { useElapsedTime, useRemainingTime } from '../hooks/useCountdown';

export function HomeScreen() {
  const [state, setState] = useState<HomeStateDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      setState(await api.getHome());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const { formatted } = useElapsedTime(
    state?.trial?.sessionSeconds ?? 0,
    Boolean(state?.trial?.isRunning),
  );
  const { formatted: remainingFormatted } = useRemainingTime(
    state?.trial?.secondsRemaining ?? 0,
    Boolean(state?.trial?.isRunning),
  );

  if (loading) return <HomeSkeleton />;
  if (error || !state) return <ErrorState message={error ?? undefined} onRetry={load} />;

  const isConnected = state.vpn?.status === 'ACTIVE';
  const trialActive = state.trial?.status === 'ACTIVE' && state.trial.secondsRemaining > 0;

  async function handleToggleConnection() {
    setConnecting(true);
    try {
      if (isConnected) await api.disconnectVpn();
      else await api.connectVpn();
      telegram.haptic.success();
      await load();
    } catch (err) {
      telegram.haptic.error();
      setError(err instanceof Error ? err.message : 'Ошибка подключения к VPN-серверу');
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">SALi VPN</h1>

      <Card className="text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-sali-accent' : 'bg-sali-gray-600'}`} />
          <span className="text-xs tracking-widest text-sali-gray-400 uppercase">
            {isConnected ? 'VPN активен' : 'VPN выключен'}
          </span>
        </div>
        <p className="text-lg font-medium mb-6">{isConnected ? 'Подключено' : 'Нет подключения'}</p>
        <Button onClick={handleToggleConnection} disabled={connecting} variant={isConnected ? 'secondary' : 'primary'}>
          {connecting ? 'Подключение…' : isConnected ? 'Отключить' : 'Подключить VPN'}
        </Button>
      </Card>

      {isConnected && state.vpn && (
        <Card>
          <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-2">Подключение</p>
          <div className="flex justify-between text-[15px]">
            <span className="text-sali-gray-400">Сервер</span>
            <span>{state.vpn.serverLocation}</span>
          </div>
        </Card>
      )}

      <Card>
        <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-2">Подписка</p>
        {state.subscription ? (
          <>
            <p className="text-[15px] font-medium">{state.subscription.plan.name}</p>
            <p className="text-lg mt-2">Приятного пользования!</p>
          </>
        ) : trialActive ? (
          <>
            <p className="text-[15px] font-medium uppercase tracking-wide">Текущая сессия</p>
            <p className="text-3xl font-semibold tabular-nums mt-1">{formatted}</p>
            <p className="text-sali-gray-400 text-xs mb-4">Осталось пробного времени: {remainingFormatted}</p>
            <Button onClick={() => navigate('/subscription')} variant="secondary">Купить подписку</Button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-sali-gray-400 mb-4">Пробный период закончился</p>
            <Button onClick={() => navigate('/subscription')}>Купить подписку</Button>
          </>
        )}
      </Card>
    </div>
  );
}
