import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAccountStore } from '../store/accountStore';
import { theme } from '../theme';
import type { VPNStatus } from '../types';

function formatRemaining(seconds: number) { const safe = Math.max(0, Math.ceil(seconds)); return [Math.floor(safe / 3600), Math.floor(safe / 60) % 60, safe % 60].map(value => String(value).padStart(2, '0')).join(':'); }

/** Current tariff under the connect button: subscription date, free-time countdown or "Ввести код". */
export function AccessPill({ status }: { status: VPNStatus }) {
  const { home, access, refresh } = useAccountStore();
  const [now, setNow] = useState(Date.now());
  const syncedAt = useRef(Date.now());
  useEffect(() => { syncedAt.current = Date.now(); }, [home]);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { const sync = setInterval(() => { if (status === 'connected') void refresh(); }, 30_000); return () => clearInterval(sync); }, [refresh, status]);

  if (access === 'premium' && home?.subscription) {
    const until = home.subscription.expiresAt ? new Date(home.subscription.expiresAt).toLocaleDateString('ru-RU') : '∞';
    return <View style={styles.root}><View style={[styles.dot, styles.dotOk]} /><Text style={styles.text}>Подписка до <Text style={styles.strong}>{until}</Text></Text></View>;
  }
  if (access === 'trial' && home?.trial) {
    const elapsed = home.trial.isRunning ? (now - syncedAt.current) / 1000 : 0;
    return <View style={styles.root}><View style={[styles.dot, styles.dotTrial]} /><Text style={styles.text}>Бесплатное время <Text style={[styles.strong, styles.mono]}>{formatRemaining(home.trial.secondsRemaining - elapsed)}</Text></Text></View>;
  }
  return <Pressable accessibilityRole="button" onPress={() => router.push('/activate')} style={({ pressed }) => [styles.root, styles.cta, pressed && { opacity: .8 }]}>
    <Text style={styles.ctaText}>{access === 'expired' ? 'Тариф закончился · ' : 'Нет тарифа · '}<Text style={styles.ctaStrong}>Ввести код</Text></Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 16, minHeight: 40, borderRadius: theme.radius.pill, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOk: { backgroundColor: theme.colors.success },
  dotTrial: { backgroundColor: theme.colors.accent },
  text: { color: theme.colors.textSecondary, fontSize: 14 },
  strong: { color: theme.colors.textPrimary, fontWeight: '700' },
  mono: { fontVariant: ['tabular-nums'] },
  cta: { backgroundColor: theme.colors.glow, borderColor: 'rgba(255,197,138,.35)' },
  ctaText: { color: theme.colors.textSecondary, fontSize: 14 },
  ctaStrong: { color: theme.colors.accent, fontWeight: '800' },
});
