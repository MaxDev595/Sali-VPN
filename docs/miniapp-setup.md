# Telegram Mini App Setup

The Mini App lives in `apps/web` — a React + Vite + TypeScript + Tailwind
single-page app.

## Local development

```bash
cd apps/web
cp .env.example .env   # set VITE_API_URL to your local API (default http://localhost:3000)
npm install
npm run dev
```

This opens the app in a normal browser. Outside Telegram, `useTelegramAuth`
detects there's no `initData` and renders the UI without calling
`/auth/telegram-webapp`, so you can build/inspect screens without a live bot
session in dev mode. Real data requires opening the app through Telegram
(see below) or a running API + at least one authenticated flow.

## Testing inside Telegram

Telegram Mini Apps must be served over HTTPS, even in testing. Options:

- Use a tunnel (e.g. `ngrok http 5173`) during development and set that URL
  in BotFather's Web App URL (see `docs/telegram-bot-setup.md`).
- Or deploy `apps/web` to any static host / the provided Docker/nginx setup
  and point BotFather at the real HTTPS URL.

Open the bot in Telegram and tap the Mini App button (or send `/start`,
which shows an inline "🔐 Подключить VPN" button that opens it).

## Design system

- Colors, spacing, and animation timing live in `tailwind.config.js` and
  `src/styles/globals.css`.
- Palette is intentionally minimal: black (`#000`), white (`#fff`), and a
  gray scale for secondary text/surfaces. The single accent color
  (`sali.accent`, a soft green) is reserved for "VPN is currently connected"
  — nowhere else — so it stays meaningful.
- All screen transitions use the `.screen-enter` class (fast fade + slight
  rise, ~220ms) and buttons use `.press-feedback` (scale down slightly on
  tap) — see `globals.css`.

## Production build

```bash
npm run build --workspace=@sali/web
```
Outputs static files to `apps/web/dist`, served via the provided
`apps/web/Dockerfile` + `infrastructure/nginx/miniapp.conf`, or any static
host of your choice (Vercel, Netlify, S3+CloudFront, etc.) — just make sure
`VITE_API_URL` is set at build time to your production API URL.
