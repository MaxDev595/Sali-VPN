import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Text } from '../../src/components/Text';
import { Icon } from '../../src/components/Icon';
import { Chip, ErrorNote, Loading, Screen, ui } from '../../src/components/ui';
import { api, type AdminPeople, type PeopleSegment } from '../../src/services/api/client';
import { theme } from '../../src/theme';

const SEGMENTS: Array<{ id: PeopleSegment; label: string }> = [
  { id: 'paid', label: 'Платные' },
  { id: 'granted', label: 'От админа' },
  { id: 'trial', label: 'Бесплатные' },
  { id: 'expired', label: 'Ушли (30 дн.)' },
];

export default function AdminPeopleScreen() {
  const [segment, setSegment] = useState<PeopleSegment>('paid');
  const [page, setPage] = useState(0);
  const [data, setData] = useState<AdminPeople | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.admin.people(segment, page)); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, [page, segment]);
  useEffect(() => { void load(); }, [load]);

  return <Screen title="Пользователи" onRefresh={() => void load()} refreshing={loading}>
    <View style={[ui.wrap, { marginBottom: 14 }]}>
      {SEGMENTS.map((s) => <Chip key={s.id} active={segment === s.id} label={`${s.label}${data ? ` · ${data.counts[s.id]}` : ''}`} onPress={() => { setSegment(s.id); setPage(0); }} />)}
    </View>
    {!data && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {data?.list.length === 0 && <Text style={ui.muted}>Пусто</Text>}
    {data?.list.map((p) => <Pressable key={p.userId} onPress={() => router.push({ pathname: '/admin/user', params: { query: p.userId } })} style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.colors.surfaceElevated }]}>
      <View style={{ flex: 1 }}>
        <View style={ui.row}>
          {p.blocked && <Icon name="ban" size={16} color={theme.colors.error} />}
          <Text style={[styles.name, { flex: 1 }]} numberOfLines={1}>{p.name}{p.username ? ` · @${p.username}` : ''}</Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>{p.plan}{p.via ? ` · ${p.via}` : ''}{p.device ? ` · ${p.device}` : ''}</Text>
      </View>
      <Text style={styles.until}>{p.until}</Text>
    </Pressable>)}
    {data && data.pages > 1 && <View style={styles.pager}>
      <Chip label="← Назад" onPress={() => setPage((n) => Math.max(0, n - 1))} />
      <Text style={ui.muted}>{page + 1} / {data.pages}</Text>
      <Chip label="Дальше →" onPress={() => setPage((n) => Math.min(data.pages - 1, n + 1))} />
    </View>}
  </Screen>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, marginBottom: 8, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  name: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: 'SaliSans-SemiBold' },
  meta: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 3 },
  until: { color: theme.colors.textPrimary, fontSize: 13, fontFamily: 'SaliSans-Medium' },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
});
