import { Card } from './Card';

const saliPlayUrl = import.meta.env.VITE_SALI_ANDROID_URL ?? 'https://play.google.com/store/apps/details?id=app.sali.vpn';
const happPlayUrl = import.meta.env.VITE_HAPP_ANDROID_URL ?? 'https://play.google.com/store/apps/details?id=com.happproxy';

function StoreLink({ href, title, description, logo, compactLogo = false }: { href: string; title: string; description: string; logo: string; compactLogo?: boolean }) {
  return <a href={href} target="_blank" rel="noreferrer" className="press-feedback flex min-h-20 items-center gap-4 rounded-lg border border-sali-gray-700 bg-sali-gray-900 px-4 py-3 text-left text-white no-underline"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white"><img src={logo} alt="" className={`object-contain ${compactLogo ? 'h-9 w-9 translate-x-0.5' : 'h-12 w-12'}`} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px] font-semibold">{title}</strong><span className="mt-1 block text-xs leading-5 text-sali-gray-400">{description}</span></span><span aria-hidden="true" className="text-xl text-sali-gray-500">›</span></a>;
}

export function DownloadOptions() {
  return <Card className="space-y-3"><div><p className="text-xs uppercase tracking-widest text-sali-gray-500">Приложение для Android</p><h2 className="mt-1 text-lg font-semibold">Выберите способ подключения</h2></div><StoreLink href={saliPlayUrl} logo="/assets/google-play.png" compactLogo title="Скачать Sali VPN" description="Установить приложение через Google Play" /><StoreLink href={happPlayUrl} logo="/assets/happ.png" title="Подключить через HAPP" description="Установить HAPP и добавить конфигурацию Sali" /></Card>;
}
