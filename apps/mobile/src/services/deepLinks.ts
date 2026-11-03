import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { secureStorage } from './secureStorage';
import { api } from './api/client';

export async function handleDeepLink(url: string) {
  const parsed = Linking.parse(url);
  if (parsed.hostname === 'auth' && typeof parsed.queryParams?.token === 'string') { const result = await api.exchangeTelegramToken(parsed.queryParams.token); await secureStorage.setToken(result.token); router.replace('/'); return; }
  if (parsed.hostname === 'server' && parsed.path) { router.push({ pathname: '/servers', params: { server: parsed.path } }); return; }
  // sali://activate?code=XXXXXXXXXXXX — the bot's "Открыть приложение" button pre-fills the code.
  if (parsed.hostname === 'activate' || parsed.hostname === 'subscription') {
    const code = typeof parsed.queryParams?.code === 'string' ? parsed.queryParams.code : undefined;
    router.push({ pathname: '/activate', params: code ? { code } : {} });
    return;
  }
  if (parsed.hostname === 'connect') router.replace('/');
}
