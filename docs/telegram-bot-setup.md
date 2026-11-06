# Telegram bot production setup

The bot is `@SaliVPNOfficialBot`. Everything happens in ordinary chat messages and
buttons — there is no Mini App. The API is the only source of user, code, trial and
subscription state.

## Environment

Required for the bot:

- `TELEGRAM_BOT_TOKEN` — BotFather token;
- `API_URL` — API base URL (inside Compose: `http://api:3000`);
- `INTERNAL_API_KEY` — long random shared secret, identical in API and bot;
- `SITE_URL` — public site, default `https://salivpn.com`. «📖 Документация» links to `<SITE_URL>/help/<topic>`;
- `TELEGRAM_MODE` — `polling` locally, `webhook` in production;
- `TELEGRAM_WEBHOOK_URL` and `TELEGRAM_WEBHOOK_SECRET` — required for webhook mode;
- `SUPPORT_URL` — support bot, default `https://t.me/SaliVPNHelpBot`;
- `BOT_API_TIMEOUT_MS` — internal API timeout, default `8000`.

Read by the API:

- `TRIAL_DURATION_HOURS` (default 24) — the free tariff, counted from activation of the FREE code;
- `REFERRAL_FRIEND_BONUS_HOURS` (default 3) — extra time for an invited friend;
- `REFERRAL_DISCOUNT_PERCENT` (default 10) — discount for the inviter's next purchase.

## Referrals

1. The inviter shares `https://t.me/SaliVPNOfficialBot?start=ref_<telegramId>` from «👥 Пригласить друга».
2. A **new** Telegram account opens the bot with it → the referral is recorded.
3. When the friend activates their first code on a device, the friend's device gets
   +3 hours and the inviter gets a 10% discount (one per friend), applied automatically
   to the next purchase — Stars and USDT alike.

## BotFather

Open `@BotFather`, choose `@SaliVPNOfficialBot`, then configure:

1. Commands are registered by the bot on start-up (`/start /buy /free /codes /devices /invite /docs /account /help`).
2. `/setmenubutton` → select the bot → **Default** (commands list). If an old
   Web App menu button is set, reset it, otherwise it still opens the removed Mini App.
3. `/myapps` → if a Mini App is registered for the bot, delete it.
4. `/setdescription`:
   `Sali VPN — быстрый и приватный VPN. Здесь — бесплатный тариф, подписка, коды активации и поддержка.`
5. `/setabouttext`:
   `Быстрый и приватный VPN для Android и Windows.`

## Production checks

- never expose `/api/v1/internal` publicly;
- run one polling instance or one webhook deployment (not both — Telegram answers 409);
- migrations and the seed run automatically on Render;
- verify `/start` for a new Telegram account, «🎁 24 часа бесплатно», «💎 Купить подписку»
  (the official price is crossed out), «📖 Документация» → a topic → «Подробнее на сайте»;
- rotate the bot token and internal API key immediately if either is leaked.
