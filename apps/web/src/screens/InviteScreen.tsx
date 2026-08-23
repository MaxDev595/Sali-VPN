import { useEffect, useState } from 'react';
import type { ReferralInfoDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

export function InviteScreen() {
  const [info, setInfo] = useState<ReferralInfoDTO | null>(null); const [error, setError] = useState(false); const [copied, setCopied] = useState(false);
  const load = async () => { setError(false); try { setInfo(await api.getReferralInfo()); } catch { setError(true); } };
  useEffect(() => { void load(); }, []);
  if (error) return <ErrorState onRetry={load} />;
  if (!info) return <div className="px-5 pt-4 space-y-3"><Skeleton className="h-8 w-40" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  async function copy() { await navigator.clipboard.writeText(info!.link); telegram.haptic.success(); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  function share() { window.open(`https://t.me/share/url?url=${encodeURIComponent(info!.link)}&text=${encodeURIComponent('Присоединяйся к Sali VPN и получи ещё 30 минут VPN бесплатно')}`, '_blank'); }
  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Пригласить друга</h1>
      <p className="text-sali-gray-400 text-[15px]">За каждого нового пользователя вы получите скидку {info.discountPercent}% на следующую оплату, а друг — {info.referredTrialBonusMinutes} минут VPN.</p>
      <Card>
        <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-2">Ваша реферальная ссылка</p>
        <p className="text-[14px] break-all text-sali-gray-200 mb-4">{info.link}</p>
        <div className="grid grid-cols-2 gap-3"><Button variant="secondary" onClick={copy}>{copied ? 'Скопировано' : 'Копировать'}</Button><Button onClick={share}>Поделиться</Button></div>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center"><p className="text-2xl font-semibold">{info.totalRewarded}</p><p className="text-sali-gray-500 text-sm mt-1">Зарегистрировалось</p></Card>
        <Card className="text-center"><p className="text-2xl font-semibold">{info.availableDiscounts}</p><p className="text-sali-gray-500 text-sm mt-1">Скидок {info.discountPercent}% доступно</p></Card>
      </div>
      <p className="text-xs leading-relaxed text-sali-gray-500">Бонус начисляется только после создания нового аккаунта. Для уже зарегистрированных аккаунтов ссылка не действует.</p>
    </div>
  );
}
