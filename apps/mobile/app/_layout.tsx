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
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
function AppBootstrap() { useEffect(() => { void AsyncStorage.getItem('sali.onboarding.complete').then(done => { if (!done) router.replace('/onboarding'); }); void Linking.getInitialURL().then(url => url && handleDeepLink(url)); const subscription = Linking.addEventListener('url', ({ url }) => { void handleDeepLink(url); }); return () => subscription.remove(); }, []); return null; }
export default function RootLayout() { return <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}><QueryClientProvider client={queryClient}><AppBootstrap /><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}><Stack.Screen name="(tabs)" /><Stack.Screen name="servers" options={{ presentation: 'modal' }} /><Stack.Screen name="onboarding" /></Stack></QueryClientProvider></GestureHandlerRootView>; }
