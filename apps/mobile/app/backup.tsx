import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../src/components/Text';
import { Icon, type IconName } from '../src/components/Icon';
import { SaliButton } from '../src/components/SaliButton';
import { TelegramLinkCard } from '../src/components/TelegramLinkCard';
import { Card, ErrorNote, Loading, Screen, copy, dateRu, toast } from '../src/components/ui';
import { api, ApiError, type Backup } from '../src/services/api/client';
import { theme } from '../src/theme';

const STORE = {
  happ: 'https://play.google.com/store/apps/details?id=com.happproxy',
  v2raytun: 'https://play.google.com/store/apps/details?id=com.v2raytun.android',
  hiddify: 'https://play.google.com/store/apps/details?id=app.hiddify.com',
};

/** Opens the client with the link; not installed → its Play Store page. */
async function openIn(deepLink: string, store: string) {
  try { await Linking.openURL(deepLink); } catch { await Linking.openURL(store).catch(() => toast('Не удалось открыть Google Play')); }
}

function Option({ icon, title, text, step, children, delay }: { icon: IconName; title: string; text: string; step: string; children: React.ReactNode; delay: number }) {
  return <Animated.View entering={FadeInDown.delay(delay).duration(340)}>
    <Card style={{ marginBottom: 12 }}>
      <View style={styles.head}>
        <View style={styles.tile}><Icon name={icon} size={22} color={theme.colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.step}>{step}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <Text style={styles.text}>{text}</Text>
      <View style={{ gap: 10, marginTop: 14 }}>{children}</View>
    </Card>
  </Animated.View>;
}

/**
 * «Запасное подключение»: when the Sali app's own tunnel is blocked on a network, the same
 * account connects through VLESS (Reality) — in Happ, or in v2RayTun / Hiddify as a second reserve.
 */
export default function BackupScreen() {
  const [data, setData] = useState<Backup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.backup()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const reset = () => Alert.alert('Сбросить ссылку?', 'Старая ссылка сразу перестанет работать — в Happ и других приложениях её нужно будет добавить заново. Нужно, только если ссылка попала к чужим людям.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Сбросить', style: 'destructive', onPress: async () => {
      try { setData(await api.resetBackup()); toast('Новая ссылка готова — добавьте её заново'); } catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); }
    } },
  ]);

  return <Screen title="Запасное подключение" subtitle="Если в какой-то сети Sali VPN не подключается — включите запасной вариант. Подписка та же, платить отдельно не нужно." onRefresh={() => void load()} refreshing={loading}>
    {!data && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}

    {data && !data.enabled && <Card>
      <Text style={styles.title}>Скоро будет доступно</Text>
      <Text style={styles.text}>Запасные серверы ещё настраиваются. Если сейчас не подключается — напишите в поддержку, поможем.</Text>
    </Card>}

    {data?.enabled && !data.linked && <>
      <Text style={[styles.text, { marginBottom: 12 }]}>Запасная ссылка привязана к аккаунту, поэтому сначала привяжите Telegram — это одно нажатие.</Text>
      <TelegramLinkCard />
    </>}

    {data?.enabled && data.linked && !data.access && <ErrorNote text={data.message} />}

    {data?.enabled && data.linked && data.access && <>
      <Option delay={0} step="ВАРИАНТ 1" icon="lifebuoy" title="Happ" text="Самый простой запасной вариант. Установите Happ и нажмите «Добавить в Happ» — серверы Sali появятся в нём сами.">
        <SaliButton title="Добавить в Happ" onPress={() => void openIn(data.open.happ, STORE.happ)} />
        <SaliButton secondary title="Установить Happ" onPress={() => void Linking.openURL(STORE.happ)} />
      </Option>

      <Option delay={70} step="ВАРИАНТ 2" icon="apps" title="v2RayTun или Hiddify" text="Если Happ недоступен — те же серверы работают в этих приложениях. Нажмите кнопку, приложение откроется и добавит подписку.">
        <SaliButton title="Добавить в v2RayTun" onPress={() => void openIn(data.open.v2raytun, STORE.v2raytun)} />
        <SaliButton secondary title="Добавить в Hiddify" onPress={() => void openIn(data.open.hiddify, STORE.hiddify)} />
      </Option>

      <Option delay={140} step="ДЛЯ ЛЮБОГО ПРИЛОЖЕНИЯ" icon="link" title="Ссылка-подписка" text="Подходит для любого клиента VLESS: v2rayNG, Streisand, NekoBox и других. Вставьте её как «подписку по ссылке».">
        <Pressable onPress={() => void copy(data.url, 'Ссылка скопирована')} style={({ pressed }) => [styles.linkBox, pressed && { opacity: .8 }]}>
          <Text style={styles.link} numberOfLines={2}>{data.url}</Text>
          <Icon name="copy" size={18} color={theme.colors.accent} />
        </Pressable>
      </Option>

      <Text style={styles.meta}>{data.servers} {data.servers === 1 ? 'сервер' : data.servers < 5 ? 'сервера' : 'серверов'}{data.expiresAt ? ` · работает до ${dateRu(data.expiresAt)}` : ''}</Text>
      <Text style={styles.warn}>Ссылка личная — не пересылайте её. Попала к чужим?{' '}<Text style={styles.reset} onPress={reset}>Сбросить ссылку</Text></Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  tile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glow },
  step: { color: theme.colors.accent, fontSize: 11, letterSpacing: 1.4, fontFamily: 'SaliSans-Bold' },
  title: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold', marginTop: 2 },
  text: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 20 },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surfaceElevated },
  link: { flex: 1, color: theme.colors.textPrimary, fontSize: 12.5 },
  meta: { color: theme.colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 6 },
  warn: { color: theme.colors.textSecondary, fontSize: 12.5, textAlign: 'center', marginTop: 10, lineHeight: 18 },
  reset: { color: theme.colors.error, fontFamily: 'SaliSans-SemiBold' },
});
