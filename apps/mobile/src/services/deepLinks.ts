import * as Linking from 'expo-linking';
import { router } from 'expo-router';

export async function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);
  if (parsed.hostname === 'server' && parsed.path) { router.push('/servers'); return; }
  // Old bot links (sali://activate?code=…) and sali://subscription open the subscription tab.
  if (parsed.hostname === 'activate' || parsed.hostname === 'subscription') { router.push('/subscription'); return; }
  if (parsed.hostname === 'connect') router.replace('/');
}
