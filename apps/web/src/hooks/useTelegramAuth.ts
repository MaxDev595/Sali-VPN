import { useCallback, useEffect, useRef, useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import { telegram } from '../lib/telegram';

type AuthState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export type TelegramAuthState = AuthState & { retry: () => Promise<void> };

export function useTelegramAuth(): TelegramAuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const attemptRef = useRef(0);

  const authenticate = useCallback(async () => {
    const attempt = ++attemptRef.current;
    setState({ status: 'loading' });
    setAuthToken(null);
    telegram.init();

    const initData = telegram.initData;
    if (!initData) {
      if (attempt === attemptRef.current) {
        setState({
          status: 'error',
          message: 'Не удалось получить сессию Telegram. Откройте приложение из бота и повторите проверку.',
        });
      }
      return;
    }

    try {
      const { token } = await api.loginWithTelegramWebApp(initData);
      if (attempt === attemptRef.current) {
        setAuthToken(token);
        setState({ status: 'ready' });
      }
    } catch (error) {
      if (attempt === attemptRef.current) {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Недействительная сессия Telegram',
        });
      }
    }
  }, []);

  useEffect(() => {
    void authenticate();
    return () => {
      attemptRef.current += 1;
    };
  }, [authenticate]);

  return { ...state, retry: authenticate };
}
