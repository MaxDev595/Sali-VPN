import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '../../src/components/Text';
import { Icon } from '../../src/components/Icon';
import { SaliModal } from '../../src/components/SaliModal';
import { SaliButton } from '../../src/components/SaliButton';
import { Group, Row, SectionLabel } from '../../src/components/List';
import { TelegramLinkCard } from '../../src/components/TelegramLinkCard';
import { ErrorNote, Field, Loading, bonusLabel, dateRu, money, period, toast } from '../../src/components/ui';
import { api, ApiError, type PlansResponse } from '../../src/services/api/client';
import { linkCodeOf, linkTelegram } from '../../src/services/session';
import { useAccountStore } from '../../src/store/accountStore';
import { useShopStore } from '../../src/store/shopStore';
import { theme } from '../../src/theme';

/**
 * «Подписка»: status, tariffs (USDT on TON), gift, promo code, inviting friends, devices.
 * Paying needs a linked Telegram (one tap); the free 3 days never do.
 */
export default function SubscriptionScreen() {
  const home = useAccountStore((s) => s.home);
  const access = useAccountStore((s) => s.access);
  const refresh = useAccountStore((s) => s.refresh);
  const { promo, setPromo } = useShopStore();
  const [plans, setPlans] = useState<PlansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoValue, setPromoValue] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const linked = Boolean(home?.telegram?.linked ?? home?.user.telegramLinked);

  const load = useCallback(async () => {
    setError(null);
    try { setPlans(await api.plans()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить тарифы'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); void refresh(); }, [load, refresh]));
  useEffect(() => { if (linked) void load(); }, [linked, load]);

  const choose = (code: string) => {
    void Haptics.selectionAsync();
    if (!linked) { if (home) void linkTelegram(linkCodeOf(home), refresh); return; }
    router.push({ pathname: '/checkout', params: { plan: code } });
  };

  const applyPromo = async () => {
    const code = promoValue.trim();
    if (code.length < 3) return;
    setPromoBusy(true); setPromoError(null);
    try {
      const result = await api.promo(code);
      setPromoOpen(false); setPromoValue('');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (result.kind === 'DISCOUNT') { setPromo({ code: result.code, percent: result.percent }); toast(`Скидка ${result.percent}% — на следующую оплату`); }
      else if (result.kind === 'DAYS') { toast(`Начислено ${period(result.days)} подписки`); void refresh(); }
      else { toast(result.pending ? `Приглашение принято: +${bonusLabel(result.bonusHours)} — добавится, когда включите VPN` : `Приглашение принято: +${bonusLabel(result.bonusHours)}`); void refresh(); }
    } catch (e) {
      setPromoError(e instanceof ApiError ? e.message : 'Не получилось. Проверьте интернет');
    } finally { setPromoBusy(false); }
  };

  const until = home?.subscription?.expiresAt ?? home?.account?.until ?? null;
  const forever = until ? new Date(until).getFullYear() > new Date().getFullYear() + 50 : false;
  const status = access === 'premium'
    ? { title: forever ? 'Подписка бессрочная' : `Подписка до ${dateRu(until, false)}`, hint: 'Работает на всех устройствах аккаунта', tone: theme.colors.success }
    : access === 'trial'
      ? { title: 'Бесплатные 3 дня', hint: `До ${home?.trial ? new Date(home.trial.expiresAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}`, tone: theme.colors.accent }
      : access === 'expired'
        ? { title: 'Бесплатное время закончилось', hint: 'Выберите тариф — VPN заработает сразу', tone: theme.colors.warning }
        : { title: 'Нет подписки', hint: 'Первые 3 дня — бесплатно: нажмите «Включить» на главной', tone: theme.colors.textSecondary };

  const price = (p: PlansResponse['plans'][number]) => {
    const percent = Math.max(promo?.percent ?? 0, plans?.discountPercent ?? 0);
    return percent ? Math.round(p.priceUsd * (100 - percent)) / 100 : p.priceUsd;
  };

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Подписка</Text>

      <Animated.View entering={FadeInDown.duration(360)} style={styles.status}>
        <View style={[styles.dot, { backgroundColor: status.tone }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.statusTitle}>{status.title}</Text>
          <Text style={styles.statusHint}>{status.hint}</Text>
        </View>
        {home?.account && <Pressable onPress={() => router.push('/devices')} hitSlop={8} style={({ pressed }) => [styles.devicesPill, pressed && { opacity: .8 }]}>
          <Icon name="devices" size={15} color={theme.colors.accent} /><Text style={styles.devicesText}>{home.account.used}/{home.account.max}</Text>
        </Pressable>}
      </Animated.View>

      {!linked && <View style={{ marginTop: 14 }}><TelegramLinkCard /></View>}

      <SectionLabel icon="key">ТАРИФЫ</SectionLabel>
      {error && <ErrorNote text={error} onRetry={() => void load()} />}
      <Animated.View entering={FadeInDown.delay(80).duration(360)}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/plans')} style={({ pressed }) => [styles.plansCard, pressed && styles.pressed]}>
          <View style={styles.plansTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.plansTitle}>{plans?.plans.length ? `${plans.plans.length} тарифов — от ${money(Math.min(...plans.plans.map((p) => p.priceUsd)))}` : 'Тарифы'}</Text>
              <Text style={styles.plansHint}>{(() => { const main = plans?.plans.find((p) => p.durationDays === 30); return main ? `Основная подписка — ${money(main.priceUsd)} за 30 дней` : 'От 7 дней до года'; })()}</Text>
            </View>
            <Icon name="chevron" size={20} color={theme.colors.accent} />
          </View>
          <View style={styles.perks}>
            <View style={styles.perk}><Icon name="bolt" size={15} color={theme.colors.accent} /><Text style={styles.perkText}>Быстрая сеть</Text></View>
            <View style={styles.perk}><Icon name="lock" size={15} color={theme.colors.accent} /><Text style={styles.perkText}>Конфиденциальность превыше всего</Text></View>
          </View>
          <View style={styles.cta}><Text style={styles.ctaText}>Выбрать тариф</Text></View>
        </Pressable>
      </Animated.View>
      {(promo || (plans?.discountPercent ?? 0) > 0) && <View style={styles.discount}>
        <Icon name="check" size={16} color={theme.colors.success} />
        <Text style={styles.discountText}>{promo && promo.percent >= (plans?.discountPercent ?? 0) ? `Промокод ${promo.code}: −${promo.percent}%` : `Скидка за приглашённого друга: −${plans?.discountPercent}%`}</Text>
        {promo && <Pressable hitSlop={10} onPress={() => setPromo(null)}><Icon name="close" size={16} color={theme.colors.textSecondary} /></Pressable>}
      </View>}

      <SectionLabel icon="plus">ЕЩЁ</SectionLabel>
      <Group>
        <Row icon="gift" title="Подарить подписку" hint="Другу по его Sali ID" onPress={() => (linked ? router.push('/gift') : home && void linkTelegram(linkCodeOf(home), refresh))} />
        <Row icon="tag" title="Промокод" hint="Или Sali ID друга, который вас пригласил" value={promo ? `−${promo.percent}%` : undefined} onPress={() => { setPromoError(null); setPromoOpen(true); }} />
        <Row icon="users" title="Пригласить друга" hint="Другу +1 день, вам скидка на оплату" onPress={() => router.push('/invite')} />
        <Row icon="devices" title="Устройства" value={home?.account ? `${home.account.used} из ${home.account.max}` : '1 из 3'} onPress={() => router.push('/devices')} last />
      </Group>
    </ScrollView>

    <SaliModal visible={promoOpen} title="Промокод" icon="tag" onClose={() => setPromoOpen(false)}>
      <Field value={promoValue} onChangeText={(v) => setPromoValue(v.toUpperCase())} placeholder="Например, SALI2026" autoCapitalize="characters" autoCorrect={false} autoFocus onSubmitEditing={() => void applyPromo()} returnKeyType="done" />
      {promoError && <Text style={styles.modalError}>{promoError}</Text>}
      <SaliButton title="Применить" loading={promoBusy} disabled={promoValue.trim().length < 3} onPress={() => void applyPromo()} />
    </SaliModal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  title: { color: theme.colors.textPrimary, fontSize: 34, lineHeight: 40, fontFamily: 'SaliSans-Bold', marginBottom: 16 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: theme.radius.xl, backgroundColor: '#0B1630', borderWidth: 1, borderColor: '#1B2C4E' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusTitle: { color: theme.colors.textPrimary, fontSize: 19, fontFamily: 'SaliSans-SemiBold' },
  statusHint: { color: '#A9B4CC', fontSize: 13.5, marginTop: 3, lineHeight: 19 },
  devicesPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: theme.colors.glow },
  devicesText: { color: theme.colors.accent, fontSize: 13, fontFamily: 'SaliSans-Bold' },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, marginBottom: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  planBest: { borderColor: 'rgba(255,197,135,.45)', backgroundColor: '#0E1729' },
  pressed: { transform: [{ scale: .985 }], opacity: .92 },
  plansCard: { padding: 18, borderRadius: theme.radius.lg, backgroundColor: '#0E1729', borderWidth: 1.5, borderColor: 'rgba(255,197,135,.45)', marginBottom: 10 },
  plansTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  plansTitle: { color: theme.colors.textPrimary, fontSize: 20, fontFamily: 'SaliSans-Bold' },
  plansHint: { color: theme.colors.textSecondary, fontSize: 13.5, marginTop: 3 },
  perks: { gap: 8, marginTop: 14 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  perkText: { color: theme.colors.cream, fontSize: 14, fontFamily: 'SaliSans-Medium' },
  cta: { marginTop: 16, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent },
  ctaText: { color: theme.colors.onPrimary, fontSize: 16, fontFamily: 'SaliSans-Bold' },
  planTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  planName: { color: theme.colors.textPrimary, fontSize: 20, fontFamily: 'SaliSans-Bold' },
  planHint: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 },
  badge: { paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: theme.colors.accent, justifyContent: 'center' },
  badgeText: { color: theme.colors.onPrimary, fontSize: 10, letterSpacing: 1, fontFamily: 'SaliSans-Bold' },
  price: { color: theme.colors.textPrimary, fontSize: 24, fontFamily: 'SaliSans-Bold' },
  old: { color: theme.colors.textSecondary, fontSize: 13, textDecorationLine: 'line-through' },
  cur: { color: theme.colors.textSecondary, fontSize: 12 },
  discount: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: theme.colors.successGlow, marginBottom: 4 },
  discountText: { flex: 1, color: theme.colors.success, fontSize: 14, fontFamily: 'SaliSans-Medium' },
  footnote: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 4 },
  modalError: { color: theme.colors.error, fontSize: 14, marginBottom: 12, textAlign: 'center' },
});
