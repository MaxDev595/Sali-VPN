import { FormEvent, useCallback, useEffect, useState } from 'react';
import type { HomeStateDTO, PlanDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

const FEATURES = ['Все серверы и максимальная скорость', 'До трёх устройств', 'Без логов и рекламы', 'Дни добавляются к текущей подписке'];

function period(days: number) { return days >= 360 ? '1 год' : days >= 28 ? `${Math.round(days / 30)} мес.` : `${days} дн.`; }
function formatCode(raw: string) {
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('SALI')) s = s.slice(4);
  const groups = s.slice(0, 12).match(/.{1,4}/g) ?? [];
  return groups.length ? `SALI-${groups.join('-')}` : '';
}

/**
 * Mini App "Подписка": shows the current tariff and the plans, but the
 * purchase itself happens in the bot chat (Stars / USDT / card) which
 * returns an activation code. The code can be entered right here.
 */
export function SubscriptionScreen() {
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [home, setHome] = useState<HomeStateDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    setError(false); setLoading(true);
    try { const [planData, homeData] = await Promise.all([api.getPlans(), api.getHome()]); setPlans(planData); setHome(homeData); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function redeem(event: FormEvent) {
    event.preventDefault();
    if (code.replace(/[^0-9A-Z]/g, '').length !== 16 || redeeming) return;
    setRedeeming(true); setMessage(null);
    try {
      const result = await api.redeemCode(code);
      telegram.haptic.success();
      setCode('');
      setMessage({ ok: true, text: result.kind === 'FREE' ? 'Бесплатные 24 часа включены.' : `Подписка активирована${result.expiresAt ? ` до ${new Date(result.expiresAt).toLocaleDateString('ru-RU')}` : ''}.` });
      await load();
    } catch (cause) {
      telegram.haptic.error();
      setMessage({ ok: false, text: cause instanceof Error ? cause.message : 'Не удалось активировать код' });
    } finally { setRedeeming(false); }
  }

  if (loading) return <div className="px-5 pt-4 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-60 w-full rounded-xl" /></div>;
  if (error) return <ErrorState onRetry={load} />;

  const subscription = home?.subscription;
  const active = subscription?.status === 'ACTIVE';
  const monthly = plans?.find((plan) => plan.durationDays < 60);

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="font-display text-[26px] font-bold tracking-tight">Подписка</h1>

      <Card className={active ? 'border-sali-success/40' : ''}>
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-sali-success shadow-[0_0_12px_#5BE0A8]' : 'bg-sali-gray-600'}`} />
          <div className="flex-1">
            <p className="text-[15px] font-semibold">{active ? subscription!.plan.name : home?.trial?.status === 'ACTIVE' ? '24 часа бесплатно' : 'Нет активного тарифа'}</p>
            <p className="text-sm text-sali-gray-400">{active ? `Действует до ${subscription!.expiresAt ? new Date(subscription!.expiresAt).toLocaleDateString('ru-RU') : '—'}` : 'Оплата и коды — в чате с ботом'}</p>
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        {plans?.map((plan) => {
          const yearly = plan.durationDays >= 360;
          const saving = monthly && plan !== monthly ? Math.round((1 - plan.priceUsd / (monthly.priceUsd * Math.round(plan.durationDays / 30.4))) * 100) : 0;
          return <button key={plan.id} onClick={() => telegram.openBot('buy')} className={`press-feedback relative w-full text-left rounded-xl border p-5 transition-colors ${yearly ? 'border-sali-accent/60 bg-gradient-to-br from-sali-gray-900 to-sali-gray-950' : 'border-sali-gray-800 bg-sali-gray-950'}`}>
            {saving > 0 && <span className="absolute right-4 top-4 rounded-full bg-sali-accent px-2.5 py-1 text-xs font-bold text-sali-navy">−{saving}%</span>}
            <p className="text-sm text-sali-gray-400">{period(plan.durationDays)}</p>
            <p className="mt-1 flex items-baseline gap-2"><span className="font-display text-3xl font-bold">${plan.priceUsd}</span>{plan.originalPriceUsd ? <s className="text-sali-gray-500">${plan.originalPriceUsd}</s> : null}{yearly && <span className="text-sm text-sali-gray-400">· ${(plan.priceUsd / 12).toFixed(2)}/мес</span>}</p>
          </button>;
        })}
        <ul className="space-y-2 px-1 pt-1">{FEATURES.map((item) => <li key={item} className="flex gap-3 text-[15px] text-sali-gray-200"><span className="text-sali-accent">✓</span>{item}</li>)}</ul>
        <Button onClick={() => telegram.openBot('buy')}>Купить в боте · Stars, USDT, карта</Button>
        {!active && !home?.trial && <Button variant="secondary" onClick={() => telegram.openBot('free')}>24 часа бесплатно</Button>}
      </div>

      <Card>
        <form onSubmit={redeem} className="space-y-3">
          <p className="font-semibold">Есть код?</p>
          <input value={code} onChange={(event) => { setCode(formatCode(event.target.value)); setMessage(null); }} placeholder="SALI-XXXX-XXXX-XXXX" maxLength={19} autoCapitalize="characters" className="w-full rounded-lg border border-sali-gray-700 bg-sali-black px-4 py-4 text-center font-mono text-lg tracking-wider text-white outline-none transition-colors placeholder:text-sali-gray-600 focus:border-sali-accent" />
          {message && <p className={`text-center text-sm ${message.ok ? 'text-sali-success' : 'text-sali-danger'}`}>{message.text}</p>}
          <Button type="submit" variant="secondary" disabled={redeeming || code.replace(/[^0-9A-Z]/g, '').length !== 16}>{redeeming ? 'Проверяем…' : 'Активировать код'}</Button>
        </form>
      </Card>
      <p className="text-center text-xs leading-relaxed text-sali-gray-500">После оплаты бот пришлёт код SALI-XXXX-XXXX-XXXX. Его можно активировать здесь, в приложении Sali VPN или подарить.</p>
    </div>
  );
}
