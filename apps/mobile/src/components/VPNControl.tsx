import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, cancelAnimation, interpolate, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Path } from 'react-native-svg';
import { theme } from '../theme';
import type { VPNStatus } from '../types';
import { LOGO_DRAW as D, LOGO_PATHS, MARK_VIEWBOX as V } from './logoPaths';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 248;
const RING_R = 118;
const RING_LEN = 2 * Math.PI * RING_R;

/**
 * The connect button is the logo itself.
 * Off: a faint ghost of the mark. Connecting: the pen draws the ring and the
 * crescent, again and again, like the launch animation. On: the mark is drawn in
 * full, the peach cap lights up and an outer ring closes around it.
 */
export function VPNControl({ status, onPress, label }: { status: VPNStatus; onPress(): void; label: string }) {
  const draw = useSharedValue(0);
  const on = useSharedValue(0);
  const press = useSharedValue(0);
  const busy = status === 'connecting' || status === 'disconnecting';
  const active = status === 'connected';

  useEffect(() => {
    cancelAnimation(draw);
    if (status === 'connecting') {
      draw.value = 0;
      draw.value = withRepeat(withSequence(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.cubic) }), withTiming(1, { duration: 220 }), withTiming(0, { duration: 0 })), -1);
    } else if (status === 'disconnecting') {
      draw.value = withTiming(0, { duration: 700, easing: Easing.in(Easing.cubic) });
    } else {
      draw.value = withTiming(active ? 1 : 0, { duration: active ? 600 : 400, easing: Easing.out(Easing.cubic) });
    }
    on.value = withTiming(active ? 1 : 0, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [active, draw, on, status]);

  const reveal = useAnimatedProps(() => ({ strokeDashoffset: D.maskLength * (1 - draw.value) }));
  const outer = useAnimatedProps(() => ({ strokeDashoffset: RING_LEN * (1 - on.value), strokeOpacity: on.value }));
  const capStyle = useAnimatedProps(() => ({ fillOpacity: interpolate(on.value, [0, 1], [.35, 1]) }));
  const nibStyle = useAnimatedProps(() => ({ fillOpacity: Math.max(on.value, draw.value > .98 ? 1 : 0) }));
  const halo = useAnimatedStyle(() => ({ opacity: on.value * .9, transform: [{ scale: .92 + .08 * on.value }] }));
  const body = useAnimatedStyle(() => ({ transform: [{ scale: 1 - .035 * press.value }] }));

  const mark = SIZE * .46;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ busy, checked: active }}
    onPressIn={() => { press.value = withTiming(1, { duration: 120 }); }}
    onPressOut={() => { press.value = withTiming(0, { duration: 220 }); }}
    onPress={onPress}
    style={styles.wrap}
  >
    <Animated.View pointerEvents="none" style={[styles.halo, halo]} />
    <Animated.View style={[styles.body, body]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} stroke={theme.colors.hairline} strokeWidth={1.5} fill="none" />
        <AnimatedCircle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} stroke={theme.colors.success} strokeWidth={2} fill="none" strokeLinecap="round" strokeDasharray={RING_LEN} animatedProps={outer} transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`} />
      </Svg>
      <View style={styles.markBox}>
        <Svg width={mark} height={mark * V.h / V.w} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`}>
          <Defs>
            <Mask id="controlReveal" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
              <AnimatedPath d={D.maskPath} stroke="#fff" strokeWidth={D.maskWidth} fill="none" strokeDasharray={D.maskLength} animatedProps={reveal} />
            </Mask>
          </Defs>
          {/* ghost */}
          <Path d={LOGO_PATHS.ring} fill={theme.colors.ghost} fillRule="evenodd" />
          <Path d={LOGO_PATHS.swoosh} fill={theme.colors.ghost} fillRule="evenodd" />
          <Path d={LOGO_PATHS.nib} fill={theme.colors.ghost} />
          {/* ink */}
          <Path d={LOGO_PATHS.ring} fill={theme.colors.cream} fillRule="evenodd" mask="url(#controlReveal)" />
          <Path d={LOGO_PATHS.swoosh} fill={theme.colors.cream} fillRule="evenodd" mask="url(#controlReveal)" />
          <AnimatedPath d={LOGO_PATHS.nib} fill={theme.colors.cream} animatedProps={nibStyle} />
          <AnimatedPath d={LOGO_PATHS.cap} fill={theme.colors.accent} animatedProps={capStyle} />
        </Svg>
      </View>
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({
  wrap: { width: SIZE + 40, height: SIZE + 40, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE + 36, height: SIZE + 36, borderRadius: (SIZE + 36) / 2, backgroundColor: theme.colors.successGlow },
  body: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  markBox: { alignItems: 'center', justifyContent: 'center' },
});
