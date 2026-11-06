import { Navigate, Route, Routes } from 'react-router-dom';
import { LandingPage } from './screens/LandingPage';
import { LegalPage } from './screens/LegalPage';
import { DownloadPage } from './screens/DownloadPage';
import { HelpPage } from './screens/HelpPage';

export function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/download" element={<DownloadPage />} />
    <Route path="/help" element={<HelpPage />} />
    <Route path="/help/:slug" element={<HelpPage />} />
    <Route path="/privacy" element={<LegalPage type="privacy" />} />
    <Route path="/terms" element={<LegalPage type="terms" />} />
    {/* Old Mini App links from earlier bot messages land on the site. */}
    <Route path="/app/*" element={<Navigate to="/" replace />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
