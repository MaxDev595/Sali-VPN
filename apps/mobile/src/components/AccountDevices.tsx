import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Text } from './Text';
import { PlatformIcon } from './PlatformIcon';
import { SectionLabel } from './List';
import { SaliModal } from './SaliModal';
import { SaliButton } from './SaliButton';
import { api, type AccountDevice, type AccountDevices as Overview } from '../services/api/client';
import { useAccountStore } from '../store/accountStore';
import { theme } from '../theme';

/** Not used for this long → marked «не используется» and suggested for removal. */
const IDLE_DAYS = 14;

const lastUsed = (d: AccountDevice) => {
  if (d.current) return 'сейчас';
  if (d.idleDays === null) return 'ещё не подключалось';
  if (d.idleDays === 0) return 'сегодня';
  if (d.idleDays === 1) return 'вчера';
  return `${d.idleDays} дн. назад`;
};
const platformOf = (p: string | null) => (p === 'WINDOWS' ? 'windows' as const : 'android' as const);
const platformName = (p: string | null) => (p === 'WINDOWS' ? 'ПК · Windows' : 'Android');
const untilText = (iso: string | null) => (!iso || new Date(iso).getFullYear() > new Date().getFullYear() + 50 ? 'бессрочно' : `до ${new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`);

/**
 * «Устройства аккаунта»: everything linked to the same Telegram — they share one
 * subscription (up to 3) — with when each last used the VPN and «Удалить» for old ones.
 */
export function AccountDevices() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AccountDevice | null>(null);
  const [busy, setBusy] = useState(false);
  const refreshAccount = useAccountStore(state => state.refresh);

  const load = useCallback(async () => {
    try { setData(await api.accountDevices()); setError(null); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { void load(); }, [load]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await api.unlinkDevice(removing.publicId);
      setRemoving(null);
      await load();
      void refreshAccount();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось удалить');
      setRemoving(null);
    } finally { setBusy(false); }
  };

  if (!data && !error) return <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View>;
  if (data && !data.linked) return null; // not linked to Telegram yet — the card below explains how
  const devices = data?.devices ?? [];
  const sub = data?.subscription;

  return <View>
    <SectionLabel icon="devices">УСТРОЙСТВА АККАУНТА</SectionLabel>
    {sub && <Text style={styles.note}>💎 {sub.plan} {untilText(sub.until)} · работает на <Text style={styles.noteStrong}>{sub.used} из {sub.max}</Text> устройств</Text>}
    {error && <Text style={styles.error}>{error}</Text>}
    {devices.map((d, i) => {
      const idle = !d.current && (d.idleDays === null || d.idleDays >= IDLE_DAYS);
      return <Animated.View key={d.publicId} entering={FadeInDown.delay(i * 50).duration(320)} exiting={FadeOut.duration(160)} layout={LinearTransition} style={[styles.row, d.current && styles.rowCurrent]}>
        <View style={styles.icon}><PlatformIcon platform={platformOf(d.platform)} size={24} /></View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameLine}>
            <Text style={styles.name}>{platformName(d.platform)}</Text>
            {d.current && <Text style={styles.badge}>ЭТО</Text>}
          </View>
          <Text style={styles.meta}>{d.publicId}</Text>
          <Text style={[styles.meta, idle && styles.idle]}>
            {d.covered ? 'в подписке' : sub ? 'не входит в подписку' : 'без тарифа'} · {idle && d.idleDays !== null ? `не используется ${d.idleDays} дн.` : `VPN: ${lastUsed(d)}`}
          </Text>
        </View>
        {!d.current && <Pressable accessibilityRole="button" accessibilityLabel={`Удалить ${d.publicId}`} onPress={() => setRemoving(d)} style={({ pressed }) => [styles.remove, idle && styles.removeIdle, pressed && { opacity: .8 }]}>
          <Text style={[styles.removeText, idle && styles.removeTextIdle]}>Удалить</Text>
        </Pressable>}
      </Animated.View>;
    })}
    {devices.length > 1 && <Text style={styles.hint}>Удалите телефон, которым больше не пользуетесь, или старую установку приложения — место на подписке освободится.</Text>}

    <SaliModal visible={Boolean(removing)} title="Удалить устройство?" onClose={() => !busy && setRemoving(null)}>
      <Text style={styles.modalText}>{removing ? `${platformName(removing.platform)} ${removing.publicId} отвяжется от вашего аккаунта и перестанет пользоваться подпиской. Подписка останется у вас.` : ''}</Text>
      <View style={{ gap: 10, marginTop: 20 }}>
        <SaliButton title="Удалить" loading={busy} onPress={() => void remove()} />
        <SaliButton secondary title="Отмена" disabled={busy} onPress={() => setRemoving(null)} />
      </View>
    </SaliModal>
  </View>;
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 24 },
  note: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  noteStrong: { color: theme.colors.textPrimary, fontFamily: 'SaliSans-SemiBold' },
  error: { color: theme.colors.error, fontSize: 13.5, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginBottom: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  rowCurrent: { borderColor: 'rgba(255,197,135,.3)' },
  icon: { width: 44, height: 44, borderRadius: 13, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  badge: { color: theme.colors.onPrimary, backgroundColor: theme.colors.accent, fontSize: 9.5, letterSpacing: 1.2, fontFamily: 'SaliSans-Bold', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  meta: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 2 },
  idle: { color: theme.colors.warning },
  remove: { height: 34, paddingHorizontal: 13, borderRadius: 17, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center' },
  removeIdle: { borderColor: 'rgba(255,122,122,.45)', backgroundColor: 'rgba(255,122,122,.08)' },
  removeText: { color: theme.colors.textPrimary, fontSize: 13, fontFamily: 'SaliSans-SemiBold' },
  removeTextIdle: { color: '#FFB4B4' },
  hint: { color: theme.colors.textSecondary, fontSize: 12.5, lineHeight: 18, marginBottom: 6 },
  modalText: { color: theme.colors.textSecondary, fontSize: 15.5, lineHeight: 22, textAlign: 'center' },
});
