import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '../theme';
import type { VPNStatus } from '../types';
import { useI18n } from '../i18n';
import { FreeTrialTimer } from './FreeTrialTimer';
export function VPNControl({ status, onPress }: { status: VPNStatus; onPress(): void }) {
  const { t } = useI18n();
  const spin = useSharedValue(0); const active = status === 'connected'; const loading = status === 'connecting' || status === 'disconnecting';
  useEffect(() => { spin.value = loading ? withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1) : 0; }, [loading, spin]);
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  return <View style={styles.control}><Pressable accessibilityRole="button" accessibilityLabel={active ? 'Disconnect VPN' : t.connect} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { transform: [{ scale: .98 }] }]}><View style={[styles.ring, active && styles.active]}><Animated.View style={[styles.orbit, orbit]}><View style={[styles.spark, active && { backgroundColor: theme.colors.success }]} /></Animated.View><View style={styles.core}><Text style={styles.eyebrow}>{loading ? t.wait : active ? t.protected : 'SALI VPN'}</Text><Text style={styles.label}>{status === 'connecting' ? t.connecting : status === 'disconnecting' ? t.disconnecting : active ? t.online : t.connect}</Text></View></View></Pressable><FreeTrialTimer status={status} /></View>;
}
const styles = StyleSheet.create({ control: { alignItems: 'center', gap: 14 }, wrap: { width: 246, height: 246, alignSelf: 'center' }, ring: { flex: 1, borderRadius: 123, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 13 }, active: { borderColor: theme.colors.success }, orbit: { ...StyleSheet.absoluteFillObject, borderRadius: 123 }, spark: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.accent, position: 'absolute', top: -5, left: 118 }, core: { flex: 1, borderRadius: 110, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 2 }, label: { color: theme.colors.textPrimary, fontSize: 23, fontWeight: '700', marginTop: 8 } });
