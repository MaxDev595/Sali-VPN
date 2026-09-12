import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ServerList } from '../../src/components/ServerList';
import { fallbackServers } from '../../src/data/fallbackServers';
import { api } from '../../src/services/api/client';
import { useVpnStore } from '../../src/store/vpnStore';
import { getEntitlement } from '../../src/utils/entitlement';
import { theme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

export default function ServersScreen() {
  const { server, setServer } = useVpnStore();
  const { t } = useI18n();
  const home = useQuery({ queryKey: ['home'], queryFn: api.home, retry: false });
  const hasPremium = getEntitlement(home.data) === 'premium';
  return <SafeAreaView style={styles.safe}><View style={styles.header}><Text style={styles.kicker}>SALI NETWORK</Text><Text style={styles.title}>{t.servers}</Text><Text style={styles.subtitle}>{t.serverSummary}</Text></View><ServerList servers={fallbackServers} selectedId={server?.id} hasPremium={hasPremium} onSelect={setServer} onPremium={() => router.push('/subscription')} /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, header: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8 }, kicker: { color: theme.colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, title: { color: theme.colors.textPrimary, fontSize: 34, fontWeight: '800', marginTop: 7 }, subtitle: { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 22, marginTop: 7 } });
