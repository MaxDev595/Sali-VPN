# Production Deployment Guide

## Overview

- `apps/api` — NestJS backend (Docker container, port 3000 internally)
- `apps/bot` — Telegraf bot (Docker container, port 8080 internally, webhook mode)
- `apps/web` — Mini App static build served by nginx (Docker container, port 80 internally)
- `postgres` — database
- A reverse proxy terminates HTTPS and routes to the three services above.

## 1. Provision infrastructure

- One server (or more, split as you like) for `api` + `bot` + `postgres` +
  reverse proxy, running Docker + Docker Compose.
- At least one separate VPS per VPN location running WireGuard + `wg-agent`
  (see `docs/vpn-server-setup.md`) — keep these separate from the app server
  for a smaller blast radius and cleaner IP/routing.
- Two DNS records pointing at your app server: one for the API/bot
  (`your-domain.example`) and one for the Mini App
  (`your-miniapp-domain.example`).

## 2. Configure environment

```bash
cp .env.example .env
# Fill in every value — see docs/credentials.md for what each one is and
# where to get it.
```

## 3. Obtain TLS certificates

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d your-domain.example -d your-miniapp-domain.example
```
Then update `infrastructure/nginx/reverse-proxy.conf` with your real domains
(already templated) and mount `/etc/letsencrypt` into whatever container or
host process serves that config. Set up a renewal cron (`certbot renew`).

## 4. Build and start

```bash
docker compose build
docker compose up -d postgres
docker compose run --rm api npm run prisma:migrate:deploy --workspace=@sali/api
docker compose run --rm api npm run prisma:seed --workspace=@sali/api
docker compose up -d
```

## 5. Point Telegram at your deployment

Follow `docs/telegram-bot-setup.md` — set `TELEGRAM_MODE=webhook`,
`TELEGRAM_WEBHOOK_URL=https://your-domain.example/telegram/webhook`, and
register the Mini App URL with BotFather as
`https://your-miniapp-domain.example`.

## 6. Verify

- `curl https://your-domain.example/api/v1/plans` → returns the seeded plan.
- Open the bot in Telegram, send `/start`, tap "🔐 Подключить VPN".
- Check `docker compose logs -f api bot` for errors.

## 7. Ongoing operations

- **Migrations**: `docker compose run --rm api npm run prisma:migrate:deploy --workspace=@sali/api`
  after pulling new code with schema changes.
- **Backups**: schedule regular `pg_dump` of the `postgres` volume.
- **Monitoring**: at minimum, alert on the `api` and `bot` containers
  restarting/crashing, and on WireGuard `wg-agent` health (`GET /status`
  on each VPN server, internal-only).
- **Scaling the bot**: the current support-flow session store is in-memory
  (see `apps/bot/src/index.ts`) — fine for one instance. If you run multiple
  bot replicas, move it to Redis first.
