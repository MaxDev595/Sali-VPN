# Sali VPN — API Documentation

Base URL: `https://your-domain.example/api/v1`
Local dev: `http://localhost:3000/api/v1`

All request/response bodies are JSON. All endpoints except `/auth/telegram-webapp`
require `Authorization: Bearer <token>`.

## Auth

### `POST /auth/telegram-webapp`
Exchanges a Telegram Mini App `initData` string for a session JWT.

```json
// Request
{ "initData": "query_id=...&user=...&auth_date=...&hash=..." }

// Response
{ "token": "eyJhbGciOi...", "startParam": "ref_123456789" }
```

## Home

### `GET /home`
Returns aggregated state for the Mini App home screen: user, VPN account,
trial, subscription.

### `POST /vpn/connect`
Creates the VPN account (first time) / starts the trial if not already
started / re-enables an existing account, and returns a ready-to-import
config.

```json
{
  "account": { "status": "ACTIVE", "...": "..." },
  "config": { "configText": "[Interface]...", "qrCodeDataUrl": "data:image/png;base64,..." }
}
```

### `POST /vpn/disconnect`
Disables the user's VPN account.

## Subscriptions

### `GET /plans`
Lists active plans.

### `GET /subscription`
Returns the user's latest subscription (or `null`).

## Payments

### `POST /payments/purchase`
```json
// Request
{ "planId": "uuid" }

// Response
{ "payment": {...}, "subscription": {...}, "checkout": {...} }
```
The shape of `checkout` depends on `PAYMENT_PROVIDER` — for `telegram_stars`
it contains an invoice payload the bot uses to send a native Telegram
invoice; for `manual` it's a placeholder pending manual confirmation via the
admin API.

## Devices

- `GET /devices` — list the user's devices
- `POST /devices` — `{ "name": "iPhone", "platform": "IOS" }`
- `DELETE /devices/:id`

Device platform enum: `IOS | ANDROID | WINDOWS | MACOS | LINUX | OTHER`.

## Referrals

### `GET /referrals/me`
```json
{ "link": "https://t.me/SaliVPNBot?start=ref_123", "totalInvited": 3, "totalRewarded": 2, "rewardDaysEarned": 6 }
```

## Support

- `GET /support/tickets`
- `POST /support/tickets` — `{ "category": "vpn_not_connecting", "message": "..." }`

## Internal (bot-only, never exposed publicly)

Base path: `/internal`, authenticated via `X-Internal-Api-Key` header
(shared secret, `INTERNAL_API_KEY`). These must be blocked at the reverse
proxy in production (see `infrastructure/nginx/reverse-proxy.conf`).

- `POST /internal/users/sync` — upsert user by Telegram profile, record referral
- `POST /internal/vpn/connect` — bot-triggered VPN connect (same effect as `/vpn/connect`)
- `POST /internal/users/state` — bot-facing state summary
- `POST /internal/payments/confirm` — confirm a payment by external id
- `POST /internal/support/tickets` — create a ticket from the bot conversation

## Admin (JWT + `user.isAdmin`)

Base path: `/admin`. Access is granted automatically to Telegram IDs listed
in `ADMIN_TELEGRAM_IDS` the next time they authenticate.

- `GET /admin/users`, `GET /admin/users/:id`
- `PATCH /admin/users/:id/block` — `{ "isBlocked": true }`
- `POST /admin/users/:id/vpn/disable` / `/enable`
- `GET /admin/subscriptions`, `POST /admin/subscriptions/:id/extend` — `{ "days": 30 }`
- `GET /admin/payments`, `POST /admin/payments/:id/confirm`
- `GET /admin/vpn-servers`
- `GET /admin/devices`
- `GET /admin/referrals`
- `GET /admin/support/tickets`, `PATCH /admin/support/tickets/:id` — `{ "status": "CLOSED" }`

## Error format

All errors return:
```json
{ "code": "BAD_REQUEST", "message": "Human readable, user-safe message" }
```
Unexpected server errors always return the generic message
`"Что-то пошло не так. Попробуйте ещё раз."` — technical details are logged
server-side only, never sent to the client.
