import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

type IconName = 'shield' | 'servers' | 'premium' | 'settings';
function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <View style={[styles.iconBox, focused && styles.iconBoxActive]}>
    {name === 'shield' && <View style={[styles.shield, { borderColor: color }]}><View style={[styles.shieldDot, { backgroundColor: color }]} /></View>}
    {name === 'servers' && <View style={styles.serverIcon}>{[0, 1, 2].map(i => <View key={i} style={[styles.serverLine, { backgroundColor: color, width: 19 - i * 3 }]} />)}</View>}
    {name === 'premium' && <View style={[styles.diamond, { borderColor: color }]} />}
    {name === 'settings' && <View style={[styles.gear, { borderColor: color }]}><View style={[styles.gearCore, { borderColor: color }]} /></View>}
  </View>;
}

export default function TabsLayout() {
  const { t } = useI18n();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: theme.colors.accent, tabBarInactiveTintColor: '#7D8796', tabBarHideOnKeyboard: true, tabBarStyle: styles.tabBar, tabBarItemStyle: styles.tabItem, tabBarLabelStyle: styles.tabLabel }}>
    <Tabs.Screen name="index" options={{ title: 'VPN', tabBarIcon: ({ color, focused }) => <TabIcon name="shield" color={color} focused={focused} /> }} />
    <Tabs.Screen name="servers" options={{ title: t.servers, tabBarIcon: ({ color, focused }) => <TabIcon name="servers" color={color} focused={focused} /> }} />
    <Tabs.Screen name="subscription" options={{ title: 'Premium', tabBarIcon: ({ color, focused }) => <TabIcon name="premium" color={color} focused={focused} /> }} />
    <Tabs.Screen name="settings" options={{ title: t.settings, tabBarIcon: ({ color, focused }) => <TabIcon name="settings" color={color} focused={focused} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ tabBar: { backgroundColor: '#0B1016', borderTopColor: theme.colors.border, height: 76, paddingTop: 7, paddingBottom: 8 }, tabItem: { borderRadius: 16, marginHorizontal: 2 }, tabLabel: { fontSize: 12, lineHeight: 15, fontWeight: '600', marginTop: 2 }, iconBox: { width: 34, height: 30, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, iconBoxActive: { backgroundColor: '#2A2119' }, shield: { width: 17, height: 20, borderWidth: 2, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, alignItems: 'center', justifyContent: 'center' }, shieldDot: { width: 5, height: 5, borderRadius: 3 }, serverIcon: { gap: 3, alignItems: 'center' }, serverLine: { height: 4, borderRadius: 3 }, diamond: { width: 16, height: 16, borderWidth: 2, borderRadius: 3, transform: [{ rotate: '45deg' }] }, gear: { width: 20, height: 20, borderWidth: 2, borderRadius: 6, alignItems: 'center', justifyContent: 'center' }, gearCore: { width: 7, height: 7, borderWidth: 2, borderRadius: 4 } });
