import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../../src/components/Text';
import { ErrorNote, Loading, Screen, money, ui } from '../../src/components/ui';
import { api, type AdminPayment } from '../../src/services/api/client';
import { theme } from '../../src/theme';

const METHOD: Record<string, string> = { crypto: 'USDT', telegram_stars: 'Stars', paddle: 'Карта', google_play: 'Google Play', manual: 'Вручную' };

export default function AdminPaymentsScreen() {
  const [rows, setRows] = useState<AdminPayment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await api.admin.payments()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <Screen title="Платежи" subtitle="Последние 40 оплат" onRefresh={() => void load()} refreshing={loading}>
    {!rows && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {rows?.length === 0 && <Text style={ui.muted}>Пока нет оплат</Text>}
    {rows?.map((p) => <View key={p.id} style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} onPress={() => router.push({ pathname: '/admin/user', params: { query: p.account } })}>{p.name ?? p.account}</Text>
        <Text style={styles.meta}>{p.plan} · {METHOD[p.method] ?? p.method}{p.discountPercent ? ` · −${p.discountPercent}%` : ''}{p.giftTo ? ` · 🎁 → ${p.giftTo}` : ''}</Text>
        <Text style={styles.meta}>{new Date(p.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
      </View>
      <Text style={[styles.sum, p.status === 'REFUNDED' && { color: theme.colors.error, textDecorationLine: 'line-through' }]}>{money(p.amountUsd)}</Text>
    </View>)}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: 'SaliSans-SemiBold' },
  meta: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 3 },
  sum: { color: theme.colors.success, fontSize: 18, fontFamily: 'SaliSans-Bold' },
});
