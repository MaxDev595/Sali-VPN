import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Text } from '../../src/components/Text';
import { ServerList } from '../../src/components/ServerList';
import { useAccountStore } from '../../src/store/accountStore';
import { theme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

export default function LocationsScreen() {
  const { t } = useI18n();
  const access = useAccountStore(state => state.access);
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ServerList
      onPicked={(server) => { if (server.premiumOnly && access !== 'premium') router.push('/activate'); }}
      header={<View style={styles.header}><Text style={styles.title}>{t.locations}</Text><Text style={styles.subtitle}>{t.chooseLocation}</Text></View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingTop: 18, paddingBottom: 12 },
  title: { color: theme.colors.textPrimary, fontSize: 34, lineHeight: 40, fontFamily: 'SaliSans-Bold' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 6 },
});
