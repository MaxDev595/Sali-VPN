import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../../src/components/Text';
import { PlatformIcon } from '../../src/components/PlatformIcon';
import { SectionLabel } from '../../src/components/List';
import { useAccountStore } from '../../src/store/accountStore';
import { telegramBotUrl, telegramLinkUrl } from '../../src/services/session';
import { openHelp } from '../../src/services/links';
import { useI18n } from '../../src/i18n';
import { theme } from '../../src/theme';

/**
 * Every device row opens salivpn.com/help/devices: how Sali ID, linking and
 * "one code — one device" work. The list of linked devices itself lives in the bot.
 */
export default function DevicesScreen() {
  const { t } = useI18n();
  const home = useAccountStore(state => state.home);
  const access = useAccountStore(state => state.access);
  const status = access === 'premium' ? 'Подписка активна' : access === 'trial' ? 'Бесплатный тариф' : 'Нет тарифа';
  const platforms = [
    { id: 'android' as const, name: 'Android', detail: 'Телефоны и планшеты · Android 7+' },
    { id: 'windows' as const, name: 'Windows', detail: 'Компьютеры и ноутбуки · Windows 10, 11' },
  ];

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t.devices}</Text>
      <Text style={styles.subtitle}>Один код — одно устройство. Все ваши устройства видны в боте: «Мои устройства».</Text>

      <Animated.View entering={FadeInDown.duration(380)}>
        <Pressable accessibilityRole="link" onPress={() => openHelp('devices')} style={({ pressed }) => [styles.current, pressed && styles.pressed]}>
          <View style={styles.currentTop}>
            <View style={styles.icon}><PlatformIcon platform="android" size={30} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.kicker}>ЭТО УСТРОЙСТВО</Text>
              <Text style={styles.currentName}>Android</Text>
            </View>
            <Text style={styles.external}>↗</Text>
          </View>
          <View style={styles.facts}>
            <View style={styles.fact}><Text style={styles.factLabel}>Sali ID</Text><Text style={styles.factValue}>{home?.user.publicId ?? '—'}</Text></View>
            <View style={styles.fact}><Text style={styles.factLabel}>Тариф</Text><Text style={styles.factValue}>{status}</Text></View>
            <View style={styles.fact}><Text style={styles.factLabel}>Telegram</Text><Text style={styles.factValue}>{home?.user.telegramLinked ? 'привязан' : 'не привязан'}</Text></View>
          </View>
        </Pressable>
      </Animated.View>

      <SectionLabel>SALI VPN ЕСТЬ НА</SectionLabel>
      {platforms.map((item, index) => <Animated.View key={item.id} entering={FadeInDown.delay(80 + index * 60).duration(360)}>
        <Pressable accessibilityRole="link" onPress={() => openHelp('devices')} style={({ pressed }) => [styles.platform, pressed && styles.pressed]}>
          <View style={styles.icon}><PlatformIcon platform={item.id} size={30} /></View>
          <View style={{ flex: 1 }}><Text style={styles.platformName}>{item.name}</Text><Text style={styles.platformDetail}>{item.detail}</Text></View>
          <Text style={styles.external}>↗</Text>
        </Pressable>
      </Animated.View>)}

      <View style={styles.add}>
        <Text style={styles.addTitle}>Добавить устройство</Text>
        <Text style={styles.addText}>Установите Sali VPN на второе устройство, привяжите его к Telegram и активируйте код кнопкой в боте — он спросит, на какое устройство.</Text>
        <Pressable onPress={() => void Linking.openURL(home && !home.user.telegramLinked ? telegramLinkUrl(home.user.publicId) : telegramBotUrl())} style={({ pressed }) => [styles.addButton, pressed && { opacity: .8 }]}><Text style={styles.addButtonText}>Открыть бота</Text></Pressable>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  title: { color: theme.colors.textPrimary, fontSize: 34, lineHeight: 40, fontFamily: 'SaliSans-Bold' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  pressed: { transform: [{ scale: .985 }], opacity: .92 },
  current: { borderRadius: theme.radius.xl, padding: 18, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: 'rgba(255,197,135,.3)' },
  currentTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: 50, height: 50, borderRadius: 15, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: theme.colors.accent, fontSize: 11, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  currentName: { color: theme.colors.textPrimary, fontSize: 22, fontFamily: 'SaliSans-SemiBold', marginTop: 2 },
  external: { color: theme.colors.accent, fontSize: 18, fontFamily: 'SaliSans-Bold' },
  facts: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border, paddingTop: 6 },
  fact: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  factLabel: { color: theme.colors.textSecondary, fontSize: 14 },
  factValue: { color: theme.colors.textPrimary, fontSize: 14, fontFamily: 'SaliSans-Medium' },
  platform: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 13, marginBottom: 10, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  platformName: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold' },
  platformDetail: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 3 },
  add: { marginTop: 18, padding: 18, borderRadius: theme.radius.lg, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.muted },
  addTitle: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'SaliSans-SemiBold' },
  addText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  addButton: { alignSelf: 'flex-start', marginTop: 14, paddingHorizontal: 16, height: 40, borderRadius: 20, backgroundColor: theme.colors.surfaceElevated, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center' },
  addButtonText: { color: theme.colors.textPrimary, fontSize: 14, fontFamily: 'SaliSans-SemiBold' },
});
