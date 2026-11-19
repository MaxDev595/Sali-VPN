import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, View } from 'react-native';
import { Icon } from '../src/components/Icon';
import { Text } from '../src/components/Text';
import { SaliButton } from '../src/components/SaliButton';
import { Card, CopyBox, ErrorNote, Loading, Screen, Stat, bonusLabel, ui } from '../src/components/ui';
import { api, type Referrals } from '../src/services/api/client';
import { theme } from '../src/theme';

/** «Пригласить друга»: the friend types your Sali ID into «Промокод». */
export default function InviteScreen() {
  const [data, setData] = useState<Referrals | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await api.referrals()); } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось загрузить'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  return <Screen title="Пригласить друга" subtitle={data ? `Друг получит +${bonusLabel(data.friendBonusHours)} бесплатно, а вы — скидку ${data.discountPercent}% на следующую оплату за каждого друга.` : undefined} onRefresh={() => void load()} refreshing={loading}>
    {!data && !error && <Loading />}
    {error && <ErrorNote text={error} onRetry={() => void load()} />}
    {data && <>
      <CopyBox label="Ваш код приглашения" value={data.code} note="Друг вводит его в приложении: «Подписка» → «Промокод»" />
      <SaliButton title="Отправить другу" onPress={() => void Share.share({ message: data.shareText })} />

      <Text style={styles.previewLabel}>ДРУГ ПОЛУЧИТ ТАКОЕ СООБЩЕНИЕ</Text>
      <View style={styles.bubble}>
        <Text style={styles.bubbleText} selectable>{data.shareText}</Text>
      </View>

      {data.channel && <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(data.channel!)} style={({ pressed }) => [styles.channel, pressed && { opacity: .85 }]}>
        <View style={styles.channelIcon}><Icon name="megaphone" size={20} color={theme.colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.channelTitle}>Наш канал {data.channelTag}</Text>
          <Text style={styles.channelHint}>Новости, акции и промокоды — подпишитесь сами и позовите друзей</Text>
        </View>
        <Icon name="external" size={16} color={theme.colors.accent} />
      </Pressable>}
      <View style={{ height: 18 }} />
      <View style={ui.grid}>
        <Stat label="Друзей пришло" value={data.invited} />
        <Stat label="Скидок ждут оплаты" value={data.availableDiscounts} hint={data.availableDiscounts ? `−${data.discountPercent}% к следующей оплате` : undefined} />
      </View>
      <Card style={{ marginTop: 14 }}>
        <Text style={styles.howTitle}>Как это работает</Text>
        <Text style={styles.how}>1. Друг скачивает Sali VPN и нажимает «Включить» — 3 дня бесплатно.{'\n'}2. Вводит ваш код в «Промокод» — получает ещё +{bonusLabel(data.friendBonusHours)}.{'\n'}3. Вам начисляется скидка {data.discountPercent}% на следующую оплату.</Text>
      </Card>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({
  previewLabel: { color: theme.colors.textSecondary, fontSize: 11, letterSpacing: 1.4, fontFamily: 'SaliSans-Bold', marginTop: 20, marginBottom: 8, marginLeft: 4 },
  bubble: { alignSelf: 'flex-start', maxWidth: '92%', padding: 14, borderRadius: 18, borderBottomLeftRadius: 6, backgroundColor: '#17233D', borderWidth: 1, borderColor: '#22355C' },
  bubbleText: { color: theme.colors.textPrimary, fontSize: 14, lineHeight: 20 },
  channel: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  channelIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.glow },
  channelTitle: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: 'SaliSans-SemiBold' },
  channelHint: { color: theme.colors.textSecondary, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  howTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold', marginBottom: 8 },
  how: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
