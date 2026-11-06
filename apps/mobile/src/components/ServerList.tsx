import { useQuery } from '@tanstack/react-query';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useEffect } from 'react';
import { Text } from './Text';
import type { VPNServer } from '../types';
import { api } from '../services/api/client';
import { ensureSession } from '../services/session';
import { fallbackServers, FLAGS } from '../data/fallbackServers';
import { useVpnStore } from '../store/vpnStore';
import { useAccountStore } from '../store/accountStore';
import { theme } from '../theme';
import { useI18n } from '../i18n';
import { openHelp } from '../services/links';

/** Real locations from GET /servers; the three main ones while the API is unreachable. */
export function useServers() {
  const query = useQuery({ queryKey: ['servers'], queryFn: async () => { await ensureSession(); return api.servers(); }, retry: 1, staleTime: 60_000 });
  const adopt = useVpnStore(state => state.adoptServer);
  useEffect(() => { if (query.data?.length) adopt(query.data); }, [adopt, query.data]);
  return { servers: query.data?.length ? query.data : fallbackServers, offline: query.isError, loading: query.isLoading };
}

function Load({ value }: { value: number | null }) {
  if (value == null) return null;
  const level = value < 40 ? 1 : value < 75 ? 2 : 3;
  return <View style={styles.load} accessibilityLabel={`Нагрузка ${value}%`}>{[1, 2, 3].map(i => <View key={i} style={[styles.loadBar, { height: 4 + i * 3 }, i <= level && { backgroundColor: level === 3 ? theme.colors.warning : theme.colors.success }]} />)}</View>;
}

export function ServerList({ onPicked, header }: { onPicked?(server: VPNServer): void; header?: React.ReactElement }) {
  const { t } = useI18n();
  const { servers, offline } = useServers();
  const { server: selected, setServer, status } = useVpnStore();
  const access = useAccountStore(state => state.access);
  const hasPlan = access === 'premium';

  const pick = (item: VPNServer) => {
    if (item.premiumOnly && !hasPlan) return onPicked?.(item);
    setServer(item);
    onPicked?.(item);
  };

  return <FlatList
    data={servers}
    keyExtractor={item => item.id}
    contentContainerStyle={styles.list}
    showsVerticalScrollIndicator={false}
    ListHeaderComponent={<>{header}{offline && <Text style={styles.offline}>{t.offline}</Text>}</>}
    ListFooterComponent={<Pressable onPress={() => openHelp('servers')} style={styles.footer}><Text style={styles.footerText}>{t.serversHelp} ↗</Text></Pressable>}
    renderItem={({ item, index }) => {
      const isSelected = selected?.id === item.id || (!selected?.remote && selected?.countryCode === item.countryCode && !item.premiumOnly);
      const locked = item.premiumOnly && !hasPlan;
      return <Animated.View entering={FadeInDown.delay(index * 45).duration(360)}>
        <Pressable accessibilityRole="radio" accessibilityState={{ checked: isSelected }} onPress={() => pick(item)} style={({ pressed }) => [styles.row, isSelected && styles.selected, pressed && styles.pressed]}>
          <Text style={styles.flag}>{FLAGS[item.countryCode] ?? '🌐'}</Text>
          <View style={styles.info}>
            <View style={styles.nameLine}>
              <Text style={styles.name}>{item.country}</Text>
              {item.recommended && <Text style={styles.badge}>{t.recommended}</Text>}
            </View>
            <Text style={styles.city}>{item.city}{item.ping ? ` · ${item.ping} мс` : ''}{locked ? ` · ${t.needsPlan}` : ''}</Text>
          </View>
          <Load value={item.load} />
          <View style={[styles.radio, isSelected && styles.radioOn]}>{isSelected && <View style={styles.radioCap} />}</View>
        </Pressable>
      </Animated.View>;
    }}
    extraData={`${selected?.id}-${status}-${hasPlan}`}
  />;
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  offline: { color: theme.colors.warning, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  row: { minHeight: 74, borderRadius: theme.radius.lg, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  selected: { borderColor: 'rgba(255,197,135,.45)', backgroundColor: theme.colors.surfaceElevated },
  pressed: { transform: [{ scale: .985 }] },
  flag: { fontSize: 26 },
  info: { flex: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold' },
  badge: { color: theme.colors.accent, fontSize: 11, fontFamily: 'SaliSans-Bold', backgroundColor: theme.colors.glow, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  city: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 },
  load: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  loadBar: { width: 3, borderRadius: 1.5, backgroundColor: theme.colors.muted },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: theme.colors.accent },
  radioCap: { width: 11, height: 4, borderRadius: 2, backgroundColor: theme.colors.accent, transform: [{ rotate: theme.cap.angle }] },
  footer: { alignSelf: 'center', paddingVertical: 18 },
  footerText: { color: theme.colors.accent, fontSize: 14, fontFamily: 'SaliSans-SemiBold' },
});
