import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';

const ITEMS = [
  { label: 'Language', to: '/settings/language' },
  { label: 'Notifications', to: '/settings/notifications' },
  { label: 'FAQ', to: '/support' },
  { label: 'Terms', to: '/settings/terms' },
  { label: 'Privacy Policy', to: '/settings/privacy' },
];

export function SettingsScreen() {
  const navigate = useNavigate();

  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Настройки</h1>

      <Card className="p-0 overflow-hidden divide-y divide-sali-gray-800">
        {ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.to)}
            className="press-feedback w-full flex items-center justify-between px-5 py-4 text-left"
          >
            <span className="text-[15px]">{item.label}</span>
            <span className="text-sali-gray-500">›</span>
          </button>
        ))}
      </Card>

      <button
        onClick={() => navigate('/invite')}
        className="press-feedback w-full flex items-center justify-between px-5 py-4 text-left bg-sali-gray-950 border border-sali-gray-800 rounded-lg"
      >
        <span className="text-[15px]">🎁 Пригласить друга</span>
        <span className="text-sali-gray-500">›</span>
      </button>
    </div>
  );
}
