import { useEffect, useState } from 'react';

export function useCountdown(expiresAtIso: string | null | undefined) {
  const [secondsLeft, setSecondsLeft] = useState<number>(() =>
    expiresAtIso ? Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000)) : 0,
  );

  useEffect(() => {
    if (!expiresAtIso) return;
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.floor((new Date(expiresAtIso).getTime() - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAtIso]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return { secondsLeft, formatted };
}
