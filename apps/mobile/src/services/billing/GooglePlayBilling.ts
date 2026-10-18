import { NativeModules, Platform } from 'react-native';
type Purchase = { purchaseToken: string; productId: string; orderId?: string; packageName: string };
const native = NativeModules.SaliBilling as { purchaseSubscription(productId: string): Promise<Purchase> } | undefined;
export async function purchaseGooglePlay() {
  if (Platform.OS !== 'android' || !native) throw new Error('Google Play Billing недоступен');
  return native.purchaseSubscription(process.env.EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_ID ?? 'sali_pro_monthly');
}
