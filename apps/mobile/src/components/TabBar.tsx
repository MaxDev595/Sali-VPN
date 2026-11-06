import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, interpolate, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Icon, type IconName } from './Icon';
import { theme } from '../theme';

const ICONS: Record<string, IconName> = { index: 'key', servers: 'globe', devices: 'devices', settings: 'user' };
const IDLE = '#5E6A85';
const ACTIVE = theme.colors.accent;
const DURATION = 560;
const ICON = 24;
const DROP = 14;

/**
 * The active icon is peach. On tap the colour leaves the old icon as a drop,
 * flies in a low arc to the new tab (stretching on the way, like liquid) and
 * pours into the new icon.
 */
function TabIcon({ name, index, from, to, progress }: { name: IconName; index: number; from: SharedValue<number>; to: SharedValue<number>; progress: SharedValue<number> }) {
  const lit = useAnimatedStyle(() => {
    const p = progress.value;
    let opacity = 0;
    if (index === to.value) opacity = from.value === to.value ? 1 : interpolate(p, [.72, 1], [0, 1], 'clamp');
    else if (index === from.value) opacity = interpolate(p, [0, .25], [1, 0], 'clamp');
    return { opacity, transform: [{ scale: index === to.value ? interpolate(p, [.7, .86, 1], [1, 1.16, 1], 'clamp') : 1 }] };
  });
  const dim = useAnimatedStyle(() => {
    const p = progress.value;
    const sink = index === from.value && from.value !== to.value ? interpolate(p, [0, .12, .3], [1, .9, 1], 'clamp') : 1;
    return { transform: [{ scale: sink }] };
  });
  return <View style={styles.iconBox}>
    <Animated.View style={dim}><Icon name={name} size={ICON} color={IDLE} /></Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, styles.center, lit]}><Icon name={name} size={ICON} color={ACTIVE} /></Animated.View>
  </View>;
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((route) => ICONS[route.name]);
  const index = Math.max(0, routes.findIndex((route) => route.key === state.routes[state.index]?.key));
  const [width, setWidth] = useState(0);
  const slot = routes.length ? width / routes.length : 0;
  const from = useSharedValue(index);
  const to = useSharedValue(index);
  const progress = useSharedValue(1);
  const last = useRef(index);

  useEffect(() => {
    if (index === last.current) return;
    from.value = last.current;
    to.value = index;
    last.current = index;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DURATION, easing: Easing.bezier(.45, 0, .2, 1) });
  }, [from, index, progress, to]);

  const drop = useAnimatedStyle(() => {
    const p = progress.value;
    const a = from.value * slot + slot / 2;
    const b = to.value * slot + slot / 2;
    const travel = interpolate(p, [.18, .8], [0, 1], 'clamp');
    const x = a + (b - a) * travel - DROP / 2;
    const lift = -Math.sin(Math.PI * travel) * 18;           // low arc over the bar
    const speed = Math.sin(Math.PI * travel);                 // fastest mid-way
    const stretch = 1 + speed * Math.min(2.2, Math.abs(b - a) / Math.max(slot, 1) * 1.1);
    const visible = from.value !== to.value && p > .1 && p < .9;
    return {
      opacity: visible ? interpolate(p, [.1, .2, .8, .9], [0, 1, 1, 0], 'clamp') : 0,
      transform: [
        { translateX: x },
        { translateY: lift },
        { scaleX: stretch },
        { scaleY: interpolate(speed, [0, 1], [1, .7]) },
      ],
    };
  });

  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <View pointerEvents="none" style={styles.dropLane}><Animated.View style={[styles.drop, drop]} /></View>
    {routes.map((route, i) => {
      const focused = i === index;
      const { options } = descriptors[route.key]!;
      const title = typeof options.title === 'string' ? options.title : route.name;
      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) { void Haptics.selectionAsync(); navigation.navigate(route.name, route.params); }
      };
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} onPress={onPress} style={styles.item}>
        <TabIcon name={ICONS[route.name]!} index={i} from={from} to={to} progress={progress} />
        <Animated.Text style={[styles.label, { color: focused ? theme.colors.cream : IDLE }]}>{title}</Animated.Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: theme.colors.tabBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 10 },
  dropLane: { position: 'absolute', left: 0, right: 0, top: 10 + 4 + (ICON + 8) / 2 - DROP / 2, height: DROP },
  drop: { position: 'absolute', left: 0, top: 0, width: DROP, height: DROP, borderRadius: DROP / 2, backgroundColor: ACTIVE },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  iconBox: { width: ICON + 8, height: ICON + 8, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontFamily: 'SaliSans-SemiBold', letterSpacing: .2 },
});
