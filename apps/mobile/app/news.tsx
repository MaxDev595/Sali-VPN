import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../src/components/Text';
import { Icon } from '../src/components/Icon';
import { SaliButton } from '../src/components/SaliButton';
import { APP_VERSION, isNewerUpdate, useNewsStore } from '../src/store/newsStore';
import { openApkDownload, openNewsChannel } from '../src/services/links';
import { theme } from '../src/theme';

const when = (iso: string) => new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

/** «Что нового»: update notes and news the team sends from the Telegram bot. */
export default function NewsScreen() {
  const { items, loaded, load, markSeen } = useNewsStore();
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { markSeen(); }, [items, markSeen]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const newest = items.find(item => item.kind === 'UPDATE');

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.colors.accent} colors={[theme.colors.accent]} />}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Назад" onPress={() => router.back()} style={styles.back}><Icon name="chevron" size={20} style={{ transform: [{ scaleX: -1 }] }} /></Pressable>
        <Text style={styles.title}>Что нового</Text>
      </View>
      <Text style={styles.intro}>У вас версия {APP_VERSION}. Новости приходят и в наш Telegram-бот.</Text>

      {isNewerUpdate(newest) && <View style={{ marginBottom: 16 }}><SaliButton title={`Скачать версию ${newest!.version}`} onPress={openApkDownload} /></View>}

      {loaded && !items.length && <Text style={styles.empty}>Пока новостей нет.</Text>}
      {items.map((item, index) => <Animated.View key={item.id} entering={FadeInDown.delay(Math.min(index, 6) * 50).duration(320)} style={styles.item}>
        <View style={styles.itemHead}>
          <Text style={styles.badge}>{item.kind === 'UPDATE' ? 'ОБНОВЛЕНИЕ' : 'НОВОСТЬ'}</Text>
          <Text style={styles.date}>{when(item.createdAt)}</Text>
        </View>
        <Text style={styles.itemTitle}>{item.title}</Text>
        <Text style={styles.itemBody} selectable>{item.body}</Text>
      </Animated.View>)}

      <Pressable onPress={openNewsChannel} style={styles.more}><Text style={styles.moreText}>Наш канал @SaliVpnNews</Text><Icon name="external" size={15} color={theme.colors.accent} /></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { padding: 20, paddingBottom: 48 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: theme.colors.textPrimary, fontSize: 26, lineHeight: 32, fontFamily: 'SaliSans-Bold' },
  intro: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, marginTop: 16, marginBottom: 18 },
  empty: { color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 40 },
  item: { padding: 16, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  itemHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { color: theme.colors.accent, fontSize: 10, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  date: { color: theme.colors.textSecondary, fontSize: 12 },
  itemTitle: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold', marginTop: 6 },
  itemBody: { color: theme.colors.textSecondary, fontSize: 14.5, lineHeight: 21, marginTop: 6 },
  more: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 16 },
  moreText: { color: theme.colors.accent, fontSize: 15, fontFamily: 'SaliSans-SemiBold' },
});
