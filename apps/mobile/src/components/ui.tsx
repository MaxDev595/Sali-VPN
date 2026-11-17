import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, ToastAndroid, Platform, Alert, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Text, TextInput } from './Text';
import { Icon } from './Icon';
import { theme } from '../theme';

/** A pushed screen: back arrow, big title, scrolling body (pull to refresh when given). */
export function Screen({ title, subtitle, children, onRefresh, refreshing = false, back = true }: { title: string; subtitle?: string; children: ReactNode; onRefresh?(): void; refreshing?: boolean; back?: boolean }) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <ScrollView
      contentContainerStyle={styles.screen}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.accent} colors={[theme.colors.accent]} progressBackgroundColor={theme.colors.surface} /> : undefined}
    >
      {back && <Pressable accessibilityRole="button" accessibilityLabel="Назад" hitSlop={12} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={({ pressed }) => [styles.back, pressed && { opacity: .6 }]}>
        <Icon name="chevron" size={20} color={theme.colors.textPrimary} style={{ transform: [{ rotate: '180deg' }] }} />
      </Pressable>}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : <View style={{ height: 14 }} />}
      {children}
    </ScrollView>
  </SafeAreaView>;
}

export function Card({ children, accent = false, style }: { children: ReactNode; accent?: boolean; style?: object }) {
  return <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>;
}

export function Loading({ text }: { text?: string }) {
  return <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} />{text ? <Text style={styles.muted}>{text}</Text> : null}</View>;
}

export function ErrorNote({ text, onRetry }: { text: string; onRetry?(): void }) {
  return <View style={styles.error}>
    <Icon name="info" size={18} color={theme.colors.error} />
    <Text style={styles.errorText}>{text}</Text>
    {onRetry && <Pressable onPress={onRetry} style={({ pressed }) => [styles.smallButton, pressed && { opacity: .8 }]}><Text style={styles.smallButtonText}>Ещё раз</Text></Pressable>}
  </View>;
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return <View style={{ marginBottom: 12 }}>
    {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
    <TextInput placeholderTextColor={theme.colors.muted} selectionColor={theme.colors.accent} {...rest} style={[styles.field, style]} />
  </View>;
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => { void Haptics.selectionAsync(); onPress(); }} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: .85 }]}>
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </Pressable>;
}

export function toast(text: string) {
  if (Platform.OS === 'android') ToastAndroid.show(text, ToastAndroid.SHORT);
  else Alert.alert(text);
}

export async function copy(value: string, what = 'Скопировано') {
  await Clipboard.setStringAsync(value).catch(() => undefined);
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  toast(what);
}

/** A value to copy (wallet address, comment, Sali ID): tap anywhere on it. */
export function CopyBox({ label, value, mono = false, note }: { label: string; value: string; mono?: boolean; note?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: скопировать`} onPress={() => void copy(value, `${label} скопирован`)} style={({ pressed }) => [styles.copyBox, pressed && { backgroundColor: theme.colors.surfaceElevated }]}>
    <View style={{ flex: 1 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.copyValue, mono && styles.mono]} selectable>{value}</Text>
      {note ? <Text style={styles.copyNote}>{note}</Text> : null}
    </View>
    <View style={styles.copyBadge}><Text style={styles.copyBadgeText}>Копировать</Text></View>
  </Pressable>;
}

export function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return <View style={styles.stat}>
    <Text style={styles.statValue} numberOfLines={1}>{value}</Text>
    <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    {hint ? <Text style={styles.statHint} numberOfLines={1}>{hint}</Text> : null}
  </View>;
}

export const money = (usd: number) => `$${usd.toFixed(usd % 1 ? 2 : 0)}`;
export const period = (days: number) => (days >= 36_000 ? 'бессрочно' : days >= 360 ? `${Math.round(days / 365)} год` : days >= 28 ? `${Math.round(days / 30)} мес.` : `${days} дн.`);
export const dateRu = (iso: string | null | undefined, withYear = true) => (iso ? new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }) : '—');

export const ui = StyleSheet.create({
  muted: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  h2: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  screen: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 48 },
  back: { width: 40, height: 40, borderRadius: 20, marginLeft: -6, marginBottom: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  title: { color: theme.colors.textPrimary, fontSize: 32, lineHeight: 38, fontFamily: 'SaliSans-Bold' },
  subtitle: { color: theme.colors.textSecondary, fontSize: 15, lineHeight: 21, marginTop: 6, marginBottom: 18 },
  card: { borderRadius: theme.radius.lg, padding: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  cardAccent: { borderColor: 'rgba(255,197,135,.35)', backgroundColor: '#0D1628' },
  loading: { paddingVertical: 40, alignItems: 'center', gap: 12 },
  muted: { color: theme.colors.textSecondary, fontSize: 14 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: 'rgba(255,122,122,0.08)', borderWidth: 1, borderColor: 'rgba(255,122,122,0.22)', marginVertical: 8 },
  errorText: { flex: 1, color: '#FFB4B4', fontSize: 14, lineHeight: 20 },
  smallButton: { paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: theme.colors.surfaceElevated, justifyContent: 'center' },
  smallButtonText: { color: theme.colors.textPrimary, fontSize: 13, fontFamily: 'SaliSans-SemiBold' },
  fieldLabel: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.4, fontFamily: 'SaliSans-Bold', marginBottom: 6, textTransform: 'uppercase' },
  field: { minHeight: 52, borderRadius: 14, paddingHorizontal: 16, fontSize: 17, color: theme.colors.textPrimary, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textPrimary, fontSize: 14, fontFamily: 'SaliSans-SemiBold' },
  chipTextActive: { color: theme.colors.onPrimary },
  copyBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  copyValue: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold' },
  mono: { fontSize: 13.5, letterSpacing: .2, lineHeight: 19 },
  copyNote: { color: theme.colors.warning, fontSize: 12.5, marginTop: 6, lineHeight: 17 },
  copyBadge: { paddingHorizontal: 10, height: 30, borderRadius: 15, backgroundColor: theme.colors.glow, justifyContent: 'center' },
  copyBadgeText: { color: theme.colors.accent, fontSize: 12, fontFamily: 'SaliSans-Bold' },
  stat: { flexGrow: 1, flexBasis: '46%', padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  statValue: { color: theme.colors.textPrimary, fontSize: 24, fontFamily: 'SaliSans-Bold', fontVariant: ['tabular-nums'] },
  statLabel: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 2 },
  statHint: { color: theme.colors.accent, fontSize: 12, marginTop: 4 },
});
