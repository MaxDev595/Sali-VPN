import { useCallback, useEffect, useState } from 'react';
import type { PlanDTO, ReferralInfoDTO, SubscriptionDTO } from '@sali/types';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorState, Skeleton } from '../components/StatusStates';

const FEATURES = ['Высокая скорость', 'Защищённое соединение', 'Несколько стран', 'Без регистрации', 'До трёх устройств', 'Стабильная работа'];

export function SubscriptionScreen() {
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionDTO | null>(null);
  const [referrals, setReferrals] = useState<ReferralInfoDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [cryptoInvoice, setCryptoInvoice] = useState<{ paymentId: string; address: string; amount: string; expiresAt: string; reference?: string; paymentUrl?: string } | null>(null);
  const [paymentMessage, setPaymentMessage] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(false); setLoading(true);
    try { const [planData, subData, referralData] = await Promise.all([api.getPlans(), api.getMySubscription(), api.getReferralInfo()]); setPlans(planData); setSubscription(subData); setReferrals(referralData); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const checkCryptoPayment = useCallback(async (paymentId: string) => {
    const payment = await api.getPayment(paymentId);
    if (payment.status === 'SUCCEEDED') {
      setCryptoInvoice(null);
      setPaymentMessage('Оплата подтверждена. Подписка активирована.');
      await load();
    } else if (payment.status === 'FAILED') {
      setCryptoInvoice(null);
      setPaymentMessage('Срок счёта истёк. Создайте новый счёт.');
    }
  }, [load]);
  useEffect(() => {
    if (!cryptoInvoice) return;
    const timer = window.setInterval(() => void checkCryptoPayment(cryptoInvoice.paymentId).catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [cryptoInvoice, checkCryptoPayment]);
  if (loading) return <div className="px-5 pt-4 space-y-4"><Skeleton className="h-8 w-40" /><Skeleton className="h-60 w-full rounded-xl" /></div>;
  if (error) return <ErrorState onRetry={load} />;
  const plan = plans?.[0];
  const active = subscription?.status === 'ACTIVE';
  const hasDiscount = Boolean(referrals?.availableDiscounts);
  const discountedPrice = plan && hasDiscount ? (plan.priceUsd * (1 - referrals!.discountPercent / 100)).toFixed(2) : null;
  async function purchase(provider: 'paddle' | 'crypto') { if (!plan) return; setPurchasing(true); setPaymentMessage(null); try { const result = await api.purchase(plan.id, provider); telegram.haptic.success(); if (result.checkout.cryptoInvoice) setCryptoInvoice({ paymentId: result.payment.id, ...result.checkout.cryptoInvoice }); else if (result.checkout.checkoutUrl) window.location.assign(result.checkout.checkoutUrl); else await load(); } catch { telegram.haptic.error(); setError(true); } finally { setPurchasing(false); } }
  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Моя подписка</h1>
      {paymentMessage && <Card><p className="text-center text-sm text-sali-gray-200">{paymentMessage}</p></Card>}
      <Card>{active && subscription ? <div className="space-y-3"><Row label="Статус" value="Активна" /><Row label="Тариф" value={subscription.plan.name} /><Row label="Стоимость" value={`$${subscription.plan.priceUsd} в месяц`} /><Row label="Действует до" value={subscription.expiresAt ? new Date(subscription.expiresAt).toLocaleDateString('ru-RU') : '—'} /><p className="pt-2 text-center">Приятного пользования!</p></div> : <p className="text-center py-6 text-sali-gray-400">Подписка не активна</p>}</Card>
      {!active && plan && <Card>{cryptoInvoice ? <div className="space-y-4 text-center"><h2 className="text-xl font-semibold">USDT · сеть TON</h2><div><p className="text-sm text-sali-gray-400">Отправьте точную сумму</p><p className="text-3xl font-semibold mt-1">{cryptoInvoice.amount} USDT</p></div><div><p className="text-sm text-sali-gray-400">Комментарий (обязательно)</p><p className="mt-1 break-all select-all font-medium">{cryptoInvoice.reference}</p></div><div><p className="text-sm text-sali-gray-400">Адрес TON Space</p><p className="mt-1 break-all select-all">{cryptoInvoice.address}</p></div><p className="text-xs text-sali-gray-400">Выберите именно USDT в сети TON. Счёт действует до {new Date(cryptoInvoice.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</p><Button onClick={() => void load()}>Проверить оплату</Button></div> : <><h2 className="text-xl font-semibold mb-1">{plan.name}</h2><div className="flex items-baseline gap-2 mb-1">{hasDiscount && <span className="text-sali-gray-500 line-through">${plan.priceUsd}</span>}<span className="text-3xl font-semibold">${discountedPrice ?? plan.priceUsd}</span><span className="text-sali-gray-400">в месяц</span></div>{hasDiscount ? <p className="text-sm text-sali-gray-300 mb-5">Реферальная скидка {referrals!.discountPercent}% применится автоматически</p> : plan.originalPriceUsd && <div className="flex items-center gap-2 mb-5"><span className="text-sali-gray-500 line-through">${plan.originalPriceUsd}</span></div>}<ul className="space-y-2 mb-6">{FEATURES.map((feature) => <li key={feature} className="flex items-center gap-2 text-[15px] text-sali-gray-200"><span className="text-sali-gray-500">—</span>{feature}</li>)}</ul><div className="space-y-3"><Button onClick={() => void purchase('paddle')} disabled={purchasing}>{purchasing ? 'Оформление…' : 'Оплатить картой'}</Button><Button variant="secondary" onClick={() => void purchase('crypto')} disabled={purchasing}>Оплатить USDT (TON)</Button></div></>}</Card>}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between text-[15px]"><span className="text-sali-gray-400">{label}</span><span>{value}</span></div>; }
