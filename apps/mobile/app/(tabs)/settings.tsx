import { useEffect, useState } from 'react';
import { Linking, PermissionsAndroid, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../../src/components/Text';
import { SaliModal } from '../../src/components/SaliModal';
import { Group, Row, SectionLabel } from '../../src/components/List';
import { TelegramLinkCard } from '../../src/components/TelegramLinkCard';
import { Icon } from '../../src/components/Icon';
import { useI18n } from '../../src/i18n';
import { Language, usePreferencesStore } from '../../src/store/preferencesStore';
import { useAccountStore } from '../../src/store/accountStore';
import { telegramBotUrl, telegramLinkUrl } from '../../src/services/session';
import { openHelp, openSite } from '../../src/services/links';
import { theme } from '../../src/theme';

const APP_VERSION = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '—';

export default function ProfileScreen() {
  const prefs = usePreferencesStore();
  const { t } = useI18n();
  const home = useAccountStore(state => state.home);
  const access = useAccountStore(state => state.access);
  const [languageOpen, setLanguageOpen] = useState(false);
  useEffect(() => { if (!prefs.hydrated) void prefs.hydrate(); }, [prefs]);

  const chooseLanguage = (language: Language) => { void prefs.set('language', language); setLanguageOpen(false); };
  const toggleNotifications = async (enabled: boolean) => {
    if (enabled && Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if (result !== PermissionsAndroid.RESULTS.GRANTED) return;
    }
    await prefs.set('notifications', enabled);
  };
  const toggleKillSwitch = (value: boolean) => {
    void prefs.set('killSwitch', value);
    // Android owns the real kill switch: "Always-on VPN" + "Block connections without VPN".
    if (value && Platform.OS === 'android') void Linking.sendIntent('android.settings.VPN_SETTINGS').catch(() => openHelp('kill-switch'));
  };

  const until = home?.subscription?.expiresAt ? new Date(home.subscription.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  const tariff = access === 'premium' ? (until ? `Подписка до ${until}` : 'Подписка') : access === 'trial' ? 'Бесплатный тариф' : access === 'expired' ? 'Тариф закончился' : 'Нет тарифа';

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>{t.profile}</Text>

      {/* Identity card: Sali ID is the account, shown like a pass. */}
      <Animated.View entering={FadeInDown.duration(380)} style={styles.pass}>
        <View style={styles.passBadge}><Icon name="shield" size={26} color={theme.colors.accent} /></View>
        <Text style={styles.passLabel}>SALI ID</Text>
        <Pressable onPress={() => home && void Share.share({ message: home.user.publicId })} hitSlop={8}><Text style={styles.passId}>{home?.user.publicId ?? '····-····'}</Text></Pressable>
        <View style={styles.passFoot}>
          <Icon name={access === 'premium' || access === 'trial' ? 'check' : 'info'} size={16} color={access === 'premium' ? theme.colors.success : access === 'trial' ? theme.colors.accent : theme.colors.textSecondary} />
          <Text style={styles.passTariff}>{tariff}</Text>
          <Pressable onPress={() => router.push('/activate')} style={({ pressed }) => [styles.passButton, pressed && { opacity: .8 }]}><Text style={styles.passButtonText}>Ввести код</Text></Pressable>
        </View>
      </Animated.View>

      <View style={{ marginTop: 14 }}><TelegramLinkCard /></View>

      <SectionLabel icon="user">{t.account}</SectionLabel>
      <Group>
        <Row title="Telegram" hint={home?.user.telegramLinked ? 'Коды и напоминания приходят в бот' : 'Привяжите, чтобы активировать коды одной кнопкой'} value={home?.user.telegramLinked ? 'Привязан' : 'Привязать'} onPress={() => void Linking.openURL(home && !home.user.telegramLinked ? telegramLinkUrl(home.user.publicId) : telegramBotUrl())} />
        <Row title="Оплата и коды" kind="external" onPress={() => openHelp('payments')} last />
      </Group>

      <SectionLabel icon="shield">{t.connection}</SectionLabel>
      <Group>
        <Row title={t.autoConnect} hint={t.autoConnectHint} toggle={prefs.autoConnect} onToggle={value => void prefs.set('autoConnect', value)} onInfo={() => openHelp('auto-connect')} />
        <Row title={t.killSwitch} hint={t.killSwitchHint} toggle={prefs.killSwitch} onToggle={toggleKillSwitch} onInfo={() => openHelp('kill-switch')} />
        <Row title={t.protocol} value="WireGuard" kind="external" onPress={() => openHelp('protocol')} />
        <Row title={t.dns} value="1.1.1.1" kind="external" onPress={() => openHelp('dns')} last />
      </Group>

      <SectionLabel icon="gear">{t.app}</SectionLabel>
      <Group>
        <Row title={t.language} value={prefs.language === 'ru' ? t.russian : t.english} onPress={() => setLanguageOpen(true)} />
        <Row title={t.notifications} toggle={prefs.notifications} onToggle={value => void toggleNotifications(value)} last />
      </Group>

      <SectionLabel icon="help">{t.support}</SectionLabel>
      <Group>
        <Row title="Что нового" onPress={() => router.push('/news')} />
        <Row title={t.help} onPress={() => router.push('/support')} />
        <Row title={t.docs} kind="external" onPress={() => openHelp()} />
        <Row title={t.privacyPolicy} kind="external" onPress={() => openSite('/privacy')} />
        <Row title={t.terms} kind="external" onPress={() => openSite('/terms')} />
        <Row title={t.version} value={APP_VERSION} kind="none" last />
      </Group>
    </ScrollView>

    <SaliModal visible={languageOpen} title={t.selectLanguage} onClose={() => setLanguageOpen(false)}>
      {(['ru', 'en'] as const).map(language => <Pressable key={language} style={styles.option} onPress={() => chooseLanguage(language)}>
        <Text style={styles.optionText}>{language === 'ru' ? 'Русский' : 'English'}</Text>
        <View style={[styles.radio, prefs.language === language && styles.radioOn]}>{prefs.language === language && <Icon name="check" size={14} color={theme.colors.onPrimary} />}</View>
      </Pressable>)}
    </SaliModal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  title: { color: theme.colors.textPrimary, fontSize: 34, lineHeight: 40, fontFamily: 'SaliSans-Bold', marginBottom: 16 },
  pass: { borderRadius: theme.radius.xl, padding: 20, backgroundColor: '#0B1630', borderWidth: 1, borderColor: '#1B2C4E', overflow: 'hidden' },
  passBadge: { position: 'absolute', right: 18, top: 18, width: 46, height: 46, borderRadius: 15, backgroundColor: 'rgba(255,197,135,.12)', alignItems: 'center', justifyContent: 'center' },
  passLabel: { color: '#8E9CBB', fontSize: 11, letterSpacing: 2, fontFamily: 'SaliSans-Bold' },
  passId: { color: theme.colors.cream, fontSize: 30, letterSpacing: 2, fontFamily: 'SaliSans-SemiBold', marginTop: 6, fontVariant: ['tabular-nums'] },
  passFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18 },
  passTariff: { flex: 1, color: '#C9D2E6', fontSize: 14 },
  passButton: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: theme.colors.accent, justifyContent: 'center' },
  passButtonText: { color: theme.colors.onPrimary, fontSize: 13, fontFamily: 'SaliSans-Bold' },
  option: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border },
  optionText: { color: theme.colors.textPrimary, fontSize: 17 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.muted, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
});
