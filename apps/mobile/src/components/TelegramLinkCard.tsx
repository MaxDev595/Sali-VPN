import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon } from './Icon';
import { useAccountStore } from '../store/accountStore';
import { linkCodeOf, linkTelegram } from '../services/session';
import { theme } from '../theme';

/**
 * Linking Telegram is needed only to pay: the subscription then belongs to the account, works on
 * all its devices (up to 3) and survives reinstalling. The free 24 hours never need it.
 */
export function TelegramLinkCard() {
  const home = useAccountStore(state => state.home);
  const refresh = useAccountStore(state => state.refresh);
  if (!home || home.user.telegramLinked) return null;
  return <Pressable accessibilityRole="button" onPress={() => void linkTelegram(linkCodeOf(home), refresh)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.icon}><Icon name="telegram" size={20} color="#fff" /></View>
    <View style={styles.copy}>
      <Text style={styles.title}>Привязать Telegram</Text>
      <Text style={styles.text}>Нужно для оплаты: подписка будет на вашем аккаунте, заработает на всех ваших устройствах (до 3) и не пропадёт при переустановке.</Text>
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
