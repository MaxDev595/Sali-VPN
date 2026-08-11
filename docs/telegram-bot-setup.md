# Telegram Bot Setup

## 1. Create the bot

1. Open [@BotFather](https://t.me/BotFather) in Telegram.
2. Send `/newbot`, choose a name and a username (e.g. `SaliVPNBot`).
3. Copy the token BotFather gives you into `.env` as `TELEGRAM_BOT_TOKEN`.
4. Set `TELEGRAM_BOT_USERNAME` in `.env` to the username (no `@`).

## 2. Register the Mini App

1. In BotFather, send `/newapp`, pick your bot, and set the Web App URL to
   your deployed Mini App (`TELEGRAM_MINIAPP_URL` in `.env`, e.g.
   `https://your-miniapp-domain.example`).
2. Optionally send `/setmenubutton` and choose "Configure menu button" to
   make the Mini App reachable directly from the chat's menu button, in
   addition to the inline buttons the bot already sends.

## 3. Configure commands (optional, cosmetic)

Send `/setcommands` to BotFather with:
```
start - Начать работу с Sali VPN
```

## 4. Choose a run mode

- **Local development**: set `TELEGRAM_MODE=polling` in `.env`. Run
  `npm run dev:bot`. No public URL needed.
- **Production**: set `TELEGRAM_MODE=webhook`, `TELEGRAM_WEBHOOK_URL` to a
  public HTTPS URL routed to the bot container (see
  `infrastructure/nginx/reverse-proxy.conf`), and `TELEGRAM_WEBHOOK_SECRET`
  to a random string. The bot registers the webhook with Telegram on boot.

## 5. Payments (optional, only if using Telegram Stars)

1. In BotFather, send `/mybots` → your bot → Payments, and connect a
   provider to get a provider token.
2. Put it in `.env` as `TELEGRAM_PAYMENTS_PROVIDER_TOKEN`.
3. Set `PAYMENT_PROVIDER=telegram_stars` in `.env`.

Until this is configured, `PAYMENT_PROVIDER=manual` keeps the full purchase
flow working end-to-end (payments are marked pending and confirmed manually
via the admin API), so the rest of the product can be built and demoed
before a real payment processor is connected.
