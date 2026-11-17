import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../src/components/Text';
import { PlatformIcon } from '../src/components/PlatformIcon';
import { TelegramLinkCard } from '../src/components/TelegramLinkCard';
import { Card, ErrorNote, Loading, Screen, toast } from '../src/components/ui';
import { api, ApiError, type AppDevices } from '../src/services/api/client';
import { useAccountStore } from '../src/store/accountStore';
import { theme } from '../src/theme';

const idle = (days: number | null) => (days === null ? 'ещё не подключалось' : days === 0 ? 'сегодня' : days === 1 ? 'вчера' : `${days} дн. назад`);
const platformOf = (p: string | null) => (p === 'WINDOWS' ? 'windows' : 'android') as 'windows' | 'android';

/**
 * Devices of the account. They are only labels (D-XXXXXX) — the account has one Sali ID.
 * One subscription covers up to 3 of them; an old phone can be removed to free a place.
 */
export default function DevicesScreen() {
  const home = useAccountStore((s) => s.home);
  const refresh = useAccountStore((s) => s.refresh);
  const [data, setData] = useState<AppDevices | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.devices()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const remove = (key: string, label: string) => Alert.alert('Удалить устройство?', `${label} перестанет использовать подписку. Его можно будет добавить снова, привязав тот же Telegram.`, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Удалить', style: 'destructive', onPress: async () => {
      try { await api.removeDevice(key); toast('Устройство удалено'); void load(); void refresh(); }
      catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); }
    } },
  ]);

  return <Screen title="Устройства" subtitle={`Одна подписка — до ${data?.max ?? 3} устройств. У аккаунта один Sali ID: ${home?.user.publicId ?? '—'}`} onRefresh={() => void load()} refreshing={loading}>
    {!data && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {data?.devices.map((d, i) => <Animated.View key={d.key} entering={FadeInDown.delay(i * 60).duration(320)}>
      <View style={[styles.device, d.current && styles.current]}>
        <View style={styles.icon}><PlatformIcon platform={platformOf(d.platform)} size={28} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{d.name ?? (d.platform === 'WINDOWS' ? 'Компьютер' : 'Телефон')}{d.current ? ' · это устройство' : ''}</Text>
          <Text style={styles.meta}>{d.id} · {idle(d.idleDays)}</Text>
          {!d.covered && <Text style={styles.warn}>Не входит в подписку — превышен лимит устройств</Text>}
        </View>
        {!d.current && data.linked && <Pressable hitSlop={8} onPress={() => remove(d.key, d.name ?? d.id)} style={({ pressed }) => [styles.remove, pressed && { opacity: .7 }]}><Text style={styles.removeText}>Удалить</Text></Pressable>}
      </View>
    </Animated.View>)}

    {data && !data.linked && <View style={{ marginTop: 6 }}><TelegramLinkCard /></View>}
    <Card style={{ marginTop: 14 }}>
      <Text style={styles.addTitle}>Добавить устройство</Text>
      <Text style={styles.addText}>Установите Sali VPN на другом телефоне или ПК и привяжите тот же Telegram («Подписка» → «Привязать Telegram») — подписка заработает на нём сама.</Text>
    </Card>
  </Screen>;
}

const styles = StyleSheet.create({
  device: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, marginBottom: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  current: { borderColor: 'rgba(255,197,135,.35)' },
  icon: { width: 46, height: 46, borderRadius: 14, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  meta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 },
  warn: { color: theme.colors.warning, fontSize: 12.5, marginTop: 4 },
  remove: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,122,122,.1)', justifyContent: 'center' },
  removeText: { color: theme.colors.error, fontSize: 13, fontFamily: 'SaliSans-SemiBold' },
  addTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  addText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 6 },
});
