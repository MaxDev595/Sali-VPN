import { useEffect, useState } from 'react';
import type { ReferralInfoDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

export function InviteScreen() {
  const [info, setInfo] = useState<ReferralInfoDTO | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setError(false);
    try {
      setInfo(await api.getReferralInfo());
    } catch {
      setError(true);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState onRetry={load} />;
  if (!info) {
    return (
      <div className="px-5 pt-4 space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(info!.link);
    telegram.haptic.success();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function handleShare() {
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(info!.link)}&text=${encodeURIComponent(
      'Присоединяйся к Sali VPN 🖤',
    )}`;
    window.open(shareUrl, '_blank');
  }

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Пригласи друга</h1>
      <p className="text-sali-gray-400 text-[15px]">
        Поделись Sali VPN и получай бонусы.
      </p>

      <Card>
        <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-2">Ваша ссылка</p>
        <p className="text-[14px] break-all text-sali-gray-200 mb-4">{info.link}</p>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={handleCopy}>
            {copied ? 'Скопировано ✓' : '🔗 Моя ссылка'}
          </Button>
          <Button onClick={handleShare}>📤 Поделиться</Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-semibold">{info.totalInvited}</p>
          <p className="text-sali-gray-500 text-sm mt-1">Приглашено</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-semibold">{info.rewardDaysEarned}</p>
          <p className="text-sali-gray-500 text-sm mt-1">Дней в бонус</p>
        </Card>
      </div>
    </div>
  );
}
