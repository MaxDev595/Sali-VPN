import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Text } from './Text';
import { Icon } from './Icon';
import { useNewsStore, isNewerUpdate } from '../store/newsStore';
import { openApkDownload } from '../services/links';
import { theme } from '../theme';

/**
 * Main screen: the latest update note or news from the bot, until it is closed.
 * A newer app version stays visible with a «Скачать» button even after closing.
 */
export function NewsCard() {
  const { items, seenId, markSeen } = useNewsStore();
  const latest = items[0];
  const update = items.find(item => item.kind === 'UPDATE');
  const outdated = isNewerUpdate(update);
  const item = latest && latest.id !== seenId ? latest : outdated ? update : null;
  if (!item) return null;
  const newer = isNewerUpdate(item);

  return <Animated.View entering={FadeInDown.duration(380)} exiting={FadeOut.duration(160)} style={[styles.card, newer && styles.cardUpdate]}>
    <Pressable accessibilityRole="button" onPress={() => { markSeen(); router.push('/news'); }} style={({ pressed }) => [styles.body, pressed && { opacity: .8 }]}>
      <Text style={styles.kicker}>{newer ? 'ДОСТУПНО ОБНОВЛЕНИЕ' : item.kind === 'UPDATE' ? 'ЧТО НОВОГО' : 'НОВОСТИ'}</Text>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.text} numberOfLines={2}>{item.body}</Text>
    </Pressable>
    <View style={styles.side}>
      {item.id !== seenId && <Pressable accessibilityLabel="Скрыть" hitSlop={10} onPress={markSeen} style={styles.close}><Icon name="close" size={12} color={theme.colors.textSecondary} /></Pressable>}
      {newer && <Pressable accessibilityRole="button" onPress={openApkDownload} style={({ pressed }) => [styles.download, pressed && { opacity: .85 }]}><Text style={styles.downloadText}>Скачать</Text></Pressable>}
    </View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingRight: 12, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  cardUpdate: { backgroundColor: '#14141F', borderColor: 'rgba(255,197,135,0.35)' },
  body: { flex: 1 },
  kicker: { color: theme.colors.accent, fontSize: 10, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  title: { color: theme.colors.textPrimary, fontSize: 15.5, fontFamily: 'SaliSans-SemiBold', marginTop: 3 },
  text: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 18, marginTop: 2 },
  side: { alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', gap: 8 },
  close: { width: 24, height: 24, borderRadius: 12, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  download: { height: 34, paddingHorizontal: 14, borderRadius: 17, backgroundColor: theme.colors.primary, justifyContent: 'center', marginTop: 'auto' },
  downloadText: { color: theme.colors.onPrimary, fontSize: 13.5, fontFamily: 'SaliSans-Bold' },
});
