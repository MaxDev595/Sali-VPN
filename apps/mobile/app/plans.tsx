import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Text } from '../src/components/Text';
import { Icon, type IconName } from '../src/components/Icon';
import { TelegramLinkCard } from '../src/components/TelegramLinkCard';
import { ErrorNote, Loading, Screen, money, period } from '../src/components/ui';
import { api, type Plan, type PlansResponse } from '../src/services/api/client';
import { linkCodeOf, linkTelegram } from '../src/services/session';
import { useAccountStore } from '../src/store/accountStore';
import { useShopStore } from '../src/store/shopStore';
import { theme } from '../src/theme';

/** What every tariff gives — the two things Sali puts first. */
const PROMISES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'bolt', title: 'Быстрая сеть', text: 'Современный протокол и серверы без перегрузки — видео, игры и звонки без задержек.' },
  { icon: 'lock', title: 'Конфиденциальность превыше всего', text: 'Не храним историю посещений и не показываем рекламу. Аккаунт — только Sali ID.' },
];

/**
 * «Тарифы»: every tariff on its own page. All tariffs are the same Sali Pro — all countries,
 * up to 3 devices — only the length differs. Paying needs a linked Telegram.
 */
export default function PlansScreen() {
  const home = useAccountStore((s) => s.home);
  const refresh = useAccountStore((s) => s.refresh);
  const promo = useShopStore((s) => s.promo);
  const [data, setData] = useState<PlansResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const linked = Boolean(home?.telegram?.linked ?? home?.user.telegramLinked);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await api.plans()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить тарифы'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const percent = Math.max(promo?.percent ?? 0, data?.discountPercent ?? 0);
  const price = (p: Plan) => (percent ? Math.round(p.priceUsd * (100 - percent)) / 100 : p.priceUsd);
  // The main subscription (30 days) is what longer tariffs are compared with.
  const base = data?.plans.find((p) => p.durationDays === 30);
  const saving = (p: Plan) => (base && p.durationDays > 30 ? Math.round((1 - p.perMonthUsd / base.perMonthUsd) * 100) : 0);
  const best = data?.plans.reduce<Plan | null>((top, p) => (saving(p) > (top ? saving(top) : 0) ? p : top), null);

  const choose = (code: string) => {
    void Haptics.selectionAsync();
    if (!linked) { if (home) void linkTelegram(linkCodeOf(home), refresh); return; }
    router.push({ pathname: '/checkout', params: { plan: code } });
  };

  return <Screen title="Тарифы" subtitle="Любой тариф — все страны и до 3 устройств. Отличается только срок.">
    <View style={styles.promises}>
      {PROMISES.map((f, i) => <Animated.View key={f.title} entering={FadeInDown.delay(i * 70).duration(360)} style={styles.promise}>
        <View style={styles.promiseIcon}><Icon name={f.icon} size={22} color={theme.colors.onPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.promiseTitle}>{f.title}</Text>
          <Text style={styles.promiseText}>{f.text}</Text>
        </View>
      </Animated.View>)}
    </View>

    {!linked && <View style={{ marginBottom: 14 }}><TelegramLinkCard /></View>}
    {!data && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}

    {data?.plans.map((p, i) => {
      const now = price(p);
      const main = p.durationDays === 30;
      const off = saving(p);
      return <Animated.View key={p.code} entering={FadeInDown.delay(120 + i * 55).duration(340)}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${period(p.durationDays)}, ${money(now)}`} onPress={() => choose(p.code)} style={({ pressed }) => [styles.plan, main && styles.planMain, pressed && styles.pressed]}>
          <View style={{ flex: 1 }}>
            <View style={styles.top}>
              <Text style={styles.name}>{period(p.durationDays)}</Text>
              {main && <View style={styles.badgeMain}><Icon name="star" size={11} color={theme.colors.onPrimary} /><Text style={styles.badgeMainText}>ОСНОВНОЙ</Text></View>}
              {!main && p === best && off > 0 && <View style={styles.badgeBest}><Text style={styles.badgeBestText}>ВЫГОДНО −{off}%</Text></View>}
            </View>
            <Text style={styles.desc}>{p.description ?? p.name}</Text>
            {p.durationDays > 30 && <Text style={styles.per}>{money(p.perMonthUsd)} за 30 дней{off > 0 ? ` · экономия ${off}%` : ''}</Text>}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.price}>{money(now)}</Text>
            {now !== p.priceUsd ? <Text style={styles.old}>{money(p.priceUsd)}</Text> : <Text style={styles.cur}>USDT</Text>}
          </View>
        </Pressable>
      </Animated.View>;
    })}

    {percent > 0 && <View style={styles.discount}>
      <Icon name="check" size={16} color={theme.colors.success} />
      <Text style={styles.discountText}>{promo && promo.percent >= (data?.discountPercent ?? 0) ? `Промокод ${promo.code}: −${promo.percent}%` : `Скидка за приглашённого друга: −${data?.discountPercent}%`} — цены уже со скидкой</Text>
    </View>}
    <Text style={styles.footnote}>Оплата в USDT (сеть TON) с любого кошелька: Telegram Wallet, Tonkeeper, биржа. Новая покупка добавляет дни к текущей подписке. Автосписаний нет.</Text>
  </Screen>;
}

const styles = StyleSheet.create({
  promises: { gap: 10, marginBottom: 20 },
  promise: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: theme.radius.lg, backgroundColor: '#0E1729', borderWidth: 1, borderColor: 'rgba(255,197,135,.28)' },
  promiseIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accent },
  promiseTitle: { color: theme.colors.cream, fontSize: 16, fontFamily: 'SaliSans-Bold' },
  promiseText: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 3 },
  plan: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, marginBottom: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  planMain: { borderColor: theme.colors.accent, borderWidth: 1.5, backgroundColor: '#0E1729' },
  pressed: { transform: [{ scale: .985 }], opacity: .92 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: theme.colors.textPrimary, fontSize: 20, fontFamily: 'SaliSans-Bold' },
  desc: { color: theme.colors.textSecondary, fontSize: 13.5, marginTop: 3 },
  per: { color: theme.colors.accent, fontSize: 12.5, marginTop: 4 },
  badgeMain: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11, backgroundColor: theme.colors.accent },
  badgeMainText: { color: theme.colors.onPrimary, fontSize: 10, letterSpacing: 1, fontFamily: 'SaliSans-Bold' },
  badgeBest: { paddingHorizontal: 8, height: 22, borderRadius: 11, justifyContent: 'center', backgroundColor: theme.colors.successGlow },
  badgeBestText: { color: theme.colors.success, fontSize: 10, letterSpacing: .8, fontFamily: 'SaliSans-Bold' },
  price: { color: theme.colors.textPrimary, fontSize: 24, fontFamily: 'SaliSans-Bold' },
  old: { color: theme.colors.textSecondary, fontSize: 13, textDecorationLine: 'line-through' },
  cur: { color: theme.colors.textSecondary, fontSize: 12 },
  discount: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: theme.colors.successGlow, marginTop: 2 },
  discountText: { flex: 1, color: theme.colors.success, fontSize: 13.5, fontFamily: 'SaliSans-Medium' },
  footnote: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 12, marginHorizontal: 4 },
});
