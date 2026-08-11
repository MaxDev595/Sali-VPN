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
        // Local dev outside Telegram: allow the app to render with mock data
        // so the UI can be built without a live bot session.
        if (import.meta.env.DEV) {
          if (!cancelled) setState({ status: 'ready' });
          return;
        }
        if (!cancelled) {
          setState({ status: 'error', message: 'Invalid Telegram session' });
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
            message: err instanceof Error ? err.message : 'Invalid Telegram session',
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
