import WebApp from '@twa-dev/sdk';

let initialized = false;

function supports(version: string): boolean {
  return (WebApp as typeof WebApp & { isVersionAtLeast?: (version: string) => boolean })
    .isVersionAtLeast?.(version) ?? false;
}

/**
 * Thin wrapper around the Telegram WebApp SDK so the rest of the app never
 * touches `window.Telegram` directly, and works (no-ops) outside Telegram
 * during local development in a normal browser.
 */
export const telegram = {
  isAvailable: typeof window !== 'undefined' && Boolean((window as any).Telegram?.WebApp),

  init() {
    if (!this.isAvailable || initialized) return;
    initialized = true;
    WebApp.ready();
    WebApp.expand();
    if (supports('6.1')) {
      WebApp.setHeaderColor('#040913');
      WebApp.setBackgroundColor('#040913');
    }
    if (supports('6.2')) {
      WebApp.enableClosingConfirmation();
    }
  },

  get initData(): string {
    return this.isAvailable ? WebApp.initData : '';
  },

  haptic: {
    light() {
      if (telegram.isAvailable) WebApp.HapticFeedback.impactOccurred('light');
    },
    medium() {
      if (telegram.isAvailable) WebApp.HapticFeedback.impactOccurred('medium');
    },
    success() {
      if (telegram.isAvailable) WebApp.HapticFeedback.notificationOccurred('success');
    },
    error() {
      if (telegram.isAvailable) WebApp.HapticFeedback.notificationOccurred('error');
    },
  },

  /**
   * Payments happen in the bot chat: open it with a start parameter
   * (buy / free) and close the Mini App so the customer lands in the chat.
   */
  openBot(startParam?: string) {
    const base = (import.meta.env.VITE_TELEGRAM_BOT_URL ?? 'https://t.me/SaliVPNOfficialBot').replace(/\/$/, '');
    const url = startParam ? `${base}?start=${startParam}` : base;
    if (this.isAvailable) {
      WebApp.openTelegramLink(url);
      setTimeout(() => WebApp.close(), 150);
    } else window.location.assign(url);
  },

  showMainButton(text: string, onClick: () => void) {
    if (!this.isAvailable) return;
    WebApp.MainButton.setText(text);
    WebApp.MainButton.onClick(onClick);
    WebApp.MainButton.show();
  },

  hideMainButton() {
    if (this.isAvailable) WebApp.MainButton.hide();
  },
};
