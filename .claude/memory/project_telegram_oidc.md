---
name: project-telegram-oidc
description: "Переход Telegram-авторизации на новый OIDC / Native Login (legacy widget сломан — редиректит на MAX)"
metadata:
  type: project
---

## Почему переходим
Legacy Telegram Login Widget (`oauth.telegram.org/auth?bot_id=...` + `tgAuthResult` HMAC) **сломан**: в РФ Telegram редиректит этот флоу на VK ID / MAX («Действие подтверждено, вернитесь в браузер»), `tgAuthResult` не формируется, deeplink не срабатывает, логин не завершается. Это внешнее изменение Telegram, НЕ баг кода. Старый код (HMAC `verifyTelegramAuth`, `auth_date`, base64-декод) корректен по спеке legacy, но сама схема свёрнута.

## Новый путь: BotFather Web Login (OIDC) + Native Login
В BotFather у `@Step_Challenges_Bot` включён **Web Login / OIDC** (настраивается НЕ через кнопочное меню Settings, а в отдельном OIDC-интерфейсе с полями Redirect URIs / Trusted Origins / Native Login).

**Credentials (Web Login):**
- `TELEGRAM_CLIENT_ID` = `8671249381` (совпадает с bot_id — это норма)
- `TELEGRAM_CLIENT_SECRET` — в `.env` сервера (НЕ в гите). ⚠️ Первый секрет был засвечен в чате — при проблемах перевыпустить в BotFather.

**Настроено в BotFather:**
- Redirect URIs: `https://bot.mihmih.pro/api/v1/auth/telegram-oidc-callback` (должен совпадать байт-в-байт с кодом)
- Trusted Origins: `https://bot.mihmih.pro/`
- **Native Login → Android:**
  - Package Name: `pro.mihmih.haba`
  - SHA-256 (debug): `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
  - **App URL (инициация Native Login):** `https://app4160742593-login.tg.dev` — приложение открывает этот URL, Telegram проверяет package+SHA-256 и возвращает результат в приложение через deep link БЕЗ браузера/MAX.

## 🚨 КРИТИЧНО при сборке RELEASE APK
SHA-256 выше — от **debug**-ключа (`android/app/debug.keystore`, storepass/keypass `android`, alias `androiddebugkey`). Он работает ТОЛЬКО для debug-сборок.
**При release-сборке (для друзей / прода / RuStore) у APK будет ДРУГОЙ ключ → ДРУГОЙ SHA-256.** Без добавления release-fingerprint в BotFather Native Login — Telegram-логин в release-сборке НЕ заработает.

**Что сделать при первой release-сборке:**
1. Создать/найти release keystore, вычислить SHA-256:
   `keytool -list -v -keystore <release.keystore> -alias <alias>` → строка `SHA256:`
2. Добавить этот SHA-256 в BotFather → Native Login → Android (можно несколько fingerprint'ов — debug и release одновременно).
3. Аналогично для Google Play App Signing (если публикуешь через Play Store — у Google свой ключ подписи, его SHA-256 берётся из Play Console → App Integrity).

## АРХИТЕКТУРА: нативный Android SDK (как VK ID), НЕ браузерный OIDC
Telegram Native Login = нативная Kotlin-библиотека `org.telegram:login-sdk:1.0.0` (репо `TelegramMessenger/telegram-login-android`). Браузер/MAX в флоу НЕ участвуют. Архитектурно как наш `modules/vk-id/`.

**Флоу:**
1. `TelegramLogin.init(clientId, redirectUri="https://app4160742593-login.tg.dev/tglogin", scopes=["profile","phone"])`
2. `TelegramLogin.startLogin(activity)` → открывает Telegram-приложение (нативно)
3. Пользователь подтверждает в Telegram → App Link `https://app4160742593-login.tg.dev/tglogin` возвращает в приложение
4. `TelegramLogin.handleLoginResponse(uri)` → отдаёт **id_token (JWT, RS256)**
5. Приложение шлёт id_token на бэкенд → бэкенд верифицирует через JWKS → наш JWT

**SDK даёт ТОЛЬКО id_token** — данные юзера (id, name, username, picture, phone) внутри JWT-claims, верифицировать обязательно на сервере.

**AndroidManifest:** нужен intent-filter с `autoVerify=true`, `scheme=https`, `host=app4160742593-login.tg.dev`, `pathPrefix=/tglogin` на login-Activity.

**⚠️ Препятствие — GitHub Packages:** SDK лежит в GitHub Packages Maven, нужен GitHub PAT с `read:packages` в `gradle.properties` для сборки. Усложняет CI/чужие сборки.

## Статус реализации
- ✅ `.env` сервера: `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET` добавлены
- ✅ `backend/package.json`: добавлен `jose` (для JWKS-верификации id_token) — НУЖЕН (на сервере остаётся только верификация)
- ❌ Серверные эндпоинты `/telegram-oidc-start` + `/telegram-oidc-callback` (браузерный PKCE-флоу) — НЕ НУЖНЫ при нативном SDK, откатить начатое в auth.js (oidcStore, putOidc/takeOidc, b64url, TG_OIDC_ISSUER/TG_REDIRECT_URI). Оставить только JWKS-верификацию id_token в новом `POST /auth/telegram-native`.
- ⏳ Нативный модуль `modules/telegram-login/` (Expo Module на Kotlin, как vk-id) — обёртка над SDK
- ⏳ Фронт `welcome.tsx`: кнопка → `signInWithTelegram()`
- ⏳ Бэкенд `POST /auth/telegram-native {id_token}`: верифицировать через `jose` JWKS (`https://oauth.telegram.org/.well-known/jwks.json`, RS256, проверка iss/aud/exp) → claims → upsert → JWT

**Новый OIDC даёт `scope=phone`** → телефон в claims id_token (старая нерешённая задача из [[project-auth-refactor]]).

**How to apply:** Не legacy widget, не браузерный OIDC — нативный SDK. Перед каждой release-сборкой добавлять release SHA-256 в BotFather Native Login.
