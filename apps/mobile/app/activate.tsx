import { useEffect, useRef, useState, type ElementRef } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, TextInput } from '../src/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SaliButton } from '../src/components/SaliButton';
import { api, RedeemResult } from '../src/services/api/client';
import { ensureSession, telegramBotUrl } from '../src/services/session';
import { useAccountStore } from '../src/store/accountStore';
import { theme } from '../src/theme';

const ALPHABET = /[^0-9A-Z]/g;
/** Keeps whatever was typed or pasted readable: SALI-XXXX-XXXX-XXXX. */
function formatInput(raw: string) {
  let s = raw.toUpperCase().replace(ALPHABET, '');
  if (s.startsWith('SALI')) s = s.slice(4);
  s = s.slice(0, 12);
  const groups = s.match(/.{1,4}/g) ?? [];
  return groups.length ? `SALI-${groups.join('-')}` : '';
}
const isComplete = (value: string) => value.replace(ALPHABET, '').length === 16;

function describe(result: RedeemResult) {
  if (result.kind === 'FREE') return { title: 'Бесплатные 24 часа включены', text: 'Можно подключаться: 24 часа VPN без ограничений с этого момента.' };
  const until = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return { title: 'Подписка активирована', text: until ? `Доступ открыт до ${until}. Все серверы уже ваши.` : 'Все серверы уже ваши.' };
}

/** The store app's whole "payment" UI: type the code the Telegram bot sent. */
export default function ActivateScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [value, setValue] = useState(() => formatInput(params.code ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RedeemResult | null>(null);
  const home = useAccountStore(state => state.home);
  const refresh = useAccountStore(state => state.refresh);
  const input = useRef<ElementRef<typeof TextInput>>(null);
  useEffect(() => { if (params.code) setValue(formatInput(params.code)); }, [params.code]);

  const submit = async () => {
    if (!isComplete(value) || busy) return;
    setBusy(true); setError(null);
    try {
      await ensureSession();
      const redeemed = await api.redeem(value);
      setResult(redeemed);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось активировать код');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally { setBusy(false); }
  };

  const openBot = () => void Linking.openURL(telegramBotUrl());

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.kicker}>АКТИВАЦИЯ</Text>
          <Pressable accessibilityLabel="Закрыть" onPress={() => router.back()} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable>
        </View>

        {result ? <Animated.View entering={FadeIn.duration(300)} style={styles.success}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.check}><Text style={styles.checkText}>✓</Text></Animated.View>
          <Text style={styles.title}>{describe(result).title}</Text>
          <Text style={styles.subtitle}>{describe(result).text}</Text>
          <View style={{ height: 28 }} />
          <SaliButton title="Подключиться" onPress={() => router.replace('/')} />
        </Animated.View> : <>
          <Text style={styles.title}>Введите код</Text>
          <Text style={styles.subtitle}>Код из Telegram-бота Sali. Регистр и дефисы не важны — можно просто вставить.</Text>

          <Pressable onPress={() => input.current?.focus()} style={[styles.field, error && styles.fieldError, isComplete(value) && !error && styles.fieldReady]}>
            <TextInput
              ref={input}
              value={value}
              onChangeText={(text) => { setValue(formatInput(text)); setError(null); }}
              placeholder="SALI-XXXX-XXXX-XXXX"
              placeholderTextColor={theme.colors.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus={!params.code}
              maxLength={19}
              returnKeyType="done"
              onSubmitEditing={() => void submit()}
              style={styles.input}
            />
          </Pressable>
          {error ? <Animated.Text entering={FadeIn} style={[styles.error, { fontFamily: 'SaliSans-Medium' }]}>{error}</Animated.Text> : null}

          <View style={{ height: 18 }} />
          <SaliButton title="Активировать" loading={busy} disabled={!isComplete(value)} onPress={() => void submit()} />

          <View style={styles.help}>
            <Text style={styles.helpTitle}>Где взять код?</Text>
            <Text style={styles.helpText}>Бесплатные 24 часа и подписка выдаются в нашем Telegram-боте. Ваш ID устройства: <Text style={styles.id}>{home?.user.publicId ?? '—'}</Text></Text>
            <Pressable onPress={openBot} style={({ pressed }) => [styles.link, pressed && { opacity: .7 }]}><Text style={styles.linkText}>Открыть Telegram-бот</Text></Pressable>
          </View>
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { padding: 22, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 },
  kicker: { color: theme.colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: theme.colors.textPrimary, fontSize: 28, lineHeight: 30 },
  title: { color: theme.colors.textPrimary, fontSize: 30, lineHeight: 38, fontFamily: 'SaliSans-Bold', textAlign: 'center' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, marginBottom: 26 },
  field: { borderRadius: theme.radius.lg, borderWidth: 1.5, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: 14, minHeight: 68, justifyContent: 'center' },
  fieldReady: { borderColor: theme.colors.accent, backgroundColor: theme.colors.surfaceElevated },
  fieldError: { borderColor: theme.colors.error },
  input: { color: theme.colors.textPrimary, fontSize: 21, letterSpacing: 1.5, textAlign: 'center', fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }), fontWeight: '700' },
  error: { color: theme.colors.error, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 12 },
  help: { marginTop: 34, padding: 18, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  helpTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  helpText: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 6 },
  id: { color: theme.colors.accent, fontWeight: '700' },
  link: { marginTop: 12, alignSelf: 'flex-start' },
  linkText: { color: theme.colors.accent, fontSize: 15, fontWeight: '800' },
  success: { alignItems: 'stretch', paddingTop: 30 },
  check: { alignSelf: 'center', width: 96, height: 96, borderRadius: 48, backgroundColor: theme.colors.successGlow, borderWidth: 2, borderColor: theme.colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  checkText: { color: theme.colors.success, fontSize: 44, fontWeight: '800' },
});
