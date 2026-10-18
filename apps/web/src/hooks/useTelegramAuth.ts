import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, setAuthToken } from '../lib/api';
import { telegram } from '../lib/telegram';
import { currentDevice } from '../lib/device';

type AuthState =
  | { status: 'loading' }
  | { status: 'ready'; warning?: string }
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
      if (import.meta.env.DEV) {
        if (attempt === attemptRef.current) {
          setState({ status: 'ready', warning: 'Локальный режим без Telegram' });
        }
        return;
      }

      if (attempt === attemptRef.current) {
        setState({
          status: 'error',
          message: 'Не удалось получить сессию Telegram. Откройте приложение из бота и повторите проверку.',
        });
      }
      return;
    }

    try {
      const referralCode = new URLSearchParams(window.location.search).get('ref') ?? undefined;
      const { token } = await api.loginWithTelegramWebApp(initData, referralCode);
      setAuthToken(token);
      void api.registerCurrentDevice(currentDevice()).catch(() => {});
      if (attempt === attemptRef.current) {
        setState({ status: 'ready' });
      }
    } catch (error) {
      if (attempt === attemptRef.current) {
        const isTemporaryApiFailure = error instanceof ApiRequestError
          && (error.status === undefined || error.status >= 500);
        setState(isTemporaryApiFailure
          ? { status: 'ready' }
          : {
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
