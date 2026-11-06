import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Path } from 'react-native-svg';
import { Text } from './Text';
import { theme } from '../theme';

type Icon = 'vpn' | 'locations' | 'devices' | 'profile';
const ICONS: Record<string, Icon> = { index: 'vpn', servers: 'locations', devices: 'devices', settings: 'profile' };

function Glyph({ name, color }: { name: Icon; color: string }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    {name === 'vpn' && <><Circle cx={12} cy={12} r={7.5} stroke={color} strokeWidth={1.8} strokeDasharray="38 9" transform="rotate(-50 12 12)" /><Path d="M15.6 8.4l2.6-2.6" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></>}
    {name === 'locations' && <><Circle cx={12} cy={12} r={8} stroke={color} strokeWidth={1.8} /><Path d="M4 12h16M12 4c2.4 2.2 3.4 5 3.4 8s-1 5.8-3.4 8c-2.4-2.2-3.4-5-3.4-8s1-5.8 3.4-8z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" /></>}
    {name === 'devices' && <><Path d="M3 16.5V7a2 2 0 0 1 2-2h9" stroke={color} strokeWidth={1.8} strokeLinecap="round" /><Path d="M2 17.5h11" stroke={color} strokeWidth={1.8} strokeLinecap="round" /><Path d="M16 9.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 22 9.5v9a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 16 18.5z" stroke={color} strokeWidth={1.8} /></>}
    {name === 'profile' && <><Circle cx={12} cy={8.5} r={3.5} stroke={color} strokeWidth={1.8} /><Path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></>}
  </Svg>;
}

/**
 * Bottom navigation with the logo's peach pen cap as the marker: it slides
 * under the current tab instead of a pill or an underline.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((route) => ICONS[route.name]);
  const index = Math.max(0, routes.findIndex((route) => route.key === state.routes[state.index]?.key));
  const [width, setWidth] = useState(0);
  const x = useSharedValue(0);
  const slot = routes.length ? width / routes.length : 0;
  useEffect(() => { x.value = withSpring(index * slot + slot / 2 - theme.cap.width / 2, { damping: 18, stiffness: 220, mass: .7 }); }, [index, slot, x]);
  const cap = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }, { rotate: theme.cap.angle }], opacity: slot ? 1 : 0 }));

  return <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <Animated.View pointerEvents="none" style={[styles.cap, cap]} />
    {routes.map((route, i) => {
      const focused = i === index;
      const { options } = descriptors[route.key]!;
      const title = typeof options.title === 'string' ? options.title : route.name;
      const color = focused ? theme.colors.cream : '#5E6A85';
      const onPress = () => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) { void Haptics.selectionAsync(); navigation.navigate(route.name, route.params); }
      };
      return <Pressable key={route.key} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={title} onPress={onPress} style={styles.item}>
        <Glyph name={ICONS[route.name]!} color={color} />
        <Text style={[styles.label, { color }]}>{title}</Text>
      </Pressable>;
    })}
  </View>;
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: theme.colors.tabBar, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 12 },
  cap: { position: 'absolute', top: 4, left: 0, width: theme.cap.width, height: theme.cap.height, borderRadius: theme.cap.radius, backgroundColor: theme.colors.accent },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  label: { fontSize: 11, fontFamily: 'SaliSans-SemiBold', letterSpacing: .2 },
});
