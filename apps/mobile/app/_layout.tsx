import 'react-native-reanimated';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { theme } from '../src/theme';
import { handleDeepLink } from '../src/services/deepLinks';
import { usePreferencesStore } from '../src/store/preferencesStore';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
function AppBootstrap() { const hydrate = usePreferencesStore(state => state.hydrate); useEffect(() => { void hydrate(); void AsyncStorage.getItem('sali.onboarding.v3.complete').then(done => { if (!done) router.replace('/onboarding'); }); void Linking.getInitialURL().then(url => { if (url) return handleDeepLink(url); }); const subscription = Linking.addEventListener('url', ({ url }) => { void handleDeepLink(url); }); return () => subscription.remove(); }, [hydrate]); return null; }
export default function RootLayout() { return <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}><QueryClientProvider client={queryClient}><AppBootstrap /><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, animation: 'fade_from_bottom', animationDuration: 260 }}><Stack.Screen name="(tabs)" options={{ animation: 'fade' }} /><Stack.Screen name="servers" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} /><Stack.Screen name="onboarding" options={{ animation: 'fade' }} /><Stack.Screen name="support" options={{ animation: 'slide_from_right' }} /></Stack></QueryClientProvider></GestureHandlerRootView>; }
