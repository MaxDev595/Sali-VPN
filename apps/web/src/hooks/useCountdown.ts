import { useEffect, useState } from 'react';

export function formatDuration(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function useElapsedTime(initialSeconds: number, running: boolean) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => setSeconds(initialSeconds), [initialSeconds]);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);
  return { seconds, formatted: formatDuration(seconds) };
}

export function useRemainingTime(initialSeconds: number, running: boolean) {
  const [seconds, setSeconds] = useState(initialSeconds);
  useEffect(() => setSeconds(initialSeconds), [initialSeconds]);
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(interval);
  }, [running]);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  return { seconds, formatted };
}

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
  const formatted = formatDuration(secondsLeft);

  return { secondsLeft, formatted };
}
