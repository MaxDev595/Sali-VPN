import { useEffect, useState } from 'react';
import { api, setAuthToken } from '../lib/api';
import { telegram } from '../lib/telegram';

type AuthState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; message: string };

export function useTelegramAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      telegram.init();

      if (!telegram.initData) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Необходимо открыть приложение через Telegram и войти в свой аккаунт.',
          });
        }
        return;
      }

      try {
        const { token } = await api.loginWithTelegramWebApp(telegram.initData);
        setAuthToken(token);
        if (!cancelled) setState({ status: 'ready' });
      } catch (err) {
        if (!cancelled) {
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Недействительная сессия Telegram',
          });
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
