import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { VPNServer } from '../types';
import { theme } from '../theme';
import { useI18n } from '../i18n';

const flags: Record<string, string> = { IS: '🇮🇸', NL: '🇳🇱', DE: '🇩🇪', FI: '🇫🇮', CH: '🇨🇭', SE: '🇸🇪', NO: '🇳🇴', FR: '🇫🇷', GB: '🇬🇧', US: '🇺🇸', CA: '🇨🇦', JP: '🇯🇵', SG: '🇸🇬', AU: '🇦🇺' };

export function ServerList({ servers, selectedId, hasPremium = false, onSelect, onPremium }: { servers: VPNServer[]; selectedId?: string; hasPremium?: boolean; onSelect(server: VPNServer): void; onPremium?(): void }) {
  const { t } = useI18n();
  return <FlatList data={servers} keyExtractor={item => item.id} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false} renderItem={({ item }) => {
    const soon = item.access === 'soon' || !item.availability;
    const locked = item.premiumOnly && !hasPremium && !soon;
    const selected = selectedId === item.id;
    return <Pressable disabled={soon} onPress={() => locked ? onPremium?.() : onSelect(item)} style={({ pressed }) => [styles.row, selected && styles.selected, soon && styles.disabled, pressed && !soon && styles.pressed]}>
      <View style={styles.flag}><Text style={styles.flagText}>{flags[item.countryCode] ?? item.countryCode}</Text></View>
      <View style={styles.info}><View style={styles.nameLine}><Text style={styles.name}>{item.country}</Text>{item.access === 'free' && <Text style={styles.free}>FREE</Text>}{item.access === 'premium' && <Text style={styles.premium}>PREMIUM</Text>}{soon && <Text style={styles.soon}>СКОРО</Text>}</View><Text style={styles.city}>{item.city}{!soon ? ` · нагрузка ${item.load}%` : ' · готовим запуск'}</Text></View>
      {!soon && <View style={styles.right}><Text style={[styles.ping, item.ping < 45 && styles.fast]}>{item.ping} мс</Text><Text style={[styles.marker, selected && styles.markerSelected]}>{locked ? '◆' : selected ? '●' : '○'}</Text></View>}
    </Pressable>;
  }} />;
}

const styles = StyleSheet.create({ list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 42, gap: 11 }, row: { minHeight: 82, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border }, selected: { borderColor: theme.colors.accent, backgroundColor: '#181510' }, disabled: { opacity: .52 }, pressed: { transform: [{ scale: .985 }], opacity: .82 }, flag: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surfaceElevated }, flagText: { fontSize: 23 }, info: { flex: 1 }, nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 }, name: { color: theme.colors.textPrimary, fontSize: 17, fontWeight: '700' }, city: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 19, marginTop: 5 }, free: { color: theme.colors.success, backgroundColor: '#10251D', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, premium: { color: theme.colors.accent, backgroundColor: '#2A2119', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, soon: { color: '#AAB2BF', backgroundColor: '#202630', fontSize: 10, fontWeight: '800', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 }, right: { alignItems: 'flex-end', gap: 8 }, ping: { color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }, fast: { color: theme.colors.success }, marker: { color: theme.colors.muted, fontSize: 19 }, markerSelected: { color: theme.colors.accent } });
