import { Tabs } from 'expo-router';
import { TabBar } from '../../src/components/TabBar';
import { theme } from '../../src/theme';
import { useI18n } from '../../src/i18n';

export default function TabsLayout() {
  const { t } = useI18n();
  return <Tabs
    tabBar={(props) => <TabBar {...props} />}
    screenOptions={{ headerShown: false, animation: 'shift', sceneStyle: { backgroundColor: theme.colors.background } }}
  >
    <Tabs.Screen name="index" options={{ title: t.vpn }} />
    <Tabs.Screen name="servers" options={{ title: t.locations }} />
    <Tabs.Screen name="devices" options={{ title: t.devices }} />
    <Tabs.Screen name="settings" options={{ title: t.profile }} />
    <Tabs.Screen name="subscription" options={{ href: null }} />
  </Tabs>;
}
