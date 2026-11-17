import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../../src/components/Text';
import { Toggle } from '../../src/components/Toggle';
import { SaliButton } from '../../src/components/SaliButton';
import { Card, Chip, ErrorNote, Field, Loading, Screen, copy, dateRu, toast, ui } from '../../src/components/ui';
import { api, ApiError, type AdminPromo } from '../../src/services/api/client';
import { theme } from '../../src/theme';

const num = (v: string) => (v.trim() ? Number(v.replace(/[^0-9]/g, '')) : undefined);

/** Promo codes: DAYS adds days at once, DISCOUNT takes a share off the next purchase. One use per account. */
export default function AdminPromosScreen() {
  const [rows, setRows] = useState<AdminPromo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'DAYS' | 'DISCOUNT'>('DAYS');
  const [value, setValue] = useState('7');
  const [maxUses, setMaxUses] = useState('');
  const [expires, setExpires] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setRows(await api.admin.promos()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      const n = num(value) ?? 0;
      const made = await api.admin.createPromo({ code, kind, ...(kind === 'DAYS' ? { days: n } : { discountPercent: n }), maxUses: num(maxUses), expiresInDays: num(expires) });
      toast(`Промокод ${made.code} создан`);
      setCode(''); setMaxUses(''); setExpires('');
      void load();
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); } finally { setBusy(false); }
  };

  const toggle = async (p: AdminPromo, isActive: boolean) => {
    setRows((list) => list?.map((r) => (r.id === p.id ? { ...r, isActive } : r)) ?? null);
    await api.admin.setPromoActive(p.id, isActive).catch(() => { toast('Не получилось'); void load(); });
  };

  return <Screen title="Промокоды" onRefresh={() => void load()} refreshing={loading}>
    <Card>
      <Text style={styles.h}>Новый промокод</Text>
      <Field label="Код" value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/\s/g, ''))} placeholder="SALI2026" autoCapitalize="characters" autoCorrect={false} maxLength={32} />
      <View style={[ui.wrap, { marginBottom: 12 }]}>
        <Chip label="Дни подписки" active={kind === 'DAYS'} onPress={() => { setKind('DAYS'); setValue('7'); }} />
        <Chip label="Скидка %" active={kind === 'DISCOUNT'} onPress={() => { setKind('DISCOUNT'); setValue('20'); }} />
      </View>
      <Field label={kind === 'DAYS' ? 'Сколько дней' : 'Скидка, %'} value={value} onChangeText={setValue} keyboardType="number-pad" />
      <View style={ui.row}>
        <View style={{ flex: 1 }}><Field label="Лимит (пусто = ∞)" value={maxUses} onChangeText={setMaxUses} keyboardType="number-pad" placeholder="100" /></View>
        <View style={{ flex: 1 }}><Field label="Дней действует" value={expires} onChangeText={setExpires} keyboardType="number-pad" placeholder="∞" /></View>
      </View>
      <SaliButton title="Создать" loading={busy} disabled={code.length < 3 || !num(value)} onPress={() => void create()} />
    </Card>

    <Text style={[styles.h, { marginTop: 22 }]}>Все промокоды</Text>
    {!rows && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {rows?.length === 0 && <Text style={ui.muted}>Пока ни одного</Text>}
    {rows?.map((p) => <View key={p.id} style={[styles.row, !p.isActive && { opacity: .55 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.code} onPress={() => void copy(p.code, 'Промокод скопирован')}>{p.code}</Text>
        <Text style={styles.meta}>{p.kind === 'DAYS' ? `+${p.days} дн.` : `−${p.discountPercent}%`} · использован {p.usedCount}{p.maxUses ? ` из ${p.maxUses}` : ''}{p.expiresAt ? ` · до ${dateRu(p.expiresAt, false)}` : ''}</Text>
      </View>
      <Toggle value={p.isActive} onChange={(v) => void toggle(p, v)} label={p.code} />
    </View>)}
  </Screen>;
}

const styles = StyleSheet.create({
  h: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  code: { color: theme.colors.cream, fontSize: 16, fontFamily: 'SaliSans-Bold', letterSpacing: .6 },
  meta: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 3 },
});
