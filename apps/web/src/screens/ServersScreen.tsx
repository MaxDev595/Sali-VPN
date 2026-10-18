import { Card } from '../components/Card';
import { useI18n } from '../lib/i18n';

const showcaseServers = [
  { flag: '🇳🇱', country: 'Нидерланды', city: 'Амстердам', access: 'FREE', note: 'Оптимальный маршрут', featured: true },
  { flag: '🇩🇪', country: 'Германия', city: 'Франкфурт', access: 'PREMIUM', note: 'Высокая скорость' },
  { flag: '🇫🇮', country: 'Финляндия', city: 'Хельсинки', access: 'PREMIUM', note: 'Низкая задержка' },
  { flag: '🇨🇭', country: 'Швейцария', city: 'Цюрих', access: 'PREMIUM', note: 'Приватный маршрут' },
  { flag: '🇺🇸', country: 'США', city: 'Нью-Йорк', access: 'СКОРО', note: 'Новая локация' },
  { flag: '🇯🇵', country: 'Япония', city: 'Токио', access: 'СКОРО', note: 'Новая локация' },
];

export function ServersScreen() {
  const { t } = useI18n();
  return <div className="px-5 pt-4 pb-8 space-y-4 screen-enter"><div><h1 className="text-2xl font-semibold tracking-tight">{t('servers')}</h1><p className="mt-1 text-sm text-sali-gray-500">Глобальная сеть Sali VPN</p></div><Card className="border-sali-gray-700 bg-gradient-to-br from-sali-gray-900 to-sali-gray-950"><p className="text-xs uppercase tracking-widest text-sali-gray-500">Sali Network</p><p className="mt-2 text-xl font-semibold">Быстрые маршруты по всему миру</p><p className="mt-2 text-sm leading-6 text-sali-gray-400">Выбирайте подходящую локацию для быстрого и комфортного подключения.</p></Card><div className="space-y-3">{showcaseServers.map(server => <Card key={`${server.country}-${server.city}`} className={server.featured ? 'border-sali-gray-500' : ''}><div className="flex items-center gap-3"><span className="text-3xl">{server.flag}</span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-medium">{server.country}</p><span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wider ${server.access === 'FREE' ? 'bg-white text-black' : 'border border-sali-gray-600 text-sali-gray-300'}`}>{server.access}</span></div><p className="mt-1 text-sm text-sali-gray-500">{server.city} · {server.note}</p></div><span className={`h-2 w-2 rounded-full ${server.access === 'СКОРО' ? 'bg-sali-gray-700' : 'bg-sali-accent'}`} /></div>{server.featured && <p className="mt-3 text-xs text-sali-gray-300">Рекомендуемый бесплатный сервер</p>}</Card>)}</div></div>;
}
