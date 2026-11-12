import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { useAccountStore } from '../store/accountStore';
import { linkTelegram } from '../services/session';
import { theme } from '../theme';

/**
 * Optional: link Telegram so the subscription survives reinstalling and codes/reminders land
 * in the bot. The VPN never needs it — a code entered in the app is enough.
 */
export function TelegramLinkCard() {
  const home = useAccountStore(state => state.home);
  const refresh = useAccountStore(state => state.refresh);
  if (!home || home.user.telegramLinked) return null;
  return <Pressable accessibilityRole="button" onPress={() => void linkTelegram(home.user.publicId, refresh)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.icon}><Icon name="telegram" size={20} color="#fff" /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>Привязать Telegram <Text style={styles.optional}>· по желанию</Text></Text>
      <Text style={styles.text}>Подписка сохранится при переустановке. Ваш номер: <Text style={styles.id}>{home.user.publicId}</Text> — если бот не ответил, просто отправьте ему этот номер.</Text>
    </View>
    <Icon name="chevron" size={18} color={theme.colors.textSecondary} />
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14, borderRadius: theme.radius.lg, backgroundColor: '#0C1A33', borderWidth: 1, borderColor: '#1E3460' },
  pressed: { opacity: .85, transform: [{ scale: .99 }] },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#2AABEE', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1 },
  title: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  optional: { color: theme.colors.textSecondary, fontSize: 13, fontFamily: 'SaliSans-Regular' },
  text: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  id: { color: theme.colors.accent, fontWeight: '700' },
});
