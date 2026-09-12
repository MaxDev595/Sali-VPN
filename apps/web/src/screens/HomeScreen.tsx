import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HomeStateDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, HomeSkeleton } from '../components/StatusStates';
import { useElapsedTime, useRemainingTime } from '../hooks/useCountdown';
import { useI18n } from '../lib/i18n';

export function HomeScreen() {
  const [state, setState] = useState<HomeStateDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [vpnConfig, setVpnConfig] = useState<{ configText: string; qrCodeDataUrl: string } | null>(null);
  const navigate = useNavigate();
  const { t } = useI18n();

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

  const isProvisioned = state.vpn?.status === 'ACTIVE';
  const trialActive = state.trial?.status === 'ACTIVE' && state.trial.secondsRemaining > 0;

  async function handleToggleConnection() {
    setConnecting(true);
    try {
      const result = await api.connectVpn();
      setVpnConfig(result.config);
      telegram.haptic.success();
      await load();
    } catch (err) {
      telegram.haptic.error();
      setError(err instanceof Error ? err.message : 'Ошибка подключения к VPN-серверу');
    } finally {
      setConnecting(false);
    }
  }

  function downloadConfig() {
    if (!vpnConfig) return;
    const blob = new Blob([vpnConfig.configText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sali-wireguard.conf';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">SALi VPN</h1>

      <Card className="text-center py-8">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-sali-gray-600" />
          <span className="text-xs tracking-widest text-sali-gray-400 uppercase">
            {isProvisioned ? 'Конфигурация готова' : t('vpnOff')}
          </span>
        </div>
        <p className="text-lg font-medium mb-2">VPN на устройстве не включён</p>
        <p className="text-sm text-sali-gray-400 mb-6">Telegram не может включить системный VPN. Получите конфигурацию и импортируйте её в WireGuard.</p>
        <Button onClick={handleToggleConnection} disabled={connecting} variant="primary">
          {connecting ? t('connecting') : 'Получить конфигурацию'}
        </Button>
      </Card>

      {vpnConfig && (
        <Card className="space-y-4">
          <div>
            <p className="text-[15px] font-medium">Подключение через WireGuard</p>
            <p className="text-sm text-sali-gray-400 mt-1">1. Установите WireGuard. 2. Импортируйте файл ниже или отсканируйте QR. 3. Включите туннель в WireGuard — после этого появится системный значок VPN.</p>
          </div>
          <Button onClick={downloadConfig}>Скачать .conf</Button>
          <img src={vpnConfig.qrCodeDataUrl} alt="QR-код конфигурации WireGuard" className="w-52 h-52 mx-auto rounded-xl bg-white p-2" />
        </Card>
      )}

      {isProvisioned && state.vpn && (
        <Card>
          <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-2">Выданная конфигурация</p>
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
            <p className="text-lg mt-2">{t('enjoy')}</p>
          </>
        ) : trialActive ? (
          <>
            <p className="text-[15px] font-medium uppercase tracking-wide">{t('currentSession')}</p>
            <p className="text-3xl font-semibold tabular-nums mt-1">{formatted}</p>
            <p className="text-sali-gray-400 text-xs mb-4">{t('trialLeft')} {remainingFormatted}</p>
            <Button onClick={() => navigate('/app/subscription')} variant="secondary">{t('buy')}</Button>
          </>
        ) : (
          <>
            <p className="text-[15px] text-sali-gray-400 mb-4">{t('trialEnded')}</p>
            <Button onClick={() => navigate('/app/subscription')}>{t('buy')}</Button>
          </>
        )}
      </Card>
    </div>
  );
}
