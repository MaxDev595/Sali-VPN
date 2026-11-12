import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { Text } from '../../src/components/Text';
import { BrandMark } from '../../src/components/BrandMark';
import { Icon } from '../../src/components/Icon';
import { VPNControl } from '../../src/components/VPNControl';
import { NewsCard } from '../../src/components/NewsCard';
import { SaliModal } from '../../src/components/SaliModal';
import { SaliButton } from '../../src/components/SaliButton';
import { useI18n } from '../../src/i18n';
import { useVpnStore } from '../../src/store/vpnStore';
import { useAccountStore } from '../../src/store/accountStore';
import { usePreferencesStore } from '../../src/store/preferencesStore';
import { linkTelegram, telegramBotUrl } from '../../src/services/session';
import { TelegramLinkCard } from '../../src/components/TelegramLinkCard';
import { FLAGS } from '../../src/data/fallbackServers';
import { theme } from '../../src/theme';

const pad = (n: number) => String(n).padStart(2, '0');
function clock(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; }

/** Tariff half of the ticket: subscription date, free-time countdown or "enter a code". */
function TariffStub() {
  const { home, access } = useAccountStore();
  const [now, setNow] = useState(Date.now());
  const synced = useRef(Date.now());
  useEffect(() => { synced.current = Date.now(); }, [home]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  if (access === 'premium' && home?.subscription) {
    const until = home.subscription.expiresAt ? new Date(home.subscription.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '∞';
    return <><Text style={styles.stubMain}>до {until}</Text><Text style={styles.stubSub}>Подписка</Text></>;
  }
  if (access === 'trial' && home?.trial) {
    const left = home.trial.secondsRemaining - (now - synced.current) / 1000;
    return <><Text style={[styles.stubMain, styles.mono]}>{clock(left)}</Text><Text style={styles.stubSub}>Бесплатно</Text></>;
  }
  return <><Text style={[styles.stubMain, { color: theme.colors.accent }]}>Ввести код</Text><Text style={styles.stubSub}>{access === 'expired' ? 'Тариф закончился' : 'Нет тарифа'}</Text></>;
}

export default function VpnScreen() {
  const { status, server, connectedAt, toggle, error, needsCode, clearError } = useVpnStore();
  const home = useAccountStore(state => state.home);
  const access = useAccountStore(state => state.access);
  const prefs = usePreferencesStore();
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  const autoTried = useRef(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);

  // Auto-connect: once per launch, as soon as we know there is a tariff.
  useEffect(() => {
    if (autoTried.current || !prefs.hydrated || !home) return;
    autoTried.current = true;
    if (prefs.autoConnect && (access === 'premium' || access === 'trial') && status === 'disconnected') void toggle();
  }, [access, home, prefs.autoConnect, prefs.hydrated, status, toggle]);

  const openBot = () => void Linking.openURL(telegramBotUrl());
  const linked = Boolean(home?.user.telegramLinked);
  const refreshAccount = useAccountStore(state => state.refresh);
  const signIn = () => home && void linkTelegram(home.user.publicId, refreshAccount);
  const active = status === 'connected';
  const title = status === 'connecting' ? t.stateConnecting : status === 'disconnecting' ? t.disconnecting : active ? t.stateOn : status === 'error' ? t.stateError : t.stateOff;
  const label = active ? t.disconnect : t.connect;

  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Sali ID ${home?.user.publicId ?? ''}`} onPress={() => home && void Share.share({ message: home.user.publicId })} style={({ pressed }) => [styles.idChip, pressed && { opacity: .75 }]}>
          <BrandMark size={30} />
          <View><Text style={styles.idLabel}>SALI ID</Text><Text style={styles.idValue}>{home?.user.publicId ?? '····-····'}</Text></View>
        </Pressable>
        {!linked
          ? <Pressable accessibilityRole="button" onPress={signIn} style={({ pressed }) => [styles.codeButton, pressed && { opacity: .8 }]}>
              <Icon name="telegram" size={16} color={theme.colors.accent} /><Text style={styles.codeText}>Войти</Text>
            </Pressable>
          : access !== 'premium'
            ? <Pressable accessibilityRole="button" onPress={openBot} style={({ pressed }) => [styles.codeButton, pressed && { opacity: .8 }]}>
                <Icon name="key" size={16} color={theme.colors.accent} /><Text style={styles.codeText}>Купить</Text>
              </Pressable>
            : home?.account ? <Pressable accessibilityRole="button" onPress={() => router.push('/devices')} style={({ pressed }) => [styles.codeButton, pressed && { opacity: .8 }]}>
                <Icon name="devices" size={16} color={theme.colors.accent} /><Text style={styles.codeText}>{home.account.used}/{home.account.max}</Text>
              </Pressable> : null}
      </View>

      <TelegramLinkCard />
      <NewsCard />

      <View style={styles.hero}>
        <Animated.Text key={`k-${status}`} entering={FadeIn.duration(260)} exiting={FadeOut.duration(120)} style={[styles.kicker, active && { color: theme.colors.success }]}>
          {active && connectedAt ? clock((now - connectedAt) / 1000) : ' '}
        </Animated.Text>
        <VPNControl status={status} label={label} onPress={() => void toggle()} />
        <Animated.Text key={`t-${status}`} entering={FadeInDown.duration(320)} style={styles.title}>{title}</Animated.Text>
        {status === 'error' && error && !needsCode
          ? <Animated.View entering={FadeInDown.duration(300)} style={styles.errorCard}>
              <Icon name="info" size={18} color={theme.colors.error} />
              <Text style={styles.errorText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => { clearError(); void toggle(); }} style={({ pressed }) => [styles.retry, pressed && { opacity: .8 }]}><Text style={styles.retryText}>Повторить</Text></Pressable>
            </Animated.View>
          : <Text style={styles.subtitle}>{active ? t.tapToDisconnect : status === 'connecting' || status === 'disconnecting' ? ' ' : t.tapToConnect}</Text>}
      </View>

      {/* Ticket: tariff stub | location, joined by a perforation. */}
      <Animated.View entering={FadeInDown.delay(120).duration(420)} style={styles.ticket}>
        <Pressable accessibilityRole="button" onPress={() => (!linked ? signIn() : access === 'premium' ? router.push('/devices') : openBot())} style={({ pressed }) => [styles.stub, pressed && styles.pressed]}>
          <Text style={styles.stubLabel}>{t.tariff}</Text>
          <TariffStub />
        </Pressable>
        <View style={styles.perforation}>
          <View style={[styles.notch, styles.notchTop]} />
          <View style={styles.dashes}>{Array.from({ length: 7 }).map((_, i) => <View key={i} style={styles.dash} />)}</View>
          <View style={[styles.notch, styles.notchBottom]} />
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/servers')} style={({ pressed }) => [styles.stub, styles.stubWide, pressed && styles.pressed]}>
          <Text style={styles.stubLabel}>{t.location}</Text>
          <View style={styles.locationLine}>
            <Text style={styles.flag}>{FLAGS[server?.countryCode ?? ''] ?? '🌐'}</Text>
            <Text style={styles.stubMain} numberOfLines={1}>{server?.city ?? t.auto}</Text>
          </View>
          <Text style={styles.stubSub} numberOfLines={1}>{server?.ping ? `${server.country} · ${server.ping} мс` : server?.country ?? ''}</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>

    <SaliModal visible={needsCode} title={linked ? 'Нужна подписка' : 'Войдите через Telegram'} onClose={clearError}>
      <Text style={styles.modalText}>{linked
        ? 'Купите подписку в нашем Telegram-боте — она сразу заработает здесь и на всех ваших устройствах (до 3).'
        : 'Один вход — и сразу 24 часа бесплатно. Подписка из бота работает на всех ваших устройствах (до 3).'}</Text>
      <View style={{ gap: 10, marginTop: 20 }}>
        {linked
          ? <SaliButton title="Купить подписку" onPress={() => { clearError(); openBot(); }} />
          : <SaliButton title="Войти через Telegram" onPress={() => { clearError(); signIn(); }} />}
        <SaliButton secondary title="У меня есть код" onPress={() => { clearError(); router.push('/activate'); }} />
      </View>
    </SaliModal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  idChip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 8 },
  idLabel: { color: theme.colors.textSecondary, fontSize: 10, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold' },
  idValue: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: 'SaliSans-SemiBold', letterSpacing: .6, marginTop: 1 },
  codeButton: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 14, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  codeText: { color: theme.colors.textPrimary, fontSize: 14, fontFamily: 'SaliSans-SemiBold' },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  kicker: { color: theme.colors.textSecondary, fontSize: 15, fontFamily: 'SaliSans-SemiBold', letterSpacing: 1.2, fontVariant: ['tabular-nums'], height: 22 },
  title: { color: theme.colors.textPrimary, fontSize: 28, lineHeight: 34, fontFamily: 'SaliSans-Bold', textAlign: 'center', marginTop: 4 },
  subtitle: { color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 6 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 10, paddingLeft: 14, paddingRight: 8, borderRadius: 16, backgroundColor: 'rgba(255,122,122,0.08)', borderWidth: 1, borderColor: 'rgba(255,122,122,0.22)', maxWidth: 360 },
  errorText: { flex: 1, color: '#FFB4B4', fontSize: 13.5, lineHeight: 19 },
  retry: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: theme.colors.surfaceElevated, justifyContent: 'center' },
  retryText: { color: theme.colors.textPrimary, fontSize: 13, fontFamily: 'SaliSans-SemiBold' },
  ticket: { flexDirection: 'row', borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  stub: { flex: 1, paddingVertical: 15, paddingHorizontal: 16 },
  stubWide: { flex: 1.25 },
  pressed: { backgroundColor: theme.colors.surfaceElevated },
  stubLabel: { color: theme.colors.textSecondary, fontSize: 10, letterSpacing: 1.6, fontFamily: 'SaliSans-Bold', marginBottom: 6 },
  stubMain: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold', flexShrink: 1 },
  stubSub: { color: theme.colors.textSecondary, fontSize: 12, marginTop: 2 },
  mono: { fontVariant: ['tabular-nums'] },
  locationLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  flag: { fontSize: 18 },
  perforation: { width: 14, alignItems: 'center', justifyContent: 'space-between' },
  notch: { width: 14, height: 7, backgroundColor: theme.colors.background, borderColor: theme.colors.border },
  notchTop: { borderBottomLeftRadius: 7, borderBottomRightRadius: 7, borderWidth: 1, borderTopWidth: 0, marginTop: -1 },
  notchBottom: { borderTopLeftRadius: 7, borderTopRightRadius: 7, borderWidth: 1, borderBottomWidth: 0, marginBottom: -1 },
  dashes: { flex: 1, justifyContent: 'space-evenly', paddingVertical: 4 },
  dash: { width: 1.5, height: 5, borderRadius: 1, backgroundColor: theme.colors.muted },
  modalText: { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center' },
});
