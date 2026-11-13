# Тестовая среда (staging)

Отдельная копия Sali VPN для проверки новых функций — например, подключения через Happ —
**без риска для настоящих клиентов**. Всё тестовое отделено от боевого:

| Что | Боевое (клиенты) | Тестовое |
|---|---|---|
| Ветка в GitHub | `main` | `staging` |
| Сервер на Render | `sali-api` (api.salivpn.com) | `sali-api-staging` |
| База данных | Neon `main` | Neon-ветка `staging` |
| Telegram-бот | @SaliVPNOfficialBot | отдельный тестовый бот, например @SaliVPNTestBot |
| Android-приложение | «Sali VPN» (`apk-latest`) | «Sali VPN Test» (`apk-staging`), ставится рядом |
| VPN-сервер | 4 боевых узла | отдельный тестовый VPS |

Тестовое приложение и бот ходят **только** на тестовый сервер: даже если в тесте что-то сломается,
боевые серверы, база и клиенты этого не почувствуют.

## Один раз: настройка (~30 минут)

1. **Тестовый бот.** В @BotFather → `/newbot` → например `SaliVPNTestBot`. Сохраните токен.
2. **Тестовая база.** Neon → проект Sali → *Branches* → *Create branch* `staging` (от `main`) →
   скопируйте *Direct connection string* этой ветки (не боевой!).
3. **Сервер на Render.** Render → *Blueprints* → Sali-VPN → *Sync*. Появится `sali-api-staging`.
   Заполните у него: `DATABASE_URL` (из шага 2), `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`
   (тестовый бот), `ADMIN_TELEGRAM_IDS` (ваш Telegram ID). Стоимость — ещё один Starter, ~$7/мес.
4. **Адрес для тестового приложения.** GitHub → Settings → Secrets and variables → Actions →
   *Variables*: `STAGING_API_URL` = адрес `sali-api-staging` (например `https://sali-api-staging.onrender.com`),
   `STAGING_BOT_USERNAME` = имя тестового бота.
5. **Тестовый VPN-сервер.** Самый дешёвый VPS на Vultr (~$5/мес). В тестовом боте `/admin` →
   «🖥 Серверы» → добавить, и выполните на VPS команду, которую даст бот, **с адресом теста**:
   `curl -fsSL https://<staging>/api/v1/nodes/install.sh | SALI_API=https://<staging> bash -s -- <ТОКЕН>`

## Как работаем

1. Новую функцию Claude выкладывает в ветку **`staging`** (скрипт `push-staging.cmd`).
2. Render сам обновляет тестовый сервер и бота, GitHub собирает «Sali VPN Test».
3. Вы проверяете в тестовом боте и тестовом приложении.
4. Всё хорошо → «**в прод**»: те же изменения уходят в `main`, клиенты получают обновление.
   Что-то не так → чиним в `staging`, клиенты ничего не заметили.

## Правила

- Никогда не вписывать в тест боевую базу, боевой токен бота или боевой `ENCRYPTION_KEY`.
- Тестовое приложение не раздавать клиентам.
- Платежи в тестовом боте — только Stars в тестовом режиме или выдача подписки через `/admin`.
