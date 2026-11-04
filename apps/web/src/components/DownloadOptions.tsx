import { Card } from './Card';
import { DOWNLOADS } from '../lib/downloads';

function StoreLink({ href, title, description, icon }: { href: string; title: string; description: string; icon: string }) {
  return <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer" className="press-feedback flex min-h-20 items-center gap-4 rounded-lg border border-sali-gray-700 bg-sali-gray-900 px-4 py-3 text-left text-white no-underline"><span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-sali-gray-800"><img src={icon} alt="" className="h-8 w-8 object-contain" /></span><span className="min-w-0 flex-1"><strong className="block text-[15px] font-semibold">{title}</strong><span className="mt-1 block text-xs leading-5 text-sali-gray-400">{description}</span></span><span aria-hidden="true" className="text-xl text-sali-gray-500">›</span></a>;
}

export function DownloadOptions() {
  return <Card className="space-y-3"><div><p className="text-xs uppercase tracking-widest text-sali-gray-500">Приложения Sali VPN</p><h2 className="mt-1 text-lg font-semibold">Установите на нужное устройство</h2></div>
    <StoreLink href={DOWNLOADS.apk} icon="/assets/icons/android.png" title="Android" description="Скачать APK (или через Google Play)" />
    <StoreLink href={DOWNLOADS.windows} icon="/assets/icons/windows.png" title="Windows" description="Установщик для компьютера и ноутбука" />
    <StoreLink href={DOWNLOADS.page} icon="/assets/icons/guide.png" title="Инструкции" description="Как установить и подключиться" />
  </Card>;
}
