import { Route, Routes } from 'react-router-dom';
import { I18nProvider } from './lib/i18n';
import { useTelegramAuth } from './hooks/useTelegramAuth';
import { BottomNav } from './components/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { SubscriptionScreen } from './screens/SubscriptionScreen';
import { DevicesScreen } from './screens/DevicesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { InviteScreen } from './screens/InviteScreen';
import { SupportScreen } from './screens/SupportScreen';
import { ServersScreen } from './screens/ServersScreen';
import { LandingPage } from './screens/LandingPage';
import { LegalPage } from './screens/LegalPage';

export function App() {
  return <Routes><Route path="/" element={<LandingPage />} /><Route path="/privacy" element={<LegalPage type="privacy" />} /><Route path="/terms" element={<LegalPage type="terms" />} /><Route path="/app/*" element={<MiniApp />} /></Routes>;
}

function MiniApp() {
  const auth = useTelegramAuth();
  if (auth.status === 'error') return <TelegramLoginRequired message={auth.message} onRetry={auth.retry} />;
  return <I18nProvider><div className="min-h-screen bg-black pb-16 text-white"><Routes><Route path="/" element={<HomeScreen />} /><Route path="/subscription" element={<SubscriptionScreen />} /><Route path="/devices" element={<DevicesScreen />} /><Route path="/servers" element={<ServersScreen />} /><Route path="/settings" element={<SettingsScreen />} /><Route path="/settings/*" element={<SettingsScreen />} /><Route path="/invite" element={<InviteScreen />} /><Route path="/support" element={<SupportScreen />} /></Routes><BottomNav /></div></I18nProvider>;
}

function TelegramLoginRequired({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  const botUrl = import.meta.env.VITE_TELEGRAM_BOT_URL ?? 'https://t.me/SaliVPNOfficialBot';
  return <div className="min-h-screen bg-black flex items-center justify-center px-6 text-white"><div className="w-full max-w-sm text-center space-y-5 screen-enter"><div className="mx-auto w-16 h-16 rounded-full bg-white text-black flex items-center justify-center text-3xl">→</div><div className="space-y-2"><h1 className="text-2xl font-semibold">Войдите через Telegram</h1><p className="text-sali-gray-400 text-[15px] leading-relaxed">{message}</p></div><a href={botUrl} className="press-feedback rounded-lg font-semibold text-[15px] py-4 px-6 flex items-center justify-center bg-white text-black w-full">Перейти в Telegram-бота</a><button type="button" onClick={() => void onRetry()} className="press-feedback text-sali-gray-400 text-sm py-2">Я уже открыл приложение в Telegram</button></div></div>;
}
