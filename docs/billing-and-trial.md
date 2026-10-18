# Trial, devices and billing

## Access lifecycle

1. Login creates/loads the user, but does not start a trial.
2. The client registers its installation at `POST /devices/current`.
3. `POST /vpn/connect` requires the same opaque key in `X-Device-Key`.
4. The API checks the device limit and the permanent `TrialDeviceClaim`, provisions VPN access and starts the 60-minute server timer.
5. The expiry job disables the WireGuard peer. A successful payment enables it again; subscription expiry disables it.

Android hashes `ANDROID_ID` with the app namespace in native code. This normally survives reinstall on the same signing key/device. It is intentionally one signal, not a claim of an unchangeable hardware ID. Telegram identity, the permanent server claim, account history and rate limiting remain additional controls.

Removing a device deactivates its record; it does not delete its trial claim. Increase/decrease the per-plan limit with `Plan.maxDevices`.

## Card payments (Paddle)

Set `PAYMENT_PROVIDER=paddle` for the default checkout and configure:

- `PADDLE_API_KEY`
- `PADDLE_PRICE_ID`
- `PADDLE_WEBHOOK_SECRET`

Point Paddle webhooks to `POST /api/v1/payments/webhooks/paddle`. Subscribe to transaction completed/failed, subscription canceled and adjustment events. The endpoint checks the Paddle HMAC over the exact raw request body and rejects timestamps older than five minutes.

## Crypto payments (USDT on TON)

The API creates a 30-minute invoice containing the exact USDT amount and a
unique payment comment. Every 20 seconds it reads completed USDT Jetton
transfers, atomically claims a previously unused event hash and activates the
same subscription flow as Paddle. No wallet seed phrase or private key is
stored by Sali.

Configure:

- `CRYPTO_WATCHER_ENABLED=true`
- `CRYPTO_TON_RECEIVE_ADDRESS=<public TON Space address>`
- `CRYPTO_USDT_TON_AMOUNT=<price in USDT>`
- `TONAPI_API_KEY=<read-only key>`
- optionally `CRYPTO_INVOICE_TTL_MINUTES` and `TONAPI_BASE_URL`

Only completed transfers of the official USDT master contract, exact amount,
destination and invoice comment are accepted. The current official mainnet
master is `EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs`; it can be pinned
with `CRYPTO_USDT_TON_MASTER`. Expired invoices cannot be matched. Refunds
remain a manual, administrator-approved outgoing-wallet operation.

Use a project-controlled TON Space address, not a custodial exchange deposit
address that requires its own memo. Users must send USDT on TON and copy the
invoice comment exactly.

The Mini App sends `provider: paddle` or `provider: crypto`, so both checkout methods can be offered at the same time regardless of the default provider.

## Before production

Apply Prisma migrations, use HTTPS, keep provider secrets only in the API environment, and configure provider webhook retries. Perform sandbox purchases for success, duplicate webhook, failure, cancellation, renewal and refund before switching provider accounts to live mode.
