import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ReferralInfoDTO } from '@sali/types';
import { Card } from '../components/Card';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { useI18n } from '../lib/i18n';

export function SettingsScreen() {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useI18n();
  const [referrals, setReferrals] = useState<ReferralInfoDTO | null>(null);
  const [notifications, setNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api.getReferralInfo().then(setReferrals).catch(() => undefined);
    void api.getPreferences().then((value) => setNotifications(value.notificationsEnabled)).catch(() => undefined);
  }, []);
  async function toggleNotifications() {
    const next = !notifications;
    setNotifications(next); setSaving(true);
    try { await api.updatePreferences({ notificationsEnabled: next }); telegram.haptic.success(); }
    catch { setNotifications(!next); telegram.haptic.error(); }
    finally { setSaving(false); }
  }
  return <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
    <h1 className="text-2xl font-semibold tracking-tight">{t('settings')}</h1>
    <Card>
      <p className="text-xs text-sali-gray-500 uppercase tracking-wide mb-3">{t('language')}</p>
      <div className="grid grid-cols-2 gap-2">{(['ru', 'en'] as const).map((code) => <button key={code} onClick={() => void setLanguage(code)} className={`press-feedback py-3 rounded-lg border text-sm transition-colors ${language === code ? 'bg-white text-black border-white' : 'border-sali-gray-700 text-sali-gray-300'}`}>{code === 'ru' ? 'Русский' : 'English'}</button>)}</div>
    </Card>
    <Card className="flex items-center justify-between gap-4">
      <button onClick={toggleNotifications} disabled={saving} className="w-full flex items-center justify-between text-left">
        <span><span className="block text-[15px]">{t('notifications')}</span><span className="block text-xs text-sali-gray-500 mt-1">{t('notificationsHint')}</span></span>
        <span className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${notifications ? 'bg-white' : 'bg-sali-gray-700'}`}><span className={`absolute top-1 w-5 h-5 rounded-full transition-transform duration-200 ${notifications ? 'translate-x-6 bg-black' : 'translate-x-1 bg-white'}`} /></span>
      </button>
    </Card>
    <Card className="p-0 overflow-hidden divide-y divide-sali-gray-800">
      {[{ label: t('faq'), to: '/app/support' }, { label: t('terms'), to: '/app/settings/terms' }, { label: t('privacy'), to: '/app/settings/privacy' }].map((item) => <button key={item.to} onClick={() => navigate(item.to)} className="press-feedback w-full flex items-center justify-between px-5 py-4 text-left"><span className="text-[15px]">{item.label}</span><span className="text-sali-gray-500">›</span></button>)}
    </Card>
    <button onClick={() => navigate('/app/invite')} className="press-feedback w-full flex items-center justify-between px-5 py-4 text-left bg-sali-gray-950 border border-sali-gray-800 rounded-lg"><span className="text-[15px]">{t('invite')}</span><span className="text-sali-gray-500">{referrals ? `${referrals.totalRewarded} · ${referrals.availableDiscounts}` : '›'}</span></button>
  </div>;
}
