# Запуск бэкенда: Render + Neon

Что где живёт:

| Что | Где | Цена |
|---|---|---|
| База данных (PostgreSQL) | Neon | бесплатно на старте |
| API + основной бот + бот поддержки — **один сервис** | Render, тариф Starter | $7/мес |
| Лендинг, мини-апп, `config.json` | Cloudflare (как сейчас) | бесплатно |
| VPN-серверы (WireGuard) | отдельный VPS (позже) | — |

Адрес API для всех клиентов: **https://api.salivpn.com**. Сайт, мини-апп, APK и Windows-приложение уже настроены на него (приложения дополнительно читают адрес из `salivpn.com/config.json`, так что его можно поменять без пересборки).

---

## 1. Neon — база

1. Зарегистрируйтесь на https://neon.tech → **Create project**.
2. Name: `sali-vpn`. Region: **AWS Europe Central 1 (Frankfurt)** — рядом с сервером Render.
3. На странице проекта нажмите **Connect**. Выключите переключатель **Connection pooling** и скопируйте строку подключения. Она выглядит так:
   `postgresql://neondb_owner:ПАРОЛЬ@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   Нужна именно строка **без** `-pooler` в адресе: через неё работают миграции.

Таблицы создавать вручную не нужно — Render сделает это сам при первом запуске.

## 2. Render — API и боты

1. Зарегистрируйтесь на https://render.com через GitHub.
2. **New → Blueprint** → выберите репозиторий **MaxDev595/Sali-VPN**. Render найдёт файл `render.yaml` и покажет сервис **sali-api**.
3. Заполните переменные, которые он попросит:
   - `DATABASE_URL` — строка из Neon (шаг 1.3);
   - `TELEGRAM_BOT_TOKEN` — токен основного бота от @BotFather;
   - `SUPPORT_BOT_TOKEN` — токен бота поддержки (можно оставить пустым — тогда он не запустится);
   - `SUPPORT_ADMIN_USERNAME` — ваш ник в Telegram без @;
   - `ADMIN_TELEGRAM_IDS` — ваш числовой Telegram ID;
   - `CRYPTO_TON_RECEIVE_ADDRESS`, `TONAPI_API_KEY` — только если включаете оплату USDT, иначе пусто.
   `JWT_SECRET` и `INTERNAL_API_KEY` Render сгенерирует сам.
4. **Apply**. Тариф — Starter ($7/мес): он не засыпает, поэтому боты всегда онлайн.
5. **Важно:** остановите ботов на своём ПК (`Ctrl+C` в окне `dev:local`/`dev:bots`). Telegram не даёт одному боту работать в двух местах сразу — будет ошибка `409 Conflict`.

Первая сборка идёт 3–5 минут. В логах должно быть:
```
[render] Applying database migrations…
[render] Seeding plans and servers…
Sali VPN API listening on port 10000
[render] Bot started
[render] Support bot started
```

## 3. Домен api.salivpn.com

1. Render → сервис **sali-api** → **Settings → Custom Domains → Add** → `api.salivpn.com`. Render покажет адрес вида `sali-api.onrender.com`.
2. Cloudflare → домен salivpn.com → **DNS → Add record**:
   - Type: `CNAME`, Name: `api`, Target: `sali-api.onrender.com`;
   - Proxy status: **DNS only** (серое облако) — чтобы Render выпустил сертификат.
3. Вернитесь в Render и нажмите **Verify**. Через пару минут домен станет зелёным.

## 4. Проверка

- Откройте https://api.salivpn.com/api/v1/health — должно быть `{"ok":true}`.
- Напишите основному боту `/start`, нажмите «🎁 24 часа бесплатно» — бот пришлёт код.
- Откройте мини-апп из бота и приложение на телефоне — они должны увидеть ваш аккаунт.

## Обновления

Ничего делать не нужно: каждый пуш в `main`, который меняет API или ботов, Render собирает и выкатывает сам. Миграции базы применяются автоматически при запуске.

## VPN-серверы

Пока стоит `VPN_PROVIDER=mock`: всё работает (коды, подписки, боты), но реального туннеля нет. Когда появится VPS с WireGuard, в Render → **Environment** поменяйте:
```
VPN_PROVIDER=wireguard
WIREGUARD_API_URL=http://IP_VPS:51821
WIREGUARD_API_KEY=...
WIREGUARD_SERVER_PUBLIC_HOST=IP_VPS
```

## Если что-то не так

- **Бот молчит / «сервис временно недоступен»** — Render → Logs. Чаще всего не заполнен токен или `DATABASE_URL`.
- **`409 Conflict` в логах бота** — бот всё ещё запущен на ПК, остановите его там.
- **`P1001 Can't reach database`** — проверьте строку Neon: без `-pooler`, с `?sslmode=require`.
