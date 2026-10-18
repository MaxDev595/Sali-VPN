/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SALI_ANDROID_URL?: string;
  readonly VITE_HAPP_ANDROID_URL?: string;
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_TELEGRAM_BOT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
