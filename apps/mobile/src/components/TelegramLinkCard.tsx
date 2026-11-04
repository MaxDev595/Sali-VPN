import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useAccountStore } from '../store/accountStore';
import { telegramLinkUrl } from '../services/session';
import { theme } from '../theme';

/**
 * "Фиксация клиента": the first thing a store-app user sees. One tap opens the
 * bot with start=link_<SaliID>, the bot remembers this device, and from then on
 * codes, reminders and support land in the customer's Telegram.
 */
export function TelegramLinkCard({ compact = false }: { compact?: boolean }) {
  const home = useAccountStore(state => state.home);
  if (!home || home.user.telegramLinked) return null;
  return <Pressable accessibilityRole="button" onPress={() => void Linking.openURL(telegramLinkUrl(home.user.publicId))} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.icon}><Text style={styles.iconText}>✈︎</Text></View>
    <View style={styles.copy}>
      <Text style={styles.title}>Привяжите Telegram</Text>
      {!compact && <Text style={styles.text}>Бесплатные 24 часа, коды и напоминания придут в бот Sali. Ваш ID: <Text style={styles.id}>{home.user.publicId}</Text></Text>}
    </View>
    <Text style={styles.chevron}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: theme.radius.lg, backgroundColor: '#0C1A33', borderWidth: 1, borderColor: '#1E3460' },
  pressed: { opacity: .85, transform: [{ scale: .99 }] },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#fff', fontSize: 20, marginLeft: -2 },
  copy: { flex: 1 },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  text: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  id: { color: theme.colors.accent, fontWeight: '700' },
  chevron: { color: theme.colors.textSecondary, fontSize: 28 },
});
