import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { secureStorage } from './secureStorage';
import { api } from './api/client';
export async function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);
  if (parsed.hostname === 'auth' && typeof parsed.queryParams?.token === 'string') { const result = await api.exchangeTelegramToken(parsed.queryParams.token); await secureStorage.setToken(result.token); router.replace('/'); return; }
  if (parsed.hostname === 'server' && parsed.path) { router.push({ pathname: '/servers', params: { server: parsed.path } }); return; }
  if (parsed.hostname === 'subscription') { router.push('/subscription'); return; }
  if (parsed.hostname === 'connect') router.replace('/');
}
