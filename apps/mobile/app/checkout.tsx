import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '../src/components/Text';
import { Icon } from '../src/components/Icon';
import { SaliButton } from '../src/components/SaliButton';
import { TelegramLinkCard } from '../src/components/TelegramLinkCard';
import { Card, CopyBox, ErrorNote, Loading, Screen, dateRu, toast } from '../src/components/ui';
import { api, ApiError, type BalancePurchase, type Invoice, type PaymentState } from '../src/services/api/client';
import { useAccountStore } from '../src/store/accountStore';
import { useShopStore } from '../src/store/shopStore';
import { theme } from '../src/theme';

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * USDT (TON) invoice: amount, wallet address and the comment that identifies the payment.
 * The server watches the wallet and confirms by itself; the app asks every 5 seconds.
 */
export default function CheckoutScreen() {
  const params = useLocalSearchParams<{ plan?: string; gift?: string; topup?: string }>();
  const topupAmount = params.topup ? Number(params.topup) : null;
  const refresh = useAccountStore((s) => s.refresh);
  const { promo, setPromo } = useShopStore();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [state, setState] = useState<PaymentState | null>(null);
  const [error, setError] = useState<{ text: string; needsTelegram: boolean } | null>(null);
  const [now, setNow] = useState(Date.now());
  // Enough on the Sali balance: offer paying from it instead of a transfer.
  const [choice, setChoice] = useState<{ balance: number; price: number } | null>(null);
  const [paid, setPaid] = useState<BalancePurchase | null>(null);
  const [paying, setPaying] = useState(false);
  const started = useRef(false);
  const [renewOn, setRenewOn] = useState(false);
  const [renewBusy, setRenewBusy] = useState(false);
  // After a top-up: offer auto-renew with the account's current tariff (30 days if none).
  const enableRenew = async () => {
    setRenewBusy(true);
    try {
      const [p, h] = await Promise.all([api.plans(), api.home()]);
      const code = p.plans.find((x) => x.name === h.subscription?.plan.name)?.code ?? p.plans.find((x) => x.durationDays === 30)?.code ?? 'pro_monthly';
      await api.setAutoRenew(code);
      setRenewOn(true); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); } finally { setRenewBusy(false); }
  };

  const create = useCallback(async () => {
    setError(null); setInvoice(null); setState(null); setChoice(null);
    try {
      if (topupAmount) { setInvoice(await api.topUp(topupAmount)); return; }
      setInvoice(await api.purchase(params.plan!, { giftTo: params.gift || undefined, promo: promo?.code }));
    } catch (e) {
      const needsTelegram = e instanceof ApiError && e.code === 'TELEGRAM_REQUIRED';
      // A promo code that stopped working should not block paying at the normal price.
      if (e instanceof ApiError && promo && /промокод/i.test(e.message)) setPromo(null);
      setError({ text: e instanceof Error ? e.message : 'Не удалось выставить счёт', needsTelegram });
    }
  }, [params.gift, params.plan, promo, setPromo]);

  // First look at the balance: enough → let the customer choose; otherwise straight to the invoice.
  const start = useCallback(async () => {
    if (topupAmount) return create();
    const [b, p] = await Promise.all([api.balance().catch(() => null), api.plans().catch(() => null)]);
    const plan = p?.plans.find((x) => x.code === params.plan);
    if (b?.linked && plan) {
      const percent = Math.max(promo?.percent ?? 0, p?.discountPercent ?? 0);
      const price = Math.round(plan.priceUsd * (100 - percent)) / 100;
      if (b.balanceUsd >= price) { setChoice({ balance: b.balanceUsd, price }); return; }
    }
    return create();
  }, [create, params.plan, promo?.percent, topupAmount]);

  const payFromBalance = async () => {
    setPaying(true); setError(null);
    try {
      const result = await api.payFromBalance(params.plan!, { giftTo: params.gift || undefined, promo: promo?.code });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (promo) setPromo(null);
      setPaid(result); void refresh();
    } catch (e) {
      setError({ text: e instanceof Error ? e.message : 'Не получилось', needsTelegram: e instanceof ApiError && e.code === 'TELEGRAM_REQUIRED' });
    } finally { setPaying(false); }
  };

  useEffect(() => { if (!started.current) { started.current = true; void start(); } }, [start]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // Poll while the invoice is open.
  useEffect(() => {
    if (!invoice || state?.status === 'SUCCEEDED') return;
    const tick = async () => {
      const next = await api.payment(invoice.paymentId).catch(() => null);
      if (!next) return;
      setState(next);
      if (next.status === 'SUCCEEDED') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (promo && !next.topup) setPromo(null);
        void refresh();
      }
    };
    const timer = setInterval(() => void tick(), 5000);
    return () => clearInterval(timer);
  }, [invoice, promo, refresh, setPromo, state?.status]);

  const openWallet = async () => {
    if (!invoice) return;
    const urls = [invoice.tonUrl, invoice.tonkeeperUrl].filter((u): u is string => Boolean(u));
    for (const url of urls) {
      try { await Linking.openURL(url); return; } catch { /* try the next one */ }
    }
    toast('Кошелёк не открылся — скопируйте адрес и комментарий');
  };

  if (paid) {
    return <Screen title={paid.gift ? 'Подарок оплачен' : 'Оплачено'} back={false}>
      <Animated.View entering={ZoomIn.duration(420)} style={styles.successIcon}><Icon name="check" size={46} color={theme.colors.onPrimary} /></Animated.View>
      <Animated.View entering={FadeInDown.delay(150).duration(380)}>
        <Text style={styles.successTitle}>{paid.gift ? `Подписка начислена другу ${params.gift ?? ''}` : `${paid.plan} активна`}</Text>
        <Text style={styles.successText}>Списано ${paid.priceUsd.toFixed(2)} с баланса, осталось ${paid.balanceUsd.toFixed(2)}.{paid.gift ? '' : `\nПодписка до ${dateRu(paid.until)}.`}</Text>
        <View style={{ height: 24 }} />
        <SaliButton title={paid.gift ? 'Готово' : 'Включить VPN'} onPress={() => { router.dismissAll(); router.replace('/'); }} />
      </Animated.View>
    </Screen>;
  }

  if (state?.status === 'SUCCEEDED' && state.topup) {
    return <Screen title="Баланс пополнен" back={false}>
      <Animated.View entering={ZoomIn.duration(420)} style={styles.successIcon}><Icon name="check" size={46} color={theme.colors.onPrimary} /></Animated.View>
      <Animated.View entering={FadeInDown.delay(150).duration(380)}>
        <Text style={styles.successTitle}>+${(state.amountUsd ?? 0).toFixed(2)} на балансе</Text>
        <Text style={styles.successText}>Теперь на балансе ${(state.balanceUsd ?? 0).toFixed(2)}.</Text>
        {state.autoRenew || renewOn
          ? <Card style={{ marginTop: 18 }}><Text style={styles.renewTitle}>Автопродление включено</Text><Text style={styles.renewText}>За сутки до конца подписки стоимость тарифа спишется с баланса сама — VPN не прервётся.</Text></Card>
          : <Card accent style={{ marginTop: 18 }}>
            <Text style={styles.renewTitle}>Включить автопродление?</Text>
            <Text style={styles.renewText}>Подписка будет продлеваться с баланса сама, за сутки до конца, и не прервётся. Без автопродления продлевайте вручную: «Баланс» → «Продлить с баланса».</Text>
            <View style={{ height: 14 }} />
            <SaliButton title="Включить автопродление" loading={renewBusy} onPress={() => void enableRenew()} />
          </Card>}
        <View style={{ height: 16 }} />
        <SaliButton secondary={!(state.autoRenew || renewOn)} title="К балансу" onPress={() => router.back()} />
      </Animated.View>
    </Screen>;
  }

  if (choice && !invoice) {
    return <Screen title="Оплата" subtitle={params.gift ? `Подарок для ${params.gift}` : 'Для вашего аккаунта'}>
      <Card accent>
        <Text style={styles.label}>С БАЛАНСА</Text>
        <View style={styles.amountLine}><Text style={styles.amount}>${choice.price.toFixed(2)}</Text></View>
        <Text style={styles.network}>На балансе ${choice.balance.toFixed(2)} → останется ${(choice.balance - choice.price).toFixed(2)}</Text>
        <View style={{ height: 16 }} />
        <SaliButton title="Оплатить с баланса" loading={paying} onPress={() => void payFromBalance()} />
      </Card>
      {error && <ErrorNote text={error.text} />}
      <View style={{ height: 12 }} />
      <SaliButton secondary title="Перевести USDT" onPress={() => void create()} />
    </Screen>;
  }

  if (state?.status === 'SUCCEEDED') {
    return <Screen title={state.gift ? 'Подарок оплачен' : 'Оплачено'} back={false}>
      <Animated.View entering={ZoomIn.duration(420)} style={styles.successIcon}><Icon name="check" size={46} color={theme.colors.onPrimary} /></Animated.View>
      <Animated.View entering={FadeInDown.delay(150).duration(380)}>
        <Text style={styles.successTitle}>{state.gift ? `Подписка начислена другу ${invoice?.gift ?? ''}` : `${state.plan} активна`}</Text>
        <Text style={styles.successText}>{state.gift
          ? 'Ему придёт уведомление. Чтобы подключиться, другу достаточно открыть Sali VPN и нажать «Включить».'
          : `Действует ${state.until && new Date(state.until).getFullYear() > new Date().getFullYear() + 50 ? 'бессрочно' : `до ${dateRu(state.until)}`}. Работает на всех ваших устройствах.`}</Text>
        <View style={{ height: 24 }} />
        <SaliButton title={state.gift ? 'Готово' : 'Включить VPN'} onPress={() => { router.dismissAll(); router.replace('/'); }} />
      </Animated.View>
    </Screen>;
  }

  const left = invoice ? Math.max(0, Math.floor((Date.parse(invoice.expiresAt) - now) / 1000)) : 0;
  const expired = Boolean(invoice && (left === 0 || state?.expired));

  return <Screen title={topupAmount ? 'Пополнение' : 'Оплата'} subtitle={invoice ? (invoice.topup ? 'Деньги придут на баланс Sali сразу после перевода' : `${invoice.plan.name} · ${invoice.gift ? `подарок для ${invoice.gift}` : 'для вашего аккаунта'}`) : undefined}>
    {!invoice && !error && <Loading text="Выставляем счёт…" />}
    {error && <>
      <ErrorNote text={error.text} onRetry={error.needsTelegram ? undefined : () => void create()} />
      {error.needsTelegram && <View style={{ marginTop: 8 }}><TelegramLinkCard /></View>}
    </>}

    {invoice && <Animated.View entering={FadeIn.duration(320)}>
      <Card accent>
        <Text style={styles.label}>К ОПЛАТЕ</Text>
        <View style={styles.amountLine}>
          <Text style={styles.amount}>{invoice.amount}</Text>
          <Text style={styles.asset}>{invoice.asset}</Text>
        </View>
        <Text style={styles.network}>Сеть TON{invoice.discountPercent ? ` · скидка ${invoice.discountPercent}%` : ''}</Text>
        <View style={styles.timer}>
          <Icon name="info" size={14} color={expired ? theme.colors.error : theme.colors.textSecondary} />
          <Text style={[styles.timerText, expired && { color: theme.colors.error }]}>{expired ? 'Счёт истёк' : `Счёт действует ${pad(Math.floor(left / 60))}:${pad(left % 60)}`}</Text>
        </View>
      </Card>

      <View style={{ height: 14 }} />
      <CopyBox label="Сумма" value={invoice.amount} />
      <CopyBox label="Адрес кошелька" value={invoice.address} mono />
      <CopyBox label="Комментарий" value={invoice.comment} note="Обязательно вставьте комментарий к переводу — по нему мы найдём ваш платёж" />

      {expired
        ? <SaliButton title="Выставить новый счёт" onPress={() => void create()} />
        : <>
            <SaliButton title="Открыть кошелёк" onPress={() => void openWallet()} />
            <View style={styles.waiting}>
              <ActivityIndicator color={theme.colors.accent} />
              <Text style={styles.waitingText}>Ждём перевод. Обычно подтверждается за минуту — экран обновится сам.</Text>
            </View>
          </>}

      <Text style={styles.how}>Как оплатить из Telegram Wallet: Кошелёк → Отправить → USDT → сеть TON → вставьте адрес, сумму и комментарий.</Text>
    </Animated.View>}
  </Screen>;
}

const styles = StyleSheet.create({
  renewTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold', marginBottom: 6 },
  renewText: { color: theme.colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  label: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  amountLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  amount: { color: theme.colors.cream, fontSize: 44, fontFamily: 'SaliSans-Bold', fontVariant: ['tabular-nums'] },
  asset: { color: theme.colors.accent, fontSize: 20, fontFamily: 'SaliSans-SemiBold' },
  network: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 2 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  timerText: { color: theme.colors.textSecondary, fontSize: 13, fontVariant: ['tabular-nums'] },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  waitingText: { flex: 1, color: theme.colors.textSecondary, fontSize: 13.5, lineHeight: 19 },
  how: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 18, textAlign: 'center' },
  successIcon: { width: 92, height: 92, borderRadius: 46, backgroundColor: theme.colors.success, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 24 },
  successTitle: { color: theme.colors.textPrimary, fontSize: 22, fontFamily: 'SaliSans-Bold', textAlign: 'center' },
  successText: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 10 },
});
