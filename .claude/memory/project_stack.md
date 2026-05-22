---
name: project-stack
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

**Бэкенд** (`/var/www/step-bot` на `bot.mihmih.pro`, Ubuntu 24.04.4 LTS):
- Node.js v22, Express 5
- grammy v1 (Telegram Bot API) — бот `@Step_Challenges_Bot`
- PostgreSQL (библиотека `postgres` tag, не pg/knex)
- PM2 (процесс-менеджер, имя процесса `step-bot`)
- node-cron (дайджесты в 19:00, 20:00, 21:00 МСК)

**BASE_URL API:** `https://bot.mihmih.pro/api/v1`

**Env-переменные сервера:** `TELEGRAM_TOKEN`, `WEBHOOK_SECRET`, `PORT` (3000), `WEBHOOK_URL`, `DATABASE_URL`, `JWT_SECRET`

**JWT:** accessToken TTL 15 мин, refreshToken TTL 30 дней (ротируется при использовании)

**How to apply:** При написании кода — Expo SDK 55, читать доки на https://docs.expo.dev/versions/v55.0.0/. Бэкенд — Express 5, `postgres` tag-библиотека.
