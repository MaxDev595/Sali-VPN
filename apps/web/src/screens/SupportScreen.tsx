import { useState } from 'react';
import { api } from '../lib/api';
import { telegram } from '../lib/telegram';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

const CATEGORIES = [
  { code: 'vpn_not_connecting', label: 'VPN не подключается' },
  { code: 'no_internet', label: 'Не работает интернет' },
  { code: 'payment_issue', label: 'Проблема с оплатой' },
  { code: 'device_setup', label: 'Как подключить устройство?' },
  { code: 'other', label: 'Другой вопрос' },
];

export function SupportScreen() {
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  async function handleSend() {
    if (!selected || !message.trim()) return;
    setSending(true);
    try { await api.createSupportTicket(selected, message.trim()); telegram.haptic.success(); setSent(true); }
    catch { telegram.haptic.error(); }
    finally { setSending(false); }
  }
  if (sent) return <div className="px-5 pt-10 text-center space-y-3 screen-enter"><p className="text-xl font-semibold">Спасибо!</p><p className="text-sali-gray-400 text-[15px]">Обращение передано в поддержку. Мы ответим как можно скорее.</p></div>;
  return (
    <div className="px-5 pt-4 pb-8 space-y-5 screen-enter">
      <h1 className="text-2xl font-semibold tracking-tight">Поддержка</h1>
      <div className="space-y-2">{CATEGORIES.map((category) => <button key={category.code} onClick={() => setSelected(category.code)} className={`press-feedback w-full text-left px-5 py-4 rounded-lg border text-[15px] ${selected === category.code ? 'bg-white text-black border-white' : 'bg-sali-gray-950 border-sali-gray-800 text-white'}`}>{category.label}</button>)}</div>
      {selected && <Card><textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Опишите проблему…" rows={4} className="w-full bg-transparent outline-none text-[15px] placeholder:text-sali-gray-500 resize-none mb-4" /><Button onClick={handleSend} disabled={sending || !message.trim()}>{sending ? 'Отправка…' : 'Написать в поддержку'}</Button></Card>}
    </div>
  );
}
