import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, runOnJS, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Mask, Path } from 'react-native-svg';
import { LOGO_COLORS, LOGO_DRAW as D, LOGO_PATHS, LOGO_VIEWBOX as V } from './logoPaths';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Launch animation on the original logo (traced 1:1, original colours, white stage):
 *  1. the pen appears and draws the ring counter-clockwise, then the crescent;
 *  2. it lifts off the paper and tilts back (soft shadow underneath);
 *  3. swings over and lines up with its slot along its own axis;
 *  4. slides straight in — click: squash, the cap snaps on, two peach ripples;
 *  5. "sali" rises letter by letter, then "VPN"; the white stage fades into the app.
 * Same timeline on the landing page (apps/web/src/landing/AnimatedLogo.tsx).
 */
export const INTRO_T = {
  penIn: [0, 420], draw: [420, 1850], lift: [1850, 2180], align: [2120, 2420], insert: [2420, 2600],
  impact: [2600, 3000], ripple: [2600, 3150], ripple2: [2720, 3300], pulse: [2600, 2950],
  word: [2850, 3550], vpn: [3300, 3900], out: [4150, 4550],
} as const;
const T = INTRO_T;
const END = 4550;
const LETTERS = ['s', 'a', 'l', 'i'] as const;
const VPN = ['V', 'P', 'N'] as const;
const INK = LOGO_COLORS.navy;
const PEACH = LOGO_COLORS.peach;
const AXIS = { x: .742, y: -.671 }; // nib → cap: the pen's own axis
const A = { x: AXIS.x * 120, y: AXIS.y * 120 }; // lined up with the slot, before sliding in

const clamp = (v: number) => { 'worklet'; return Math.min(1, Math.max(0, v)); };
const phase = (t: number, w: readonly [number, number]) => { 'worklet'; return clamp((t - w[0]) / (w[1] - w[0])); };
const mix = (a: number, b: number, k: number) => { 'worklet'; return a + (b - a) * k; };
const easeInOut = (x: number) => { 'worklet'; return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
const easeOut = (x: number) => { 'worklet'; return 1 - Math.pow(1 - x, 3); };
const easeIn = (x: number) => { 'worklet'; return x * x * x; };
/** Decaying oscillation, 0 at both ends: the "click". */
const wobble = (x: number) => { 'worklet'; return Math.exp(-5 * x) * Math.sin(14 * x); };
const ringPoint = (deg: number) => { 'worklet'; const r = (deg * Math.PI) / 180; return { x: D.center.x + D.penRadius * Math.cos(r), y: D.center.y + D.penRadius * Math.sin(r) }; };

/** Pen pose (offset from its final place, in logo units) at time t. */
function penPose(t: number) {
  'worklet';
  const pIn = easeOut(phase(t, T.penIn));
  const d = easeInOut(phase(t, T.draw));
  let dx: number; let dy: number; let rot = 0; let scale = 1.04; let cap = 0; let shadow = 0;
  if (t < T.lift[0]) {
    const tip = ringPoint(D.startDeg - D.sweepDeg * d);
    dx = tip.x - D.nibTip.x; dy = tip.y - D.nibTip.y;
    if (t < T.draw[0]) { dy -= 60 * (1 - pIn); dx += 30 * (1 - pIn); scale = .9 + .14 * pIn; }
  } else {
    const end = ringPoint(D.startDeg - D.sweepDeg);
    const E = { x: end.x - D.nibTip.x, y: end.y - D.nibTip.y };
    const H = { x: E.x + 50, y: E.y - 170 };
    const l = easeOut(phase(t, T.lift)); const al = easeInOut(phase(t, T.align));
    const ins = easeIn(phase(t, T.insert)); const im = phase(t, T.impact);
    dx = mix(E.x, H.x, l); dy = mix(E.y, H.y, l); rot = mix(0, -26, l); scale = mix(1.04, 1.12, l); shadow = l;
    if (al > 0) { dx = mix(dx, A.x, al); dy = mix(dy, A.y, al); rot = mix(-26, 0, al); }
    if (ins > 0) { dx = mix(A.x, 0, ins); dy = mix(A.y, 0, ins); scale = mix(1.12, 1, ins); shadow = 1 - ins; }
    if (im > 0) { const w = wobble(im); scale = 1 - .07 * w; cap = -10 * w; dx = AXIS.x * 4 * w; dy = AXIS.y * 4 * w; rot = 2 * w; }
  }
  return { dx, dy, rot, scale, cap, shadow, opacity: pIn };
}

function Layer({ children, width, height }: { children: React.ReactNode; width: number; height: number }) {
  return <Svg width={width} height={height} viewBox={`${V.x} ${V.y} ${V.w} ${V.h}`} style={StyleSheet.absoluteFill}>{children}</Svg>;
}

function Letter({ t, d, start, lift, width, height, k }: { t: SharedValue<number>; d: string; start: number; lift: number; width: number; height: number; k: number }) {
  const style = useAnimatedStyle(() => {
    const e = easeOut(clamp((t.value - start) / 460));
    return { opacity: e, transform: [{ translateY: lift * k * (1 - e) }] };
  });
  return <Animated.View style={[StyleSheet.absoluteFill, style]}><Layer width={width} height={height}><Path d={d} fill={INK} fillRule="evenodd" /></Layer></Animated.View>;
}

export function LogoIntro({ onFinish }: { onFinish(): void }) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const width = Math.min(screenW * .5, screenH * .36 * V.w / V.h, 260);
  const height = width * V.h / V.w;
  const k = width / V.w; // px per logo unit
  const t = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      const done = (finished?: boolean) => { 'worklet'; if (finished) runOnJS(onFinish)(); };
      if (reduce) { t.value = T.out[0]; t.value = withTiming(END, { duration: 500 }, done); return; }
      t.value = withTiming(END, { duration: END, easing: Easing.linear }, done);
    });
    return () => { cancelled = true; };
  }, [onFinish, t]);
  const skip = () => { t.value = withTiming(END, { duration: 260 }, (finished) => { if (finished) runOnJS(onFinish)(); }); };

  const revealProps = useAnimatedProps(() => {
    const d = easeInOut(phase(t.value, T.draw));
    return { strokeDashoffset: D.maskLength * (1 - d), strokeOpacity: d > .002 ? 1 : 0 };
  });
  const ripple1 = useAnimatedProps(() => {
    const r = phase(t.value, T.ripple);
    return { r: 10 + 150 * easeOut(r), strokeOpacity: r > 0 && r < 1 ? .8 * (1 - r) : 0, strokeWidth: 12 * (1 - r) + 1 };
  });
  const ripple2 = useAnimatedProps(() => {
    const r = phase(t.value, T.ripple2);
    return { r: 10 + 220 * easeOut(r), strokeOpacity: r > 0 && r < 1 ? .3 * (1 - r) : 0, strokeWidth: 6 * (1 - r) + 1 };
  });

  const penStyle = useAnimatedStyle(() => {
    const p = penPose(t.value);
    return { opacity: p.opacity, transform: [{ translateX: p.dx * k }, { translateY: p.dy * k }, { rotate: `${p.rot}deg` }, { scale: p.scale }] };
  });
  const capStyle = useAnimatedStyle(() => {
    const p = penPose(t.value);
    return { transform: [{ translateX: AXIS.x * p.cap * k }, { translateY: AXIS.y * p.cap * k }] };
  });
  // Soft shadow on the paper while the pen is carried.
  const shadowStyle = useAnimatedStyle(() => {
    const p = penPose(t.value);
    return { opacity: .16 * p.shadow * p.opacity, transform: [{ translateX: p.dx * k }, { translateY: (p.dy + 6 + 18 * p.shadow) * k }, { rotate: `${p.rot}deg` }, { scale: p.scale * .98 }] };
  });
  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + Math.sin(phase(t.value, T.pulse) * Math.PI) * .035 }] }));
  const stageStyle = useAnimatedStyle(() => {
    const o = easeOut(phase(t.value, T.out));
    return { opacity: 1 - o, transform: [{ scale: 1 + .05 * o }] };
  });

  const tipOrigin = { transformOrigin: [(D.nibTip.x - V.x) * k, (D.nibTip.y - V.y) * k, 0] as [number, number, number] };
  const markOrigin = { transformOrigin: [(D.center.x - V.x) * k, (D.center.y - V.y) * k, 0] as [number, number, number] };

  return <Animated.View style={[StyleSheet.absoluteFill, styles.stage, stageStyle]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Пропустить заставку" style={styles.center} onPress={skip}>
      <View style={{ width, height }}>
        <Animated.View style={[StyleSheet.absoluteFill, markOrigin, markStyle]}>
          <Layer width={width} height={height}>
            <Defs>
              <Mask id="saliReveal" maskUnits="userSpaceOnUse" x="0" y="0" width="1254" height="1254">
                <AnimatedPath d={D.maskPath} stroke="#fff" strokeWidth={D.maskWidth} fill="none" strokeDasharray={D.maskLength} animatedProps={revealProps} />
              </Mask>
            </Defs>
            <Path d={LOGO_PATHS.ring} fill={INK} fillRule="evenodd" mask="url(#saliReveal)" />
            <Path d={LOGO_PATHS.swoosh} fill={INK} fillRule="evenodd" mask="url(#saliReveal)" />
            <AnimatedCircle cx={D.nibTip.x} cy={D.nibTip.y} fill="none" stroke={PEACH} animatedProps={ripple1} />
            <AnimatedCircle cx={D.nibTip.x} cy={D.nibTip.y} fill="none" stroke={PEACH} animatedProps={ripple2} />
          </Layer>
          <Animated.View style={[StyleSheet.absoluteFill, tipOrigin, shadowStyle]}>
            <Layer width={width} height={height}><Path d={LOGO_PATHS.nib} fill={INK} /><Path d={LOGO_PATHS.cap} fill={INK} /></Layer>
          </Animated.View>
          <Animated.View style={[StyleSheet.absoluteFill, tipOrigin, penStyle]}>
            <Layer width={width} height={height}><Path d={LOGO_PATHS.nib} fill={INK} /></Layer>
            <Animated.View style={[StyleSheet.absoluteFill, capStyle]}>
              <Layer width={width} height={height}><Path d={LOGO_PATHS.cap} fill={PEACH} /></Layer>
            </Animated.View>
          </Animated.View>
        </Animated.View>
        {LETTERS.map((key, index) => <Letter key={key} t={t} d={LOGO_PATHS[key]} start={T.word[0] + index * 85} lift={40} width={width} height={height} k={k} />)}
        {VPN.map((key, index) => <Letter key={key} t={t} d={LOGO_PATHS[key]} start={T.vpn[0] + index * 90} lift={18} width={width} height={height} k={k} />)}
      </View>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  stage: { backgroundColor: '#FFFFFF', zIndex: 100, elevation: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
