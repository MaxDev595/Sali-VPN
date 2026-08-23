import { router } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ServerList } from '../src/components/ServerList';
import { fallbackServers } from '../src/data/fallbackServers';
import { useVpnStore } from '../src/store/vpnStore';
import { theme } from '../src/theme';
export default function ServerModal() { const { server, setServer } = useVpnStore(); return <SafeAreaView style={styles.safe}><View style={styles.header}><View><Text style={styles.kicker}>SALI NETWORK</Text><Text style={styles.title}>Выберите сервер</Text></View><Pressable accessibilityLabel="Закрыть" onPress={() => router.back()} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View><ServerList servers={fallbackServers} selectedId={server?.id} onSelect={(next) => { setServer(next); router.back(); }} /></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, header: { padding: 20, paddingTop: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, kicker: { color: theme.colors.accent, fontSize: 9, letterSpacing: 1.5 }, title: { color: theme.colors.textPrimary, fontSize: 27, fontWeight: '700', marginTop: 4 }, close: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, closeText: { color: theme.colors.textPrimary, fontSize: 25 } });
