import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../src/components/Text';
import { SaliButton } from '../src/components/SaliButton';
import { Card, ErrorNote, Field, Loading, Screen, money, period } from '../src/components/ui';
import { api, ApiError, type PlansResponse } from '../src/services/api/client';
import { theme } from '../src/theme';

/** Gift: the friend's Sali ID → a tariff → the usual USDT invoice. The days land on the friend's account. */
export default function GiftScreen() {
  const [id, setId] = useState('');
  const [to, setTo] = useState<{ to: string; name: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => { void api.plans().then((p) => { setPlans(p); setPlan(p.plans[0]?.code ?? null); }).catch(() => undefined); }, []);

  const check = async () => {
    setBusy(true); setError(null); setTo(null);
    try { setTo(await api.checkGift(id)); } catch (e) { setError(e instanceof ApiError ? e.message : 'Не получилось проверить. Проверьте интернет'); }
    finally { setBusy(false); }
  };

  const format = (v: string) => {
    const raw = v.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^SL/, '').slice(0, 8);
    return raw ? `SL-${raw.slice(0, 4)}${raw.length > 4 ? `-${raw.slice(4)}` : ''}` : '';
  };

  return <Screen title="Подарить подписку" subtitle="Попросите у друга его Sali ID — он в приложении, на главном экране и в «Профиле». Подписка сразу появится на его аккаунте.">
    <Field label="Sali ID друга" value={id} onChangeText={(v) => { setId(format(v)); setTo(null); }} placeholder="SL-XXXX-XXXX" autoCapitalize="characters" autoCorrect={false} maxLength={12} onSubmitEditing={() => void check()} />
    {!to && <SaliButton title="Проверить" secondary loading={busy} disabled={id.replace(/[^0-9A-Z]/g, '').length < 10} onPress={() => void check()} />}
    {error && <ErrorNote text={error} />}

    {to && <Animated.View entering={FadeInDown.duration(320)}>
      <Card accent style={{ marginBottom: 18 }}>
        <Text style={styles.toLabel}>ПОЛУЧАТЕЛЬ</Text>
        <Text style={styles.to}>{to.to}{to.name ? ` · ${to.name}` : ''}</Text>
      </Card>
      <Text style={styles.section}>Что подарить</Text>
      {!plans && <Loading />}
      {plans?.plans.map((p) => <Pressable key={p.code} onPress={() => setPlan(p.code)} style={[styles.plan, plan === p.code && styles.planOn]}>
        <View style={[styles.radio, plan === p.code && styles.radioOn]} />
        <Text style={styles.planName}>{period(p.durationDays)}</Text>
        <Text style={styles.planPrice}>{money(p.priceUsd)}</Text>
      </Pressable>)}
      <View style={{ height: 10 }} />
      <SaliButton title="Перейти к оплате" disabled={!plan} onPress={() => plan && router.push({ pathname: '/checkout', params: { plan, gift: to.to } })} />
    </Animated.View>}
  </Screen>;
}

const styles = StyleSheet.create({
  toLabel: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  to: { color: theme.colors.cream, fontSize: 20, fontFamily: 'SaliSans-SemiBold', marginTop: 6 },
  section: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold', marginBottom: 10 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, marginBottom: 8, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  planOn: { borderColor: theme.colors.accent },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: theme.colors.muted },
  radioOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  planName: { flex: 1, color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-Medium' },
  planPrice: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-Bold' },
});
