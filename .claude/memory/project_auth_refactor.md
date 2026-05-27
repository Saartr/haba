---
name: project-auth-refactor
description: Auth flow refactored to Telegram Login Widget — COMPLETED 2026-05-21
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Переход с OTP (send-code / verify-code) на Telegram Login Widget — **завершён**.

**Why:** OTP требовал, чтобы пользователь сначала написал боту /start и имел username. Виджет авторизует через официальный Telegram OAuth — проще и надёжнее.

**Что сделано:**

Бэкенд (`backend/src/api/auth.js` в репо, `/var/www/haba/backend/src/api/auth.js` на сервере):
- `GET /api/v1/auth/telegram-login` — HTML с кнопкой → `oauth.telegram.org`
- `GET /api/v1/auth/telegram-callback` — пустая HTML-страница для получения tgAuthResult
- `POST /api/v1/auth/telegram` — HMAC-верификация, upsert user, скачивание аватара (с redirect-following), JWT
- `POST /api/v1/auth/refresh` — ротация refresh-токена (DELETE старого перед INSERT)
- `GET /api/v1/auth/me` — профиль пользователя
- Nginx: `location /avatars/` с `alias /var/www/haba/backend/public/avatars/` для статической отдачи аватаров

Фронтенд:
- `app/(auth)/welcome.tsx` — Modal + WebView с Telegram Login Widget
- `tg://` deeplinks перехватываются → `Linking.openURL()` открывает приложение Telegram
- После входа: `tgAuthResult` из URL fragment → `POST /auth/telegram` → JWT сохраняется
- `lib/api.ts` — добавлены `telegramAuth()`, `getMe()`, тип `UserProfile`
- `lib/auth-context.tsx` — расширен: `user: UserProfile | null`, `refreshUser()`, `setAuthed(value, profile?)`
- Экраны `enter-username.tsx` и `verify-code.tsx` удалены

**How to apply:** Старые эндпоинты send-code/verify-code мертвы, их можно удалить из кода сервера. Флоу авторизации полностью через виджет.
