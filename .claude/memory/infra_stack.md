---
name: infra-stack
description: "Стек проекта Тапа — фронтенд, бэкенд, инфраструктура"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием через Telegram.

**Фронтенд** (`C:\haba`):
- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)
- react-native-svg (SVG-иконки)
- react-native-webview (Telegram Login Widget)
- Дизайн-система: TapaDS, цвета через `useColors()` из `lib/colors.ts`
- Шрифт: Manrope (medium/semibold/bold), обёртка `components/Text.tsx`

**Бэкенд** (`/var/www/haba/backend` на `bot.mihmih.pro`, Ubuntu 24.04.4 LTS, в репо в папке `backend/`):
- Node.js v22, Express 5
- PostgreSQL (библиотека `postgres` tag, не pg/knex)
- PM2 (процесс-менеджер, имя процесса `step-bot`)
- node-cron (пуш-напоминания по целям; дайджесты бота удалены 2026-08-25)

**BASE_URL API:** `https://bot.mihmih.pro/api/v1`

**Env-переменные сервера:** `PORT` (3000), `DATABASE_URL`, `JWT_SECRET`, `VK_CLIENT_SECRET`, `VK_SERVICE_TOKEN`, `YANDEX_CLIENT_ID`. Мертвы после удаления бота (2026-08-25), можно убрать: `TELEGRAM_TOKEN`, `WEBHOOK_SECRET`, `WEBHOOK_URL`, `TELEGRAM_CLIENT_ID`, `GOOGLE_CLIENT_ID/SECRET`

**JWT:** accessToken TTL 15 мин, refreshToken TTL 30 дней (ротируется при использовании)

**Деплой бэкенда:** ручной скрипт `deploy-backend.ps1` в корне репо. Подробности — [[rules-backend-deploy]].

**How to apply:** При написании кода — Expo SDK 55, читать доки на https://docs.expo.dev/versions/v55.0.0/. Бэкенд — Express 5, `postgres` tag-библиотека. Серверные правки коммитить в `backend/`, деплоить через `./deploy-backend.ps1` после пуша в `main`.
