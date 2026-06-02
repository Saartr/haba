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

## Статус реализации — ✅ РАБОТАЕТ (2026-06-02)
- ✅ `.env` сервера: `TELEGRAM_CLIENT_ID`, `TELEGRAM_CLIENT_SECRET`
- ✅ `backend`: `jose` + `POST /auth/telegram-native` (JWKS RS256, iss/aud) → claims → upsert → JWT
- ✅ Нативный модуль `modules/telegram-login/` (Kotlin Expo Module: init/startLogin/OnNewIntent → handleLoginResponse → id_token)
- ✅ Фронт `welcome.tsx`: `signInWithTelegram()` → `telegramNativeAuth(idToken)`
- ✅ **Телефон приходит** — `scope=phone` → `claims.phone_number` пишется в `users.phone`. Подтверждено в БД (юзер `saartr` = 79818223244). Старый виджет телефон не умел вообще.
- ✅ Legacy-флоу удалён: фронт (`_layout.tsx` tgAuthResult/decodeBase64Json/AppState, `telegramAuth` в `lib/api`). Бэкенд `/auth/telegram` (HMAC) + `/auth/telegram-callback` (HTML) пока висят, но не используются.

## ⚠️ SDK на деле БРАУЗЕРНЫЙ OIDC, не чисто нативный
Декомпиляция `login-sdk-1.0.0.aar`: `BASE_URL = https://oauth.telegram.org`. `startLogin` → `fetchInAppUrl` (пробует `tg://` для нативного открытия Telegram) → при неудаче `openWebAuth` (Chrome **Custom Tab** на `oauth.telegram.org/auth?response_type=code&...&code_challenge=...S256`) → возврат на App Link `…/tglogin?code=` → `handleLoginResponse`→`exchangeCode` (PKCE, `/token`) → id_token. **Всё завязано на доступность `oauth.telegram.org`.**

## 🔴 ГЛАВНАЯ ЗАСАДА: `oauth.telegram.org` должен идти через VPN
Симптом «вечный лоадер на кнопке + браузер открывается + возврат по кнопке не работает» = `oauth.telegram.org` недоступен с устройства → `fetchInAppUrl` висит → фоллбэк в браузер → возврат из Custom Tab по App Link не выходит из браузера (Chrome остаётся на странице с кнопкой).
**Причина у нас была: Amnezia в режиме РАЗДЕЛЬНОГО ТУННЕЛИРОВАНИЯ** гнал `oauth.telegram.org` напрямую (мимо VPN) → блок в РФ. **Фикс: выключить split-tunnel / убедиться что домен идёт через VPN.** Тестерам в РФ — то же требование.
Когда домен доступен — открывается нативно Telegram-приложение, логин мгновенный, возврат app→app работает.

## Диагностика на этом устройстве
- App Link верифицирован: `adb shell pm get-app-links pro.mihmih.haba` → `app4160742593-login.tg.dev: verified` (SHA-256 совпал). Манифест чистый.
- ⚠️ **OPPO/ColorOS глушит логи сторонних приложений в logcat** — ни JS (`console.log`), ни нативные `Log.d` не видны через `adb logcat`. Дебажить через Metro-терминал, не logcat.

**How to apply:** Перед release-сборкой добавлять release SHA-256 в BotFather Native Login. При жалобах «не возвращается в приложение» — первым делом проверять, что `oauth.telegram.org` доступен с телефона (VPN без split-tunnel). См. также [[project-android-config-plugins]] (репо/placeholders переживают `prebuild --clean`).
