import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../src/components/Text';
import { ServerList } from '../src/components/ServerList';
import { useAccountStore } from '../src/store/accountStore';
import { theme } from '../src/theme';
import { useI18n } from '../src/i18n';

/** Location picker opened from the home screen ticket. */
export default function ServerModal() {
  const { t } = useI18n();
  const access = useAccountStore(state => state.access);
  return <SafeAreaView style={styles.safe}>
    <View style={styles.grip} />
    <ServerList
      onPicked={(server) => { if (server.premiumOnly && access !== 'premium') router.replace('/activate'); else router.back(); }}
      header={<View style={styles.header}><View style={{ flex: 1 }}><Text style={styles.title}>{t.locations}</Text><Text style={styles.subtitle}>{t.chooseLocation}</Text></View><Pressable accessibilityLabel="Закрыть" onPress={() => router.back()} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  grip: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.muted, marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 14, paddingBottom: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 28, lineHeight: 34, fontFamily: 'SaliSans-Bold' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20, marginTop: 4 },
  close: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: theme.colors.textPrimary, fontSize: 26, lineHeight: 28 },
});
