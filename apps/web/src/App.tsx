import { Route, Routes } from 'react-router-dom';
import { useTelegramAuth } from './hooks/useTelegramAuth';
import { BottomNav } from './components/BottomNav';
import { HomeSkeleton, ErrorState } from './components/StatusStates';
import { HomeScreen } from './screens/HomeScreen';
import { SubscriptionScreen } from './screens/SubscriptionScreen';
import { DevicesScreen } from './screens/DevicesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { InviteScreen } from './screens/InviteScreen';
import { SupportScreen } from './screens/SupportScreen';

export function App() {
  const auth = useTelegramAuth();

  if (auth.status === 'loading') {
    return (
      <div className="min-h-screen bg-black">
        <HomeSkeleton />
      </div>
    );
  }

  if (auth.status === 'error') {
    return (
      <div className="min-h-screen bg-black">
        <ErrorState onRetry={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-16">
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/subscription" element={<SubscriptionScreen />} />
        <Route path="/devices" element={<DevicesScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/*" element={<SettingsScreen />} />
        <Route path="/invite" element={<InviteScreen />} />
        <Route path="/support" element={<SupportScreen />} />
      </Routes>
      <BottomNav />
    </div>
  );
}
