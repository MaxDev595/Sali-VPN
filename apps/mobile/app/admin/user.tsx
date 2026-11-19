import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '../../src/components/Text';
import { Icon } from '../../src/components/Icon';
import { SaliButton } from '../../src/components/SaliButton';
import { Card, Chip, ErrorNote, Field, Screen, copy, dateRu, money, toast, ui } from '../../src/components/ui';
import { api, ApiError, type AdminCard } from '../../src/services/api/client';
import { theme } from '../../src/theme';

const DAYS = [7, 30, 90, 365, 36_500];
const daysLabel = (d: number) => (d >= 36_500 ? 'Навсегда' : d === 365 ? '1 год' : `${d} дн.`);

/** Find anyone and act: grant / take back a subscription, block. */
export default function AdminUserScreen() {
  const params = useLocalSearchParams<{ query?: string }>();
  const [query, setQuery] = useState(params.query ?? '');
  const [card, setCard] = useState<AdminCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState<'admin' | 'gift'>('gift');
  const [message, setMessage] = useState('');
  const [adjust, setAdjust] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  const find = useCallback(async (q = query) => {
    if (!q.trim()) return;
    setBusy(true); setError(null);
    try { setCard(await api.admin.lookup(q.trim())); } catch (e) { setCard(null); setError(e instanceof ApiError ? e.message : 'Не удалось найти'); } finally { setBusy(false); }
  }, [query]);
  useEffect(() => { if (params.query) void find(params.query); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (what: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await what(); toast(done); await find(card?.id ?? query); } catch (e) { toast(e instanceof ApiError ? e.message : 'Не получилось'); } finally { setBusy(false); }
  };
  const grant = () => card && Alert.alert('Выдать подписку?', `${card.title}: ${daysLabel(days).toLowerCase()} (${kind === 'gift' ? 'подарок' : 'от администрации'})`, [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Выдать', onPress: () => void act(() => api.admin.grant(card.id, days, kind, message.trim() || undefined), 'Подписка выдана') },
  ]);
  const revoke = () => card && Alert.alert('Забрать подписку?', 'Все активные подписки аккаунта закончатся сейчас, VPN отключится.', [
    { text: 'Отмена', style: 'cancel' },
    { text: 'Забрать', style: 'destructive', onPress: () => void act(() => api.admin.revoke(card.id), 'Подписка снята') },
  ]);
  const block = () => card && Alert.alert(card.isBlocked ? 'Разблокировать?' : 'Заблокировать?', card.title, [
    { text: 'Отмена', style: 'cancel' },
    { text: card.isBlocked ? 'Разблокировать' : 'Заблокировать', style: card.isBlocked ? 'default' : 'destructive', onPress: () => void act(() => api.admin.block(card.id, !card.isBlocked), card.isBlocked ? 'Разблокирован' : 'Заблокирован') },
  ]);

  return <Screen title="Пользователь">
    <Field value={query} onChangeText={setQuery} placeholder="SL-XXXX-XXXX, D-XXXXXX, @username, ID" autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => void find()} returnKeyType="search" />
    <SaliButton title="Найти" secondary loading={busy && !card} onPress={() => void find()} />
    {error && <ErrorNote text={error} />}

    {card && <Animated.View entering={FadeInDown.duration(300)} style={{ marginTop: 16 }}>
      <Card accent>
        <View style={[ui.row, { marginBottom: 8 }]}>{card.isBlocked && <Icon name="ban" size={20} color={theme.colors.error} />}<Text style={[styles.title, { marginBottom: 0, flex: 1 }]}>{card.title}</Text></View>
        <Text style={styles.line} onPress={() => void copy(card.publicId, 'Sali ID скопирован')}>Sali ID: <Text style={styles.strong}>{card.publicId}</Text></Text>
        {card.username && <Text style={styles.line}>Telegram: @{card.username}</Text>}
        {card.telegramId && <Text style={styles.line}>Telegram ID: {card.telegramId}</Text>}
        {card.owner && <Text style={styles.line}>Аккаунт: {card.owner}</Text>}
        <Text style={styles.line}>С нами с {dateRu(card.createdAt)}</Text>
        <Text style={[styles.access, { color: /нет доступа/.test(card.access) ? theme.colors.textSecondary : theme.colors.success }]}>{card.access}</Text>
        <Text style={styles.line}>Баланс: <Text style={styles.strong}>${(card.balanceUsd ?? 0).toFixed(2)}</Text>{card.autoRenew ? ' · автопродление включено' : ''}</Text>
        <Text style={styles.line}>Оплатил: {money(card.paidUsd)} · {card.payments} раз · пригласил {card.invited}</Text>
        {card.devices.length > 0 && <View style={{ marginTop: 10 }}>
          <Text style={styles.sub}>Устройства</Text>
          {card.devices.map((d) => <Text key={d.id} style={styles.line}>{d.publicId} — {d.access}</Text>)}
        </View>}
      </Card>

      <Text style={styles.section}>Баланс</Text>
      <View style={ui.row}>
        <View style={{ flex: 1 }}><Field value={adjust} onChangeText={(v) => setAdjust(v.replace(/[^0-9.,-]/g, ''))} placeholder="+5 или -5" keyboardType="numbers-and-punctuation" /></View>
        <View style={{ flex: 2 }}><Field value={adjustNote} onChangeText={setAdjustNote} placeholder="Причина (видна в истории)" /></View>
      </View>
      <SaliButton title="Изменить баланс" secondary disabled={!Number(adjust.replace(',', '.'))} onPress={() => card && Alert.alert('Изменить баланс?', `${card.title}: ${Number(adjust.replace(',', '.')) > 0 ? '+' : ''}${adjust} $`, [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Изменить', onPress: () => void act(() => api.admin.adjustBalance(card.id, Number(adjust.replace(',', '.')), adjustNote.trim() || 'Администратор'), 'Баланс изменён').then(() => { setAdjust(''); setAdjustNote(''); }) },
      ])} />

      <Text style={styles.section}>Выдать подписку</Text>
      <View style={[ui.wrap, { marginBottom: 10 }]}>{DAYS.map((d) => <Chip key={d} label={daysLabel(d)} active={days === d} onPress={() => setDays(d)} />)}</View>
      <View style={[ui.wrap, { marginBottom: 10 }]}>
        <Chip label="Подарок" active={kind === 'gift'} onPress={() => setKind('gift')} />
        <Chip label="От администрации" active={kind === 'admin'} onPress={() => setKind('admin')} />
      </View>
      <Field value={message} onChangeText={setMessage} placeholder="Сообщение (необязательно)" multiline style={{ minHeight: 70, paddingTop: 14 }} />
      <SaliButton title="Выдать" loading={busy} onPress={grant} />
      <View style={{ height: 10 }} />
      <SaliButton title="Забрать подписку" secondary onPress={revoke} />
      <View style={{ height: 10 }} />
      <SaliButton title={card.isBlocked ? 'Разблокировать' : 'Заблокировать'} secondary onPress={block} />
    </Animated.View>}
  </Screen>;
}

const styles = StyleSheet.create({
  title: { color: theme.colors.cream, fontSize: 20, fontFamily: 'SaliSans-Bold', marginBottom: 8 },
  line: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
  strong: { color: theme.colors.textPrimary, fontFamily: 'SaliSans-SemiBold' },
  access: { fontSize: 15, fontFamily: 'SaliSans-SemiBold', marginVertical: 6 },
  sub: { color: theme.colors.textPrimary, fontSize: 14, fontFamily: 'SaliSans-SemiBold', marginBottom: 2 },
  section: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: 'SaliSans-SemiBold', marginTop: 22, marginBottom: 10 },
});
