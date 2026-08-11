# Required API Keys & Credentials

Copy `.env.example` to `.env` and fill these in. Nothing here is hardcoded
anywhere in the codebase.

| Variable | Where to get it | Required for |
|---|---|---|
| `DATABASE_URL` | Your PostgreSQL instance (Docker Compose provides one) | Everything |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` | Mini App session auth |
| `INTERNAL_API_KEY` | Generate: `openssl rand -hex 32` | Bot → API calls |
| `ADMIN_TELEGRAM_IDS` | Your own numeric Telegram ID (e.g. from [@userinfobot](https://t.me/userinfobot)) | Admin API access |
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) → `/newbot` | The bot itself |
| `TELEGRAM_BOT_USERNAME` | Chosen when creating the bot | Referral links |
| `TELEGRAM_MINIAPP_URL` | Your deployed Mini App HTTPS URL, registered with BotFather | Mini App buttons |
| `TELEGRAM_WEBHOOK_SECRET` | Generate: `openssl rand -hex 32` | Webhook mode only |
| `WIREGUARD_API_URL` / `WIREGUARD_API_KEY` | Set up by you — see `docs/vpn-server-setup.md` | Real VPN access |
| `TELEGRAM_PAYMENTS_PROVIDER_TOKEN` | BotFather → your bot → Payments (optional) | Telegram Stars payments |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | [Stripe dashboard](https://dashboard.stripe.com/apikeys) (optional, not yet implemented — see below) | Stripe payments |

## Nothing to configure yet

- **`PAYMENT_PROVIDER=manual`** (the default) requires no external
  credentials — it's a fully wired but non-charging placeholder so the
  purchase flow works end-to-end. Confirm payments manually via
  `POST /admin/payments/:id/confirm` until you connect a real processor.
- **`VPN_PROVIDER=mock`** (the default) requires no VPN server — it's an
  in-memory stand-in so you can build/demo the whole product before
  provisioning WireGuard infrastructure.

## Adding Stripe later

`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` are reserved in
`.env.example` but not yet wired to an adapter (no Stripe account was
available at build time). To add it: implement `PaymentProvider`
(`apps/api/src/modules/payments/providers/payment-provider.interface.ts`) in
a new `stripe.provider.ts`, register it in `payments.module.ts`'s factory,
and set `PAYMENT_PROVIDER=stripe`. No other code changes needed.
