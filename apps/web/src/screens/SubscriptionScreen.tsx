import { useEffect, useState } from 'react';
import type { PlanDTO, SubscriptionDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

const FEATURES = ['Высокая скорость', 'Защищённое соединение', 'Несколько стран', 'Без регистрации', 'До трёх устройств', 'Стабильная работа'];

export function SubscriptionScreen() {
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const load = async () => {
    setError(false); setLoading(true);
    try { const [planData, subData] = await Promise.all([api.getPlans(), api.getMySubscription()]); setPlans(planData); setSubscription(subData); }
    catch { setError(true); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  if (loading) return <div className="px-5 pt-4 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-60 w-full rounded-xl" /></div>;
  if (error) return <ErrorState onRetry={load} />;
  const plan = plans?.[0];
  const active = subscription?.status === 'ACTIVE';
  async function purchase() { if (!plan) return; setPurchasing(true); try { await api.purchase(plan.id); telegram.haptic.success(); await load(); } catch { telegram.haptic.error(); setError(true); } finally { setPurchasing(false); } }
  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Моя подписка</h1>
      <Card>{active && subscription ? <div className="space-y-3"><Row label="Статус" value="Активна" /><Row label="Тариф" value={subscription.plan.name} /><Row label="Стоимость" value={`$${subscription.plan.priceUsd} в месяц`} /><Row label="Действует до" value={subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU') : '—'} /><p className="pt-2 text-center">Приятного пользования!</p></div> : <p className="text-center py-6 text-sali-gray-400">Подписка не активна</p>}</Card>
      {!active && plan && <Card><h2 className="text-xl font-semibold mb-1">{plan.name}</h2><div className="flex items-baseline gap-2 mb-1"><span className="text-3xl font-semibold">${plan.priceUsd}</span><span className="text-sali-gray-400">в месяц</span></div>{plan.originalPriceUsd && <div className="flex items-center gap-2 mb-5"><span className="text-sali-gray-500 line-through">${plan.originalPriceUsd}</span><span className="text-sali-accent text-sm font-medium">скидка 38%</span></div>}<ul className="space-y-2 mb-6">{FEATURES.map((feature) => <li key={feature} className="flex items-center gap-2 text-[15px] text-sali-gray-200"><span className="text-sali-gray-500">—</span>{feature}</li>)}</ul><Button onClick={purchase} disabled={purchasing}>{purchasing ? 'Оформление…' : 'Купить подписку'}</Button></Card>}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between text-[15px]"><span className="text-sali-gray-400">{label}</span><span>{value}</span></div>; }
