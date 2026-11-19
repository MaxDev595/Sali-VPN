import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Text } from '../../src/components/Text';
import { Group, Row, SectionLabel } from '../../src/components/List';
import { CopyBox, ErrorNote, Loading, Screen, Stat, money, ui } from '../../src/components/ui';
import { api, type AdminStats } from '../../src/services/api/client';
import { theme } from '../../src/theme';

/** Admin panel: only for the owner's account (its Telegram is in ADMIN_TELEGRAM_IDS on the server). */
export default function AdminHome() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setStats(await api.admin.stats()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return <Screen title="Админ-панель" onRefresh={() => void load()} refreshing={loading}>
    <Group>
      <Row icon="search" title="Найти пользователя" hint="Sali ID, D-номер, @username или Telegram ID" onPress={() => router.push('/admin/user')} />
      <Row icon="users" title="Пользователи" hint="Платные, от администрации, бесплатные, ушедшие" onPress={() => router.push('/admin/people')} />
      <Row icon="cash" title="Платежи" onPress={() => router.push('/admin/payments')} />
      <Row icon="tag" title="Промокоды" hint="Дни или скидка, лимит и срок" onPress={() => router.push('/admin/promos')} last />
    </Group>

    {!stats && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {stats && <>
      <SectionLabel icon="key">ДЕНЬГИ</SectionLabel>
      <View style={ui.grid}>
        <Stat label="Сегодня" value={money(stats.revenue.day)} hint={`${stats.revenue.dayCount} опл.`} />
        <Stat label="7 дней" value={money(stats.revenue.week)} hint={`${stats.revenue.weekCount} опл.`} />
        <Stat label="30 дней" value={money(stats.revenue.month)} hint={`${stats.revenue.monthCount} опл. · чек ${money(stats.revenue.avgCheck30d)}`} />
        <Stat label="Всего" value={money(stats.revenue.total)} hint={`${stats.revenue.payers} платили`} />
      </View>

      {stats.balances && <>
        <SectionLabel icon="cash">БАЛАНСЫ SALI</SectionLabel>
        <View style={ui.grid}>
          <Stat label="На балансах" value={`$${stats.balances.held.toFixed(2)}`} hint="деньги клиентов" />
          <Stat label="Пополнено всего" value={`$${stats.balances.toppedUp.toFixed(2)}`} />
          <Stat label="Списано за тарифы" value={`$${stats.balances.spent.toFixed(2)}`} hint="к переводу на основной счёт" />
        </View>
        <View style={{ height: 10 }} />
        <CopyBox label="Кошелёк для пополнений" value={stats.balances.wallet} />
      </>}
      <SectionLabel icon="shield">ДОСТУП СЕЙЧАС</SectionLabel>
      <View style={ui.grid}>
        <Stat label="Платная подписка" value={stats.access.paid} hint={stats.access.expiringPaid3d ? `${stats.access.expiringPaid3d} кончаются за 3 дня` : undefined} />
        <Stat label="От администрации" value={stats.access.granted} />
        <Stat label="Бесплатные 3 дня" value={stats.access.trial} />
        <Stat label="Онлайн" value={stats.access.onlineNow ?? '—'} />
      </View>

      <SectionLabel icon="user">ЛЮДИ</SectionLabel>
      <View style={ui.grid}>
        <Stat label="Новых за сутки" value={stats.new24h} />
        <Stat label="За 7 дней" value={stats.new7d} />
        <Stat label="Устройств активно (7 дн.)" value={stats.activeDevices7d} />
        <Stat label="Пришли по приглашению" value={stats.referrals.total} />
      </View>

      <SectionLabel icon="globe">СЕРВЕРЫ</SectionLabel>
      <Group>
        {stats.servers.map((s, i) => <Row key={s.name} kind="none" icon="dot" iconColor={s.online ? theme.colors.success : theme.colors.error} title={s.name} hint={`${s.premiumOnly ? 'платный' : 'бесплатный'}${s.isActive ? '' : ' · выключен'} · ${s.users} ключей`} value={s.connectedNow !== null ? `${s.connectedNow} онлайн` : undefined} last={i === stats.servers.length - 1} />)}
      </Group>
      <Text style={styles.note}>Серверы, рассылки и воронка — по-прежнему в боте: /admin</Text>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  note: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 12, textAlign: 'center' },
});
