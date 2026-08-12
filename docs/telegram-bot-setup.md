# Telegram bot production setup

The bot is `@VpnSaliBot`. It uses the existing Mini App and the API as its only
source of user, trial and subscription state.

## Environment

Required for the bot:

- `TELEGRAM_BOT_TOKEN` — BotFather token;
- `TELEGRAM_MINIAPP_URL` — public HTTPS Mini App URL;
- `API_URL` — API base URL (inside Compose: `http://api:3000`);
- `INTERNAL_API_KEY` — long random shared secret, identical in API and bot;
- `TELEGRAM_MODE` — `polling` locally, `webhook` in production;
- `TELEGRAM_WEBHOOK_URL` and `TELEGRAM_WEBHOOK_SECRET` — required for webhook mode;
- `SUPPORT_URL` — public support chat/account URL;
- `BOT_API_TIMEOUT_MS` — internal API timeout, default `8000`.

`TRIAL_DURATION_MINUTES` is read by the API. A trial is created atomically only
after the API validates Telegram Mini App `initData`.

## BotFather

Open `@BotFather`, choose `@VpnSaliBot`, then configure:

1. `/setcommands`

   ```text
   start - Открыть Sali VPN
   vpn - Статус VPN
   subscription - Подписка
   account - Аккаунт
   help - Помощь
   ```

2. `/setmenubutton` → select the bot → enter the deployed
   `TELEGRAM_MINIAPP_URL` and label `Открыть Sali VPN`.
3. `/newapp` (or edit the existing app) → use the same HTTPS Mini App URL. Do
   not create a second Mini App.
4. `/setdescription`:
   `Sali VPN — простой и приватный VPN без сложных настроек. Откройте приложение, чтобы подключиться и управлять подпиской.`
5. `/setabouttext`:
   `Простой VPN в Telegram. Быстрое подключение и минимум настроек.`
6. `/setuserpic` → upload the current square Sali brand mark if the bot has no
   production avatar.
7. Group privacy settings are not needed: this bot is designed for private
   chats. Do not disable privacy mode unless group features are added later.

## Production checks

- expose only the webhook route through HTTPS; never expose `/api/v1/internal`;
- run one polling instance or one webhook deployment (not both);
- apply Prisma migrations and seed the active plan;
- verify `/start` for a new Telegram account, open the Mini App, then repeat
  `/start` and confirm that the main menu is shown;
- monitor API/bot restarts and Telegram/API error logs;
- rotate the bot token and internal API key immediately if either is leaked.
