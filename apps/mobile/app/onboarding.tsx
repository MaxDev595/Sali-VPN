import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../src/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { LogoWordmark } from '../src/components/LogoMark';
import { BrandMark } from '../src/components/BrandMark';
import { SaliButton } from '../src/components/SaliButton';
import { useAccountStore } from '../src/store/accountStore';
import { telegramLinkUrl } from '../src/services/session';
import { theme } from '../src/theme';

const pages = [
  { glyph: '01', title: 'Приватность без сложностей', text: 'Sali защищает весь трафик устройства. Никаких ручных настроек — всё готово к работе.' },
  { glyph: '02', title: 'Одно нажатие', text: 'Выберите сервер и нажмите большую кнопку. Остальное приложение сделает само.' },
  { glyph: '03', title: 'Тариф — через Telegram', text: 'Бесплатные 24 часа и подписку выдаёт бот Sali. Он пришлёт код, который вы введёте здесь.' },
  { glyph: 'ID', title: 'Ваш Sali ID', text: 'Это номер устройства. Привяжите Telegram — бот запомнит устройство, и коды можно будет активировать одной кнопкой.' },
];

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const home = useAccountStore(state => state.home);
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);
  const dot = useSharedValue(0);
  useEffect(() => {
    opacity.value = 0; offset.value = 24;
    opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
    offset.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.cubic) });
    dot.value = withTiming(page * 22, { duration: 420, easing: Easing.inOut(Easing.cubic) });
  }, [dot, offset, opacity, page]);
  const motion = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateY: offset.value }] }));
  const dotMotion = useAnimatedStyle(() => ({ transform: [{ translateX: dot.value }] }));
  const finish = () => { router.replace('/(tabs)'); void AsyncStorage.setItem('sali.onboarding.v4.complete', '1').catch(() => {}); };
  const last = page === pages.length - 1;
  const item = pages[page]!;
  const link = () => { if (home) void Linking.openURL(telegramLinkUrl(home.user.publicId)); finish(); };

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}>
    <StatusBar style="light" />
    <View style={styles.header}>
      <BrandMark size={36} /><View style={{ flex: 1 }}><LogoWordmark height={20} /></View>
      {!last && <Pressable accessibilityRole="button" hitSlop={16} onPress={() => setPage(pages.length - 1)}><Text style={styles.skip}>Пропустить</Text></Pressable>}
    </View>
    <Animated.View style={[styles.content, motion]}>
      <View style={styles.badge}>
        {last ? <Text style={styles.idText}>{home?.user.publicId ?? 'SL-…'}</Text> : <Text style={styles.glyph}>{item.glyph}</Text>}
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.text}>{item.text}</Text>
    </Animated.View>
    <View style={styles.footer}>
      <View style={styles.dots}>{pages.map((_, index) => <Pressable key={index} hitSlop={8} onPress={() => setPage(index)} style={styles.dotSlot}><View style={styles.dot} /></Pressable>)}<Animated.View pointerEvents="none" style={[styles.dotActive, dotMotion]} /></View>
      {last ? <View style={{ gap: 10 }}>
        <SaliButton title="Привязать Telegram" onPress={link} disabled={!home} />
        <SaliButton secondary title="Позже" onPress={finish} />
      </View> : <SaliButton title="Продолжить" onPress={() => setPage(current => current + 1)} />}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 8 },
  header: { minHeight: 70, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-Bold', flex: 1 },
  skip: { color: theme.colors.accent, fontSize: 15, fontWeight: '800' },
  content: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 136, height: 136, paddingHorizontal: 24, borderRadius: 68, borderWidth: 1, borderColor: 'rgba(255,197,138,.35)', backgroundColor: theme.colors.glow, alignItems: 'center', justifyContent: 'center', marginBottom: 38 },
  glyph: { color: theme.colors.accent, fontSize: 38, fontFamily: 'SaliSans-Bold' },
  idText: { color: theme.colors.accent, fontSize: 22, fontFamily: 'SaliSans-Bold', letterSpacing: 1 },
  title: { color: theme.colors.textPrimary, fontSize: 30, lineHeight: 38, fontFamily: 'SaliSans-Bold', textAlign: 'center' },
  text: { color: theme.colors.textSecondary, fontSize: 17, lineHeight: 26, textAlign: 'center', marginTop: 14, maxWidth: 340 },
  footer: { paddingHorizontal: 24, paddingBottom: 10, gap: 22 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center', minHeight: 24, alignItems: 'center' },
  dotSlot: { width: 16, height: 24, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.muted },
  dotActive: { position: 'absolute', left: 0, width: 16, height: 7, borderRadius: 4, backgroundColor: theme.colors.accent },
});
