import { AppState, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../../src/components/BrandMark';
import { SaliButton } from '../../src/components/SaliButton';
import { useI18n } from '../../src/i18n';
import { theme } from '../../src/theme';
import { api } from '../../src/services/api/client';
import { secureStorage } from '../../src/services/secureStorage';
import { purchaseGooglePlay } from '../../src/services/billing/GooglePlayBilling';

export default function SubscriptionScreen() {
  const { language, t } = useI18n();
  const [plan, setPlan] = useState<{ id: string; name: string; priceUsd: number; originalPriceUsd: number | null } | null>(null);
  const [status, setStatus] = useState<{ id: string; status: string; expiresAt: string | null; autoRenew: boolean } | null>(null);
  const [busy, setBusy] = useState<'paddle' | 'crypto' | 'cancel' | null>(null);
  const [pendingPaddlePaymentId, setPendingPaddlePaymentId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<{ paymentId: string; address: string; amount: string; expiresAt: string; reference?: string; paymentUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const features = language === 'ru' ? ['3 Premium-сервера', t.tenSoon, 'Максимальная скорость', t.maxDevices, 'Приоритетная поддержка'] : ['3 Premium servers', t.tenSoon, 'Maximum speed', t.maxDevices, 'Priority support'];
  const load = useCallback(async () => {
    try {
      if (!(await secureStorage.getToken())) { const auth = await api.localLogin(); await secureStorage.setToken(auth.token); }
      const [plans, subscription] = await Promise.all([api.plans(), api.subscription()]);
      setPlan(plans[0] ?? null); setStatus(subscription); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось загрузить подписку'); }
  }, []);
  useEffect(() => { void load(); const listener = AppState.addEventListener('change', next => { if (next === 'active') void load(); }); return () => listener.remove(); }, [load]);
  useEffect(() => {
    if (!pendingPaddlePaymentId) return;
    const timer = setInterval(() => { void api.payment(pendingPaddlePaymentId).then(payment => { if (payment.status === 'SUCCEEDED') { setPendingPaddlePaymentId(null); void load(); } else if (payment.status === 'FAILED') { setPendingPaddlePaymentId(null); setError('Тестовый платёж Paddle не прошёл'); } }).catch(() => {}); }, 4000);
    return () => clearInterval(timer);
  }, [pendingPaddlePaymentId, load]);
  useEffect(() => {
    if (!invoice) return;
    const timer = setInterval(() => {
      void api.payment(invoice.paymentId).then(payment => {
        if (payment.status === 'SUCCEEDED') {
          setInvoice(null);
          void load();
        } else if (payment.status === 'FAILED') {
          setInvoice(null);
          setError('Срок счёта истёк. Создайте новый счёт.');
        }
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(timer);
  }, [invoice, load]);
  const buy = async (provider: 'paddle' | 'crypto') => {
    if (provider === 'paddle') { await buyGooglePlay(); return; }
    if (!plan || busy) return;
    setBusy(provider); setError(null);
    try {
      const result = await api.purchase(plan.id, provider);
      if (provider === 'crypto' && result.checkout.cryptoInvoice) {
        setInvoice({ paymentId: result.payment.id, ...result.checkout.cryptoInvoice });
      } else if (result.checkout.checkoutUrl) { setPendingPaddlePaymentId(result.payment.id); await Linking.openURL(result.checkout.checkoutUrl); }
      else throw new Error('Провайдер не вернул реквизиты оплаты');
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось создать платёж'); }
    finally { setBusy(null); }
  };
  const cancel = async () => { if (!status || busy) return; setBusy('cancel'); try { await api.cancelSubscription(status.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось отменить продление'); } finally { setBusy(null); } };
  const buyGooglePlay = async () => {
    if (!plan || busy) return;
    setBusy('paddle'); setError(null);
    try {
      const purchase = await purchaseGooglePlay();
      await api.verifyGooglePlay(plan.id, purchase.productId, purchase.purchaseToken);
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Не удалось выполнить оплату Google Play'); }
    finally { setBusy(null); }
  };
  const active = status?.status === 'ACTIVE';
  const price = plan?.priceUsd ?? 5;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.screen}><View style={styles.brand}><BrandMark size={52} /><Text style={styles.kicker}>SALI PREMIUM</Text><Text style={styles.title}>{language === 'ru' ? 'Интернет без границ' : 'Internet without borders'}</Text><Text style={styles.subtitle}>{active ? `Подписка активна${status?.expiresAt ? ` до ${new Date(status.expiresAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}` : ''}` : t.premiumSubtitle}</Text></View><View style={styles.card}>{invoice && !active ? <View><Text style={styles.invoiceTitle}>USDT · сеть TON</Text><Text style={styles.invoiceLabel}>Отправьте точную сумму</Text><Text style={styles.invoiceAmount}>{invoice.amount} USDT</Text><Text style={styles.invoiceLabel}>Комментарий (обязательно)</Text><Text selectable style={styles.invoiceAddress}>{invoice.reference}</Text><Text style={styles.invoiceLabel}>Адрес TON Space</Text><Text selectable style={styles.invoiceAddress}>{invoice.address}</Text><Text style={styles.legal}>Выберите именно USDT в сети TON. Счёт действует до {new Date(invoice.expiresAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}.</Text><View style={{ height: 16 }} />{invoice.paymentUrl ? <><SaliButton title="Открыть кошелёк и оплатить" onPress={() => void Linking.openURL(invoice.paymentUrl!)} /><View style={{ height: 12 }} /></> : null}<SaliButton title="Проверить оплату" onPress={() => void load()} secondary /></View> : <>{plan?.originalPriceUsd ? <><View style={styles.discount}><Text style={styles.discountText}>SALE</Text></View><Text style={styles.old}>${plan.originalPriceUsd}</Text></> : null}<View style={styles.priceLine}><Text style={styles.price}>${price}</Text><Text style={styles.month}>{t.perMonth}</Text></View><View style={styles.divider} />{features.map(item => <View key={item} style={styles.feature}><Text style={styles.tick}>✓</Text><Text style={styles.featureText}>{item}</Text></View>)}<View style={{ height: 22 }} />{active ? <SaliButton title={busy === 'cancel' ? 'Отмена…' : status?.autoRenew ? 'Отключить автопродление' : 'Подписка активна'} onPress={() => void cancel()} disabled={busy !== null || !status?.autoRenew} /> : <><SaliButton title={busy === 'paddle' ? 'Открываем оплату…' : 'Оплатить картой'} onPress={() => void buy('paddle')} disabled={busy !== null || !plan} /><View style={{ height: 12 }} /><SaliButton title={busy === 'crypto' ? 'Создаём счёт…' : 'Оплатить USDT (TON)'} onPress={() => void buy('crypto')} disabled={busy !== null || !plan} /></>}</>}{error ? <Text style={styles.error}>{error}</Text> : null}<Text style={styles.legal}>{language === 'ru' ? 'Sali проверяет перевод USDT в сети TON и включает доступ автоматически.' : 'Sali verifies the USDT transfer on TON and activates access automatically.'}</Text></View></ScrollView></SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: theme.colors.background }, screen: { padding: 20, paddingBottom: 44 }, brand: { alignItems: 'center', paddingTop: 18, paddingBottom: 26 }, kicker: { color: theme.colors.accent, fontSize: 12, fontWeight: '800', letterSpacing: 1.8, marginTop: 15 }, title: { color: theme.colors.textPrimary, fontSize: 32, fontWeight: '800', textAlign: 'center', marginTop: 8 }, subtitle: { color: theme.colors.textSecondary, fontSize: 17, lineHeight: 24, textAlign: 'center', marginTop: 10 }, card: { borderRadius: 24, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, padding: 20, overflow: 'hidden' }, discount: { position: 'absolute', right: 18, top: 18, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#392617', borderRadius: 20 }, discountText: { color: theme.colors.accent, fontSize: 13, fontWeight: '800' }, old: { color: theme.colors.textSecondary, textDecorationLine: 'line-through', fontSize: 17 }, priceLine: { flexDirection: 'row', alignItems: 'baseline' }, price: { color: theme.colors.textPrimary, fontSize: 48, fontWeight: '800' }, month: { color: theme.colors.textSecondary, fontSize: 17 }, divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 20 }, feature: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 }, tick: { color: theme.colors.success, fontSize: 18 }, featureText: { color: theme.colors.textPrimary, fontSize: 17 }, invoiceTitle: { color: theme.colors.accent, fontSize: 15, fontWeight: '800', textAlign: 'center' }, invoiceLabel: { color: theme.colors.textSecondary, fontSize: 14, textAlign: 'center', marginTop: 18 }, invoiceAmount: { color: theme.colors.textPrimary, fontSize: 30, fontWeight: '800', textAlign: 'center', marginTop: 6 }, invoiceAddress: { color: theme.colors.textPrimary, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 7 }, error: { color: '#FF7474', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 14 }, legal: { color: theme.colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 14 } });
