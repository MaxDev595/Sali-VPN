import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LogoWordmark } from '../../src/components/LogoMark';
import { BrandMark } from '../../src/components/BrandMark';
import { VPNControl } from '../../src/components/VPNControl';
import { TelegramLinkCard } from '../../src/components/TelegramLinkCard';
import { SaliModal } from '../../src/components/SaliModal';
import { SaliButton } from '../../src/components/SaliButton';
import { useI18n } from '../../src/i18n';
import { useVpnStore } from '../../src/store/vpnStore';
import { useAccountStore } from '../../src/store/accountStore';
import { telegramBotUrl, telegramLinkUrl } from '../../src/services/session';
import { theme } from '../../src/theme';

const FLAGS: Record<string, string> = { NL: '🇳🇱', DE: '🇩🇪', FI: '🇫🇮', CH: '🇨🇭', US: '🇺🇸' };
function formatDuration(started: number | null, now: number) { if (!started) return '00:00:00'; const seconds = Math.max(0, Math.floor((now - started) / 1000)); return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(v => String(v).padStart(2, '0')).join(':'); }

export default function VpnScreen() {
  const { status, server, connectedAt, toggle, error, needsCode, clearError } = useVpnStore();
  const home = useAccountStore(state => state.home);
  const { t } = useI18n();
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const openBot = () => void Linking.openURL(home && !home.user.telegramLinked ? telegramLinkUrl(home.user.publicId) : telegramBotUrl());

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.brand}><BrandMark size={40} /><View style={{ gap: 3 }}><LogoWordmark height={19} /><Text style={styles.sub}>{home ? `ID ${home.user.publicId}` : 'PRIVATE NETWORK'}</Text></View></View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/activate')} style={({ pressed }) => [styles.codeButton, pressed && { opacity: .8 }]}><Text style={styles.codeButtonText}>Ввести код</Text></Pressable>
      </View>

      <Animated.View entering={FadeInDown.duration(420)}><TelegramLinkCard compact /></Animated.View>

      <View style={styles.hero}>
        <Text style={styles.status}>{status === 'connected' ? t.protectedConnection : t.privacy}</Text>
        <VPNControl status={status} onPress={() => void toggle()} />
        <Text style={[styles.timer, status !== 'connected' && { opacity: 0 }]}>{formatDuration(connectedAt, now)}</Text>
        {error && !needsCode ? <Text style={styles.error} onPress={clearError}>{error}</Text> : null}
      </View>

      <Animated.View entering={FadeInDown.delay(120).duration(420)}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/servers')} style={({ pressed }) => [styles.serverCard, pressed && styles.pressed]}>
          <View style={styles.flag}><Text style={{ fontSize: 24 }}>{FLAGS[server?.countryCode ?? ''] ?? '🌐'}</Text></View>
          <View style={{ flex: 1 }}><Text style={styles.caption}>{t.currentServer}</Text><Text style={styles.server}>{server?.country}</Text><Text style={styles.city}>{server?.city} · {server?.ping} мс</Text></View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      </Animated.View>
    </ScrollView>

    <SaliModal visible={needsCode} title="Нужен тариф" onClose={clearError}>
      <Text style={styles.modalText}>Чтобы подключиться, активируйте код. Бесплатный тариф и коды выдаёт наш Telegram-бот.</Text>
      <View style={{ gap: 10, marginTop: 20 }}>
        <SaliButton title="Ввести код" onPress={() => { clearError(); router.push('/activate'); }} />
        <SaliButton secondary title="Открыть Telegram-бот" onPress={() => { clearError(); openBot(); }} />
      </View>
    </SaliModal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  logo: { color: theme.colors.textPrimary, fontSize: 19, fontFamily: 'Outfit-Bold' },
  sub: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  codeButton: { paddingHorizontal: 14, height: 38, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: 'rgba(255,197,138,.4)', backgroundColor: theme.colors.glow, justifyContent: 'center' },
  codeButtonText: { color: theme.colors.accent, fontSize: 13, fontWeight: '800' },
  hero: { flex: 1, minHeight: 440, justifyContent: 'center', gap: 18 },
  status: { color: theme.colors.textSecondary, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  timer: { color: theme.colors.textPrimary, fontSize: 20, fontFamily: 'Outfit-SemiBold', fontVariant: ['tabular-nums'], textAlign: 'center' },
  error: { color: theme.colors.error, textAlign: 'center', fontSize: 14, lineHeight: 20, paddingHorizontal: 20 },
  serverCard: { minHeight: 88, borderRadius: theme.radius.lg, padding: 15, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 13 },
  pressed: { opacity: .85, transform: [{ scale: .99 }] },
  flag: { width: 50, height: 50, borderRadius: 16, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  caption: { color: theme.colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 1.1 },
  server: { color: theme.colors.textPrimary, fontSize: 17, fontFamily: 'Outfit-SemiBold', marginTop: 2 },
  city: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  chevron: { color: theme.colors.textSecondary, fontSize: 30 },
  modalText: { color: theme.colors.textSecondary, fontSize: 16, lineHeight: 23, textAlign: 'center' },
});
