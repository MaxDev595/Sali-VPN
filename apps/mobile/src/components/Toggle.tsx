import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

const W = 50;
const H = 30;
const KNOB = 24;
const PAD = (H - KNOB) / 2;

/**
 * Sali switch. Off: muted track, grey knob. On: peach track with a deep-navy knob —
 * the same pair as the main buttons, so it reads clearly on the dark cards.
 * The knob glides on a soft spring and stretches a little while moving.
 */
export function Toggle({ value, onChange, label }: { value: boolean; onChange(value: boolean): void; label?: string }) {
  const on = useSharedValue(value ? 1 : 0);
  const press = useSharedValue(0);
  useEffect(() => { on.value = withSpring(value ? 1 : 0, { damping: 17, stiffness: 190, mass: .8 }); }, [on, value]);

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], ['#26324B', theme.colors.accent]),
    borderColor: interpolateColor(on.value, [0, 1], ['#34425F', 'rgba(255,197,135,0)']),
  }));
  const knob = useAnimatedStyle(() => {
    const travel = W - KNOB - PAD * 2 - 2;
    const moving = Math.sin(Math.PI * Math.min(1, Math.max(0, on.value)));
    return {
      backgroundColor: interpolateColor(on.value, [0, 1], ['#8792AB', '#0A1730']),
      width: KNOB + moving * 6 + press.value * 4,
      transform: [{ translateX: on.value * travel - (on.value > .5 ? press.value * 4 : 0) }],
    };
  });
  const glow = useAnimatedStyle(() => ({ opacity: interpolate(on.value, [0, 1], [0, .55]) }));

  return <Pressable
    accessibilityRole="switch"
    accessibilityState={{ checked: value }}
    accessibilityLabel={label}
    hitSlop={8}
    onPressIn={() => { press.value = withTiming(1, { duration: 120 }); }}
    onPressOut={() => { press.value = withTiming(0, { duration: 200 }); }}
    onPress={() => { void Haptics.selectionAsync(); onChange(!value); }}
  >
    <Animated.View style={[styles.glow, glow]} />
    <Animated.View style={[styles.track, track]}><Animated.View style={[styles.knob, knob]} /></Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: -4, right: -4, top: -4, bottom: -4, borderRadius: (H + 8) / 2, backgroundColor: 'rgba(255,197,135,.18)' },
  track: { width: W, height: H, borderRadius: H / 2, borderWidth: 1, padding: PAD, justifyContent: 'center' },
  knob: { height: KNOB, borderRadius: KNOB / 2 },
});
