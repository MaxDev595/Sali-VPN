import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '../src/components/Text';
import { Icon } from '../src/components/Icon';
import { Toggle } from '../src/components/Toggle';
import { SaliButton } from '../src/components/SaliButton';
import { TelegramLinkCard } from '../src/components/TelegramLinkCard';
import { Card, Chip, ErrorNote, Field, Loading, Screen, dateRu, money, period, toast, ui } from '../src/components/ui';
import { api, ApiError, type BalanceInfo, type Plan } from '../src/services/api/client';
import { useAccountStore } from '../src/store/accountStore';
import { theme } from '../src/theme';

const QUICK = [3, 5, 10, 30];
const fmt = (v: number) => `$${v.toFixed(2)}`;

/**
 * «Баланс»: top up with USDT, pay tariffs instantly, renew every period automatically.
 * The money is spent only on Sali VPN — it is not paid out (a refund is a support case).
 */
export default function BalanceScreen() {
  const refresh = useAccountStore((s) => s.refresh);
  const [info, setInfo] = useState<BalanceInfo | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [b, p] = await Promise.all([api.balance(), api.plans().catch(() => null)]);
      setInfo(b); if (p) setPlans(p.plans);
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); void refresh(); }, [load, refresh]));

  const value = Number(amount.replace(',', '.'));
  const valid = info ? Number.isFinite(value) && value >= info.minTopUpUsd && value <= info.maxTopUpUsd : false;
  const topUp = (v: number) => { void Haptics.selectionAsync(); router.push({ pathname: '/checkout', params: { topup: v.toFixed(2) } }); };

  const setRenew = async (planCode: string | null) => {
    setBusy(true);
    try { setInfo(await api.setAutoRenew(planCode)); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); toast(planCode ? 'Автопродление включено' : 'Автопродление выключено'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); } finally { setBusy(false); }
  };
  const renewPlan = plans.find((p) => p.code === (info?.autoRenew?.planCode ?? 'pro_monthly')) ?? plans.find((p) => p.durationDays === 30);
  // Without auto-renew the customer renews by hand: the chosen tariff is charged from the balance.
  const manualPlan = plans.find((p) => p.code === manual) ?? renewPlan;
  const renewNow = () => manualPlan && Alert.alert('Продлить с баланса?', `${period(manualPlan.durationDays)} — спишем ${money(manualPlan.priceUsd)} с баланса. Подписка продлится на всех ваших устройствах.`, [
    { text: 'Отмена', style: 'cancel' },
    { text: `Списать ${money(manualPlan.priceUsd)}`, onPress: async () => {
      setBusy(true);
      try { const r = await api.payFromBalance(manualPlan.code); void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); toast(`Продлено до ${dateRu(r.until, false)} · списано ${money(r.priceUsd)}`); void load(); void refresh(); }
      catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); } finally { setBusy(false); }
    } },
  ]);

  return <Screen title="Баланс" subtitle="Пополните один раз — и оплачивайте тарифы в одно нажатие или включите автопродление." onRefresh={() => void load()} refreshing={loading}>
    {!info && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {info && !info.linked && <><Text style={[ui.muted, { marginBottom: 12 }]}>Баланс хранится на аккаунте, поэтому сначала привяжите Telegram — это одно нажатие.</Text><TelegramLinkCard /></>}

    {info?.linked && <>
      <Animated.View entering={FadeInDown.duration(360)} style={styles.hero}>
        <Text style={styles.heroLabel}>НА БАЛАНСЕ</Text>
        <Text style={styles.heroValue}>{fmt(info.balanceUsd)}</Text>
        <Text style={styles.heroHint}>{info.autoRenew && info.nextRenewalAt
          ? `Следующее продление ${dateRu(info.nextRenewalAt, false)} · ${money(info.autoRenew.priceUsd)}`
          : info.subscriptionUntil ? `Подписка до ${dateRu(info.subscriptionUntil, false)}` : 'Пополняется переводом USDT (сеть TON)'}</Text>
        {plans.length > 0 && <SaliButton title="Оплатить тариф с баланса" secondary onPress={() => router.push('/plans')} />}
      </Animated.View>

      <Text style={styles.section}>Пополнить</Text>
      <View style={[ui.wrap, { marginBottom: 12 }]}>
        {QUICK.map((v) => <Chip key={v} label={`$${v}`} onPress={() => topUp(v)} />)}
      </View>
      <View style={styles.custom}>
        <View style={{ flex: 1 }}><Field value={amount} onChangeText={(v) => setAmount(v.replace(/[^0-9.,]/g, '').slice(0, 7))} placeholder={`Другая сумма, от $${info.minTopUpUsd}`} keyboardType="decimal-pad" style={{ marginBottom: 0 }} /></View>
        <Pressable disabled={!valid} onPress={() => topUp(value)} style={({ pressed }) => [styles.go, !valid && { opacity: .4 }, pressed && { opacity: .8 }]}><Icon name="chevron" size={20} color={theme.colors.onPrimary} /></Pressable>
      </View>

      <Text style={styles.section}>Автопродление</Text>
      <Card>
        <View style={ui.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.renewTitle}>{info.autoRenew ? `${period(info.autoRenew.durationDays)} за ${money(info.autoRenew.priceUsd)}` : 'Выключено'}</Text>
            <Text style={styles.renewHint}>За сутки до конца подписки спишем стоимость тарифа с баланса. Не хватит — напомним в Telegram.</Text>
          </View>
          <Toggle value={Boolean(info.autoRenew)} onChange={(on) => void setRenew(on ? renewPlan?.code ?? 'pro_monthly' : null)} label="Автопродление" />
        </View>
        {info.autoRenew && plans.length > 0 && <View style={[ui.wrap, { marginTop: 14 }]}>
          {plans.map((p) => <Chip key={p.code} label={`${period(p.durationDays)} · ${money(p.priceUsd)}`} active={info.autoRenew?.planCode === p.code} onPress={() => !busy && void setRenew(p.code)} />)}
        </View>}
      </Card>

      {!info.autoRenew && plans.length > 0 && <>
        <Text style={styles.section}>Продлить с баланса</Text>
        <Card>
          <Text style={styles.renewHint}>Автопродление выключено — продлевайте сами, когда подписка подходит к концу. Выберите срок и нажмите «Списать».</Text>
          <View style={[ui.wrap, { marginTop: 12, marginBottom: 14 }]}>
            {plans.map((p) => <Chip key={p.code} label={`${period(p.durationDays)} · ${money(p.priceUsd)}`} active={manualPlan?.code === p.code} onPress={() => setManual(p.code)} />)}
          </View>
          {manualPlan && <SaliButton title={info.balanceUsd >= manualPlan.priceUsd ? `Списать ${money(manualPlan.priceUsd)} и продлить` : `Не хватает ${money(Math.round((manualPlan.priceUsd - info.balanceUsd) * 100) / 100)} — пополните`} disabled={busy || info.balanceUsd < manualPlan.priceUsd} onPress={renewNow} />}
        </Card>
      </>}


      <Text style={styles.section}>История</Text>
      {info.history.length === 0 && <Text style={ui.muted}>Пока пусто</Text>}
      {info.history.map((t) => <View key={t.id} style={styles.tx}>
        <View style={[styles.txIcon, t.amountUsd > 0 && { backgroundColor: theme.colors.successGlow }]}>
          <Icon name={t.kind === 'TOPUP' || t.kind === 'ADMIN' ? 'plus' : t.kind === 'GIFT' ? 'gift' : t.kind === 'REFUND' ? 'cash' : 'key'} size={16} color={t.amountUsd > 0 ? theme.colors.success : theme.colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.txTitle}>{t.label}</Text>
          <Text style={styles.txMeta} numberOfLines={1}>{new Date(t.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}{t.note ? ` · ${t.note}` : ''}</Text>
        </View>
        <Text style={[styles.txSum, { color: t.amountUsd > 0 ? theme.colors.success : theme.colors.textPrimary }]}>{t.amountUsd > 0 ? '+' : '−'}{fmt(Math.abs(t.amountUsd))}</Text>
      </View>)}

      <Text style={styles.note}>Деньги на балансе тратятся только на Sali VPN и не выводятся. Нужен возврат — напишите в поддержку: вернём на кошелёк, с которого пришёл перевод.</Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  hero: { padding: 20, borderRadius: theme.radius.xl, backgroundColor: '#0B1630', borderWidth: 1, borderColor: 'rgba(255,197,135,.35)', gap: 4 },
  heroLabel: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  heroValue: { color: theme.colors.cream, fontSize: 46, fontFamily: 'SaliSans-Bold', fontVariant: ['tabular-nums'] },
  heroHint: { color: '#A9B4CC', fontSize: 13.5, marginBottom: 12 },
  section: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold', marginTop: 24, marginBottom: 10 },
  custom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  go: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent },
  renewTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  renewHint: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 4 },
  tx: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  txIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glow },
  txTitle: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: 'SaliSans-Medium' },
  txMeta: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 2 },
  txSum: { fontSize: 15, fontFamily: 'SaliSans-Bold', fontVariant: ['tabular-nums'] },
  note: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 18, textAlign: 'center' },
});
