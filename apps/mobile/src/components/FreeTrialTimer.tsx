import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../services/api/client';
import { secureStorage } from '../services/secureStorage';
import { theme } from '../theme';
import type { VPNStatus } from '../types';

const FREE_SECONDS = 3600;
function formatRemaining(seconds: number) { const safe = Math.max(0, Math.ceil(seconds)); return [Math.floor(safe / 3600), Math.floor(safe / 60) % 60, safe % 60].map(value => String(value).padStart(2, '0')).join(':'); }

export function FreeTrialTimer({ status }: { status: VPNStatus }) {
  const [remaining, setRemaining] = useState(FREE_SECONDS);
  const [running, setRunning] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const syncedAt = useRef(Date.now());
  const syncedRemaining = useRef(FREE_SECONDS);
  const sync = useCallback(async () => {
    if (!(await secureStorage.getToken())) return;
    try {
      const home = await api.home();
      if (home.subscription) { setHasSubscription(true); return; }
      const seconds = home.trial?.secondsRemaining ?? FREE_SECONDS;
      syncedRemaining.current = seconds; syncedAt.current = Date.now(); setRemaining(seconds); setRunning(Boolean(home.trial?.isRunning));
    } catch { /* Preserve the last server-confirmed value when the local API is unavailable. */ }
  }, []);
  useEffect(() => { void sync(); }, [status, sync]);
  useEffect(() => { const refresh = setInterval(() => { if (status === 'connected') void sync(); }, 30_000); return () => clearInterval(refresh); }, [status, sync]);
  useEffect(() => { const tick = setInterval(() => { if (!running) return; const elapsed = Math.floor((Date.now() - syncedAt.current) / 1000); setRemaining(Math.max(0, syncedRemaining.current - elapsed)); }, 1000); return () => clearInterval(tick); }, [running]);
  if (hasSubscription) return null;
  return <View accessibilityLabel={`Осталось бесплатного времени ${formatRemaining(remaining)}`} style={styles.root}><Text style={styles.label}>БЕСПЛАТНОЕ ВРЕМЯ</Text><Text style={styles.value}>{formatRemaining(remaining)}</Text></View>;
}
const styles = StyleSheet.create({ root: { alignSelf: 'center', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface }, label: { color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 }, value: { color: theme.colors.accent, fontSize: 20, lineHeight: 25, fontWeight: '800', fontVariant: ['tabular-nums'], marginTop: 2 } });
