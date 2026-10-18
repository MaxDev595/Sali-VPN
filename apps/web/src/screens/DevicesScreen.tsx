import { useNavigate } from 'react-router-dom';
import { Card } from '../components/Card';
import { DownloadOptions } from '../components/DownloadOptions';
import { PlatformIcon } from '../components/PlatformIcon';
import { useI18n } from '../lib/i18n';

const platforms = [
  { id: 'android' as const, name: 'Android', description: 'Телефон или планшет' },
  { id: 'apple' as const, name: 'Apple', description: 'iPhone, iPad или Mac' },
  { id: 'windows' as const, name: 'Windows', description: 'Компьютер или ноутбук' },
];

export function DevicesScreen() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return <div className="px-5 pt-4 pb-8 space-y-5 screen-enter"><div><h1 className="text-2xl font-semibold tracking-tight">{t('myDevices')}</h1><p className="mt-1 text-sm text-sali-gray-500">Один доступ — все ваши устройства</p></div><Card className="border-sali-gray-700"><p className="text-xs uppercase tracking-widest text-sali-gray-500">Возможности тарифа</p><p className="mt-2 text-xl font-semibold">До 3 устройств</p><p className="mt-2 text-sm leading-6 text-sali-gray-400">Подключайте телефон, компьютер и планшет к одной подписке Sali.</p></Card><div className="space-y-3"><p className="text-xs uppercase tracking-widest text-sali-gray-500">Поддерживаемые устройства</p>{platforms.map(platform => <button key={platform.id} type="button" onClick={() => navigate('/app')} className="press-feedback flex w-full items-center gap-4 rounded-lg border border-sali-gray-800 bg-sali-gray-950 p-4 text-left"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-black text-white"><PlatformIcon platform={platform.id} className="h-12 w-12" /></span><span className="min-w-0 flex-1"><strong className="block text-[15px] font-medium text-white">{platform.name}</strong><span className="mt-1 block text-sm text-sali-gray-500">{platform.description}</span></span><span className="text-xl text-sali-gray-600">›</span></button>)}</div><Card><p className="font-medium">Как подключить устройство</p><ol className="mt-3 space-y-3 text-sm leading-6 text-sali-gray-400"><li><span className="mr-2 text-white">1.</span>Установите Sali VPN или HAPP.</li><li><span className="mr-2 text-white">2.</span>Получите конфигурацию на главной странице.</li><li><span className="mr-2 text-white">3.</span>Импортируйте её и включите защищённое соединение.</li></ol></Card><DownloadOptions /></div>;
}
