import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BrandMark } from '../src/components/BrandMark';
import { SaliButton } from '../src/components/SaliButton';
import { theme } from '../src/theme';

const pages = [
  { number: '01', title: 'Приватность без сложности', text: 'Sali защищает весь трафик устройства. Никаких ручных настроек — всё готово к работе.' },
  { number: '02', title: 'Подключение в одно нажатие', text: 'Выберите подходящий сервер и нажмите большую кнопку. Остальное приложение сделает само.' },
  { number: '03', title: 'Свобода каждый день', text: 'Быстрый, спокойный и приватный интернет дома, в дороге и в общественных сетях.' },
];

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const opacity = useSharedValue(1);
  const offset = useSharedValue(0);
  const dotPosition = useSharedValue(0);
  useEffect(() => { opacity.value = 0; offset.value = 18; opacity.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }); offset.value = withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }); dotPosition.value = withTiming(page * 36, { duration: 420, easing: Easing.inOut(Easing.cubic) }); }, [dotPosition, offset, opacity, page]);
  const contentMotion = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: offset.value }] }));
  const dotMotion = useAnimatedStyle(() => ({ transform: [{ translateX: dotPosition.value }] }));
  const finish = () => { router.replace('/(tabs)'); void AsyncStorage.setItem('sali.onboarding.v3.complete', '1').catch(() => {}); };
  const next = () => page === pages.length - 1 ? finish() : setPage(current => current + 1);
  const item = pages[page]!;

  return <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.safe}><StatusBar style="light" backgroundColor={theme.colors.background} /><View style={styles.header}><BrandMark size={42} /><Text style={styles.brandName}>Sali VPN</Text><Pressable accessibilityRole="button" accessibilityLabel="Пропустить онбординг" hitSlop={16} onPress={finish} style={({ pressed }) => [styles.skipButton, pressed && styles.pressed]}><Text style={styles.skip}>Пропустить</Text></Pressable></View><Animated.View style={[styles.content, contentMotion]}><View style={styles.numberCircle}><Text style={styles.number}>{item.number}</Text></View><Text style={styles.title}>{item.title}</Text><Text style={styles.text}>{item.text}</Text></Animated.View><View style={styles.footer}><View style={styles.dots}>{pages.map((_, index) => <Pressable accessibilityRole="button" accessibilityLabel={`Экран ${index + 1}`} key={index} onPress={() => setPage(index)} hitSlop={8} style={styles.dotSlot}><View style={styles.dot} /></Pressable>)}<Animated.View pointerEvents="none" style={[styles.dotActive, dotMotion]} /></View><SaliButton title={page === pages.length - 1 ? 'Начать пользоваться' : 'Продолжить'} onPress={next} /></View></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background, paddingTop: 8 }, header: { minHeight: 76, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 5 }, brandName: { color: theme.colors.textPrimary, fontSize: 20, fontWeight: '700', flex: 1 }, skipButton: { minHeight: 48, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' }, skip: { color: theme.colors.accent, fontSize: 16, fontWeight: '800' }, pressed: { opacity: .55 }, content: { flex: 1, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }, numberCircle: { width: 132, height: 132, borderRadius: 66, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginBottom: 38 }, number: { color: theme.colors.accent, fontSize: 34, fontWeight: '800' }, title: { color: theme.colors.textPrimary, fontSize: 32, lineHeight: 38, fontWeight: '800', textAlign: 'center' }, text: { color: theme.colors.textSecondary, fontSize: 18, lineHeight: 27, textAlign: 'center', marginTop: 16, maxWidth: 340 }, footer: { paddingHorizontal: 24, paddingBottom: 10, gap: 24, zIndex: 5 }, dots: { position: 'relative', flexDirection: 'row', gap: 8, alignSelf: 'center', minHeight: 28, alignItems: 'center' }, dotSlot: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.muted }, dotActive: { position: 'absolute', left: 0, width: 28, height: 9, borderRadius: 5, backgroundColor: theme.colors.accent } });
