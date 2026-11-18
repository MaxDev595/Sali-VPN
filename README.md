# Sali VPN

A fast, private VPN: apps for Android and Windows, a Telegram bot for buying codes and
support, a site with the help centre, and a backend that drives WireGuard / AmneziaWG
servers. $5/month (officially $8), 3 days free.

## Architecture

```
/apps
  /api          NestJS + Fastify backend (REST API, Prisma/PostgreSQL, VPN + payment abstractions)
  /bot          Telegraf bot: free code, purchases, codes, devices, invites, documentation
  /support-bot  Support desk bot (@SaliVPNHelpBot)
  /mobile       Android app (Expo / React Native + native WireGuard backend)
  /web          salivpn.com: landing, /download, /help/<topic>, legal pages
/desktop        Windows app (Electron + WireGuard service)
/packages/types Shared TypeScript types
/infrastructure nginx configs, VPN node installer and agent
/docs           Setup guides, API docs, deployment, credentials
```

### Key design decisions

- **Payments live only in the bot.** The apps never show a price: they redeem
  activation codes `SALI-XXXX-XXXX-XXXX`. One code activates one device.
- **Each app install is an account** identified by its installation key and shown as a
  Sali ID (`SL-XXXX-XXXX`). The bot links devices to a Telegram account.
- **VPN technology is abstracted** behind `VPNProvider`
  (`apps/api/src/modules/vpn/providers/vpn-provider.interface.ts`). Production uses
  `nodes` — see `docs/vpn-nodes.md`.
- **The server is the source of truth** for trial expiry, subscriptions and VPN access.
- **Referrals:** an invited friend gets +1 day after their first code, the inviter
  gets 10% off the next purchase (`REFERRAL_FRIEND_BONUS_HOURS`, `REFERRAL_DISCOUNT_PERCENT`).
- **Help centre:** `apps/web/src/help/articles.ts`. The apps' settings and the bot's
  «📖 Документация» open `https://salivpn.com/help/<slug>`; slugs must stay stable.

## Local development

```bash
cp .env.example .env    # TELEGRAM_BOT_TOKEN, JWT_SECRET, INTERNAL_API_KEY at minimum
npm install
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run --workspace=apps/api prisma:seed

npm run dev:api    # http://localhost:3000
npm run dev:bot    # polling mode
npm run dev:web    # http://localhost:5173
```

On Windows, `start-sali-vpn.cmd` starts the whole local stack.

By default `VPN_PROVIDER=mock`, so codes, plans and the bot work end-to-end without a
real VPN server.

## Documentation

- [`docs/deploy-render-neon.md`](docs/deploy-render-neon.md) — production on Render + Neon
- [`docs/vpn-nodes.md`](docs/vpn-nodes.md) — adding VPN servers from the bot
- [`docs/telegram-bot-setup.md`](docs/telegram-bot-setup.md) — BotFather and bot settings
- [`docs/bot-structure.md`](docs/bot-structure.md) — bot menus
- [`docs/api.md`](docs/api.md) — REST API reference
- [`docs/credentials.md`](docs/credentials.md) — every key and secret

## Apps

- **Android** — `apps/mobile`. CI: `ci/android-apk.yml` → release `apk-latest`.
- **Windows** — `desktop/`. CI: `ci/desktop.yml` → release `desktop-latest`.
- **Download page** — https://salivpn.com/download.
- Font everywhere: **Sali Sans** — the logo lettering (Outfit) merged with Jost for Cyrillic (OFL).
