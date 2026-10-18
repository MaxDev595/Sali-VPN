import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { theme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

type IconName = 'shield' | 'servers' | 'devices' | 'settings';
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
      {name === 'shield' && <Path d="M4 11.5L12 4l8 7.5M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'servers' && <><Rect x={3} y={4} width={18} height={6} rx={2} stroke={color} strokeWidth={1.8} /><Rect x={3} y={14} width={18} height={6} rx={2} stroke={color} strokeWidth={1.8} /><Path d="M7 7h.01M7 17h.01" stroke={color} strokeWidth={2.5} strokeLinecap="round" /></>}
      {name === 'devices' && <><Rect x={7} y={2} width={10} height={20} rx={2} stroke={color} strokeWidth={1.8} /><Path d="M11 18h2" stroke={color} strokeWidth={1.8} strokeLinecap="round" /></>}
      {name === 'settings' && <><Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={1.8} /><Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.32 9c.14.36.5.6 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={color} strokeWidth={1.6} strokeLinejoin="round" /></>}
    </Svg>
  </View>;
}

export default function TabsLayout() {
  const { t } = useI18n();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.accent, tabBarInactiveTintColor: '#6B6B6B', tabBarHideOnKeyboard: true, tabBarStyle: styles.tabBar, tabBarItemStyle: styles.tabItem, tabBarLabelStyle: styles.tabLabel }}>
    <Tabs.Screen name="index" options={{ title: 'VPN', tabBarIcon: ({ color, focused }) => <TabIcon name="shield" color={color} focused={focused} /> }} />
    <Tabs.Screen name="servers" options={{ title: t.servers, tabBarIcon: ({ color, focused }) => <TabIcon name="servers" color={color} focused={focused} /> }} />
    <Tabs.Screen name="devices" options={{ title: 'Устройства', tabBarIcon: ({ color, focused }) => <TabIcon name="devices" color={color} focused={focused} /> }} /><Tabs.Screen name="subscription" options={{ href: null }} />
    <Tabs.Screen name="settings" options={{ title: t.settings, tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ tabBar: { backgroundColor: '#000000', borderTopColor: theme.colors.border, height: 76, paddingTop: 7, paddingBottom: 8 }, tabItem: { borderRadius: 16, marginHorizontal: 2 }, tabLabel: { fontSize: 12, lineHeight: 15, fontWeight: '600', marginTop: 2 }, iconBox: { width: 34, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, iconBoxActive: { backgroundColor: '#1C1C1C' } });
