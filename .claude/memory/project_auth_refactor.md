---
name: project-auth-refactor
description: Auth flow refactored to Telegram Login Widget — COMPLETED 2026-05-21
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Переход с OTP → Telegram Login Widget (WebView) → браузер + deep link — **завершён**.

**Why:** WebView не мог перехватить `intent://` редиректы на Android, а `oauth.telegram.org` блокирует embedding (X-Frame-Options). Браузер + deeplink обходит оба ограничения.

**Флоу авторизации:**
1. Пользователь нажимает кнопку → `Linking.openURL('https://bot.mihmih.pro/api/v1/auth/telegram-login')`
2. Сервер делает `redirect` → `oauth.telegram.org` (Telegram OAuth)
3. Telegram редиректит на `https://bot.mihmih.pro/api/v1/auth/telegram-callback`
4. Страница callback читает `window.location.hash` и делает `window.location.replace('haba://auth/callback' + fragment)`
5. Android перехватывает deeplink `haba://auth/callback#tgAuthResult=...`
6. `app/(auth)/welcome.tsx` ловит через `Linking.addEventListener('url', ...)` → парсит `tgAuthResult` → `POST /auth/telegram` → JWT сохраняется

**Бэкенд** (`backend/src/api/auth.js`):
- `GET /api/v1/auth/telegram-login` — redirect на `oauth.telegram.org`
- `GET /api/v1/auth/telegram-callback` — HTML, читает fragment и редиректит на `haba://`
- `POST /api/v1/auth/telegram` — HMAC-верификация, upsert user, скачивание аватара, JWT
- `POST /api/v1/auth/refresh` — ротация refresh-токена
- `GET /api/v1/auth/me` — профиль пользователя

**Фронтенд:**
- `app/(auth)/welcome.tsx` — кнопка `Linking.openURL` + `Linking.addEventListener` для deeplink, без WebView/Modal
- `lib/api.ts` — `telegramAuth()`, `getMe()`, тип `UserProfile`
- `lib/auth-context.tsx` — `user: UserProfile | null`, `refreshUser()`, `setAuthed(value, profile?)`
- Deep link scheme `haba://` настроен в `app.json` и `AndroidManifest.xml`

**How to apply:** Флоу авторизации полностью через системный браузер. WebView не используется. Старые эндпоинты send-code/verify-code удалены.
