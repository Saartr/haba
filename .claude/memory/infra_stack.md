---
name: infra-stack
description: "Стек проекта Тапа — фронтенд, бэкенд, инфраструктура"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием.

**Фронтенд** (`C:\haba`):
- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)
- react-native-svg (SVG-иконки)
- Дизайн-система: TapaDS, цвета через `useColors()` из `lib/colors.ts`
- Шрифт: Manrope (medium/semibold/bold), обёртка `components/Text.tsx`

**Бэкенд** (`/var/www/haba/backend` на `apptapa.ru`, Ubuntu 24.04.4 LTS, в репо в папке `backend/`):
- Node.js v22, Express 5
- PostgreSQL (библиотека `postgres` tag, не pg/knex)
- PM2 (процесс-менеджер, имя процесса `step-bot`)
- node-cron (пуш-напоминания по целям; дайджесты бота удалены 2026-08-25)

**BASE_URL API:** `https://apptapa.ru/api/v1`

**Env-переменные сервера** (сверено с `.env` 2026-08-29): `PORT` (3000), `DATABASE_URL`, `JWT_SECRET`,
`VK_CLIENT_SECRET`, `VK_SERVICE_TOKEN`, `YANDEX_CLIENT_ID`, `FCM_PROJECT_ID`, `PUBLIC_ORIGIN`, `AVATARS_DIR`.
Переменные бота (`TELEGRAM_TOKEN`, `WEBHOOK_*`, `GOOGLE_CLIENT_*`) на новый сервер не переносились.
`PUBLIC_ORIGIN`/`AVATARS_DIR` читает `backend/src/config.js` — из них собираются `/avatars`-URL и
инвайт-ссылки, так что при следующем переезде домена достаточно сменить их и `SERVER_ORIGIN`
в `lib/config.ts`.

**JWT:** accessToken TTL 15 мин, refreshToken TTL 30 дней (ротируется при использовании)

**Деплой бэкенда:** ручной скрипт `deploy-backend.ps1` в корне репо. Подробности — [[rules-backend-deploy]].

**How to apply:** При написании кода — Expo SDK 55, читать доки на https://docs.expo.dev/versions/v55.0.0/. Бэкенд — Express 5, `postgres` tag-библиотека. Серверные правки коммитить в `backend/`, деплоить через `./deploy-backend.ps1` после пуша в `main`.

## Переезд на новый хостинг (2026-08-29)

Сервер: **Selectel, Санкт-Петербург**, `139.100.238.204`, алиас `ssh Tapa` (ключ тот же —
`~/.ssh/haba_deploy`). Ubuntu 24.04, 1 vCPU / 2 ГБ RAM / 25 ГБ + swap 2 ГБ.

**Why:** старый сервер стоял в Амстердаме (Timeweb, `147.45.134.216`). Приложение хранит
персданные россиян, а 152-ФЗ (ст. 18 ч. 5) требует хранить их в базах на территории РФ.
Та же логика, что и при отказе от Telegram-авторизации по 199-ФЗ.

**Домены:** `apptapa.ru` — бэкенд (API, `/join/<код>`, `/avatars/`), `kanban.apptapa.ru` —
Planka. Корень выбран под бэкенд намеренно: инвайт-ссылки user-facing, `apptapa.ru/join/abc`
короче и опрятнее, чем через поддомен `api.`.

**TLS и nginx:** сертификаты Let's Encrypt на `apptapa.ru` + `www` и отдельно на
`kanban.apptapa.ru`, обновляются сами (`certbot.timer` активен). Конфиги nginx —
`/etc/nginx/sites-enabled/step-bot` (бэкенд на :3000) и `kanban` (Planka), оба с
редиректом HTTP→HTTPS.

**Отличия от старого сервера:**
- PostgreSQL слушает только `localhost` (на старом торчал в интернет с `0.0.0.0/0` в
  pg_hba и выключенным ufw)
- ufw включён, открыты только 22/80/443
- Бэкапы: `/root/backup-db.sh` ежедневно в 04:00, ротация 14 дней (на старом их не было вовсе)

**Переезд завершён 2026-08-30:** старый сервер удалён (147.45.134.216 не отвечает ни на ping,
ни на 22/443), записи `bot.`/`kanban.` в `mihmih.pro` сняты. Перед удалением сверено, что новый
сервер содержит строго больше старого: те же users/аватары, habits 1-5 плюс новые, Planka
идентична (1 проект / 1 доска / 37 карточек / 3 юзера, 21 вложение, 2 аватара).

⚠️ Сам домен `mihmih.pro` живёт дальше и к приложению отношения не имеет: A-записи `mihmih.pro`
и `www` → `95.140.153.48`, MX `mx1/mx2.timeweb.ru`, NS Timeweb. Это личный сайт и почта — не трогать.

⚠️ В `~/.ssh/config` остался алиас `Host Haba` на освобождённый IP `147.45.134.216`. Хостер
переиспользует адрес, так что алиас указывает в никуда — при случае удалить (там же
`known_hosts`-запись на этот IP).
