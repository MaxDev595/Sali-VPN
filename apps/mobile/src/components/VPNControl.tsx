import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { theme } from '../theme';
import type { VPNStatus } from '../types';
import { useI18n } from '../i18n';
import { AccessPill } from './AccessPill';
import { LogoMark } from './LogoMark';

/** Big connect button: peach orbit while connecting, soft breathing halo when protected. */
export function VPNControl({ status, onPress }: { status: VPNStatus; onPress(): void }) {
  const { t } = useI18n();
  const spin = useSharedValue(0); const breathe = useSharedValue(0); const on = useSharedValue(0);
  const active = status === 'connected'; const loading = status === 'connecting' || status === 'disconnecting';
  useEffect(() => { spin.value = loading ? withRepeat(withTiming(1, { duration: 1300, easing: Easing.linear }), -1) : withTiming(0, { duration: 200 }); }, [loading, spin]);
  useEffect(() => { breathe.value = active ? withRepeat(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }), -1, true) : withTiming(0, { duration: 300 }); }, [active, breathe]);
  useEffect(() => { on.value = withTiming(active ? 1 : 0, { duration: 520, easing: Easing.out(Easing.cubic) }); }, [active, on]);
  const orbit = useAnimatedStyle(() => ({ opacity: loading ? 1 : 0, transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: interpolate(on.value, [0, 1], [0, .9]), transform: [{ scale: 1 + .06 * breathe.value }] }));
  const ring = useAnimatedStyle(() => ({ borderColor: on.value > .5 ? theme.colors.success : theme.colors.border }));
  return <View style={styles.control}>
    <Pressable accessibilityRole="button" accessibilityLabel={active ? 'Отключить VPN' : t.connect} onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && { transform: [{ scale: .97 }] }]}>
      <Animated.View style={[styles.halo, halo]} />
      <Animated.View style={[styles.ring, ring]}>
        <Animated.View style={[styles.orbit, orbit]}><View style={styles.spark} /></Animated.View>
        <View style={[styles.core, active && styles.coreActive]}>
          <LogoMark size={64} />
          <Text style={[styles.label, active && styles.labelActive]}>{status === 'connecting' ? t.connecting : status === 'disconnecting' ? t.disconnecting : active ? t.online : t.connect}</Text>
          <Text style={styles.eyebrow}>{loading ? t.wait : active ? t.protected : 'НАЖМИТЕ'}</Text>
        </View>
      </Animated.View>
    </Pressable>
    <AccessPill status={status} />
  </View>;
}
const SIZE = 240;
const styles = StyleSheet.create({
  control: { alignItems: 'center', gap: 22 },
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE + 44, height: SIZE + 44, borderRadius: (SIZE + 44) / 2, backgroundColor: theme.colors.successGlow },
  ring: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 14 },
  orbit: { ...StyleSheet.absoluteFillObject, borderRadius: SIZE / 2 },
  spark: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.accent, position: 'absolute', top: -6, left: SIZE / 2 - 6, shadowColor: theme.colors.accent, shadowOpacity: .9, shadowRadius: 10, elevation: 8 },
  core: { flex: 1, borderRadius: SIZE, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center', gap: 6 },
  coreActive: { backgroundColor: '#0B2A2A' },
  eyebrow: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 2.4, fontWeight: '700' },
  label: { color: theme.colors.textPrimary, fontSize: 22, fontFamily: 'Outfit-SemiBold', marginTop: 4 },
  labelActive: { color: theme.colors.success },
});
