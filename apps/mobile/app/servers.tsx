import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ServerList } from '../src/components/ServerList';
import { fallbackServers } from '../src/data/fallbackServers';
import { api } from '../src/services/api/client';
import { useVpnStore } from '../src/store/vpnStore';
import { getEntitlement } from '../src/utils/entitlement';
import { theme } from '../src/theme';

export default function ServerModal() {
  const { server, setServer } = useVpnStore();
  const home = useQuery({ queryKey: ['home'], queryFn: api.home, retry: false });
  const hasPremium = getEntitlement(home.data) === 'premium';
  return <SafeAreaView style={styles.safe}><View style={styles.header}><View style={styles.copy}><Text style={styles.kicker}>SALI NETWORK</Text><Text style={styles.title}>Выберите сервер</Text><Text style={styles.subtitle}>1 Free · 3 Premium · 10 скоро</Text></View><Pressable accessibilityLabel="Закрыть" onPress={() => router.back()} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><ServerList servers={fallbackServers} selectedId={server?.id} hasPremium={hasPremium} onSelect={next => { setServer(next); router.back(); }} onPremium={() => router.push('/subscription')} /></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 7, flexDirection: 'row', alignItems: 'flex-start' }, copy: { flex: 1 }, kicker: { color: theme.colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.4 }, title: { color: theme.colors.textPrimary, fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 6 }, subtitle: { color: theme.colors.textSecondary, fontSize: 15, marginTop: 5 }, close: { width: 46, height: 46, borderRadius: 23, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, closeText: { color: theme.colors.textPrimary, fontSize: 29, lineHeight: 31 } });
