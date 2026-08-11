import WebApp from '@twa-dev/sdk';

/**
 * Thin wrapper around the Telegram WebApp SDK so the rest of the app never
 * touches `window.Telegram` directly, and works (no-ops) outside Telegram
 * during local development in a normal browser.
 */
export const telegram = {
  isAvailable: typeof window !== 'undefined' && Boolean((window as any).Telegram?.WebApp),

  init() {
    if (!this.isAvailable) return;
    WebApp.ready();
    WebApp.expand();
    WebApp.setHeaderColor('#000000');
    WebApp.setBackgroundColor('#000000');
    WebApp.enableClosingConfirmation();
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
