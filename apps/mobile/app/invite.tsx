import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
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
  howTitle: { color: theme.colors.textPrimary, fontSize: 16, fontFamily: 'SaliSans-SemiBold', marginBottom: 8 },
  how: { color: theme.colors.textSecondary, fontSize: 14, lineHeight: 22 },
});
