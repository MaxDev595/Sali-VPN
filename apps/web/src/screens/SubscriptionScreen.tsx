import { useEffect, useState } from 'react';
import type { PlanDTO, SubscriptionDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

const FEATURES = [
  'Fast VPN',
  'Secure connection',
  'Multiple locations',
  'No manual registration',
  'Device support',
  'Stable connection',
];

export function SubscriptionScreen() {
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const load = async () => {
    setError(false);
    setLoading(true);
    try {
      const [plansData, subData] = await Promise.all([api.getPlans(), api.getMySubscription()]);
      setPlans(plansData);
      setSubscription(subData);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="px-5 pt-4 space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }
  if (error) return <ErrorState onRetry={load} />;

  const plan = plans?.[0];

  async function handlePurchase() {
    if (!plan) return;
    setPurchasing(true);
    try {
      await api.purchase(plan.id);
      telegram.haptic.success();
      await load();
    } catch {
      telegram.haptic.error();
      setError(true);
    } finally {
      setPurchasing(false);
    }
  }

  const isActive = subscription?.status === 'ACTIVE';

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Моя подписка</h1>

      <Card>
        {isActive && subscription ? (
          <div className="space-y-3">
            <Row label="Status" value="Активна" />
            <Row label="Plan" value={subscription.plan.name} />
            <Row label="Price" value={`$${subscription.plan.priceUsd}/мес`} />
            <Row
              label="Expiration date"
              value={subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU') : '—'}
            />
            <Row label="Auto-renewal" value={subscription.autoRenew ? 'Включено' : 'Выключено'} />
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sali-gray-400 mb-1">Подписка не активна</p>
          </div>
        )}
      </Card>

      {!isActive && plan && (
        <Card>
          <h2 className="text-xl font-semibold mb-1">{plan.name}</h2>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-semibold">${plan.priceUsd}</span>
            <span className="text-sali-gray-400">/ month</span>
          </div>
          {plan.originalPriceUsd && (
            <div className="flex items-center gap-2 mb-5">
              <span className="text-sali-gray-500 line-through">${plan.originalPriceUsd}</span>
              <span className="text-sali-accent text-sm font-medium">-38%</span>
            </div>
          )}

          <ul className="space-y-2 mb-6">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-[15px] text-sali-gray-200">
                <span className="text-sali-gray-500">—</span>
                {f}
              </li>
            ))}
          </ul>

          <Button onClick={handlePurchase} disabled={purchasing}>
            {purchasing ? 'Оформление…' : 'Купить подписку'}
          </Button>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[15px]">
      <span className="text-sali-gray-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}
