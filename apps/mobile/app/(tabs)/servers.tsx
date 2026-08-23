import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ServerList } from '../../src/components/ServerList';
import { fallbackServers } from '../../src/data/fallbackServers';
import { useVpnStore } from '../../src/store/vpnStore';
import { theme } from '../../src/theme';
export default function ServersScreen() { const { server, setServer } = useVpnStore(); return <SafeAreaView style={styles.safe}><View style={styles.header}><Text style={styles.title}>Серверы</Text><Text style={styles.subtitle}>Выберите локацию или доверьтесь Sali</Text></View><ServerList servers={fallbackServers} selectedId={server?.id} onSelect={setServer} /></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, header: { paddingHorizontal: 20, paddingTop: 18 }, title: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: '700' }, subtitle: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 6 } });
