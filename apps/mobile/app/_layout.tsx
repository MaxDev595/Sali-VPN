import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { router } from 'expo-router';
import { theme } from '../src/theme';
import { fontAssets } from '../src/theme/fonts';
import { handleDeepLink } from '../src/services/deepLinks';
import { usePreferencesStore } from '../src/store/preferencesStore';
import { useAccountStore } from '../src/store/accountStore';
import { LogoIntro } from '../src/components/LogoIntro';

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function AppBootstrap() {
  const hydrate = usePreferencesStore(state => state.hydrate);
  const refreshAccount = useAccountStore(state => state.refresh);
  useEffect(() => {
    void hydrate();
    // Silent sign-in: the installation gets its Sali ID on the very first launch.
    void refreshAccount();
    void AsyncStorage.getItem('sali.onboarding.v4.complete').then(done => { if (!done) router.replace('/onboarding'); });
    void Linking.getInitialURL().then(url => { if (url) return handleDeepLink(url); });
    const subscription = Linking.addEventListener('url', ({ url }) => { void handleDeepLink(url); });
    return () => subscription.remove();
  }, [hydrate, refreshAccount]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  const ready = fontsLoaded || Boolean(fontError);
  const [introDone, setIntroDone] = useState(false);
  const finishIntro = useCallback(() => setIntroDone(true), []);
  // The native splash is plain white like the logo artwork, so the drawing starts on the same canvas.
  useEffect(() => { if (ready) void SplashScreen.hideAsync().catch(() => undefined); }, [ready]);

  return <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <QueryClientProvider client={queryClient}>
      <AppBootstrap />
      <StatusBar style={introDone ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'fade_from_bottom', animationDuration: 320 }}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="servers" options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: true }} />
        <Stack.Screen name="activate" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        <Stack.Screen name="support" options={{ animation: 'slide_from_right' }} />
      </Stack>
      {ready && !introDone && <LogoIntro onFinish={finishIntro} />}
    </QueryClientProvider>
  </GestureHandlerRootView>;
}
