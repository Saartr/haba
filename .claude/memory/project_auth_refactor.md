---
name: project-auth-refactor
description: Два способа авторизации — Telegram (нативный OIDC-логин) и VK ID (нативный SDK)
metadata:
  type: project
---

## Telegram авторизация — заменена на нативный OIDC-логин (2026-06)

Старый флоу через `oauth.telegram.org` + браузерный deeplink (`Linking.openURL`, `/auth/telegram-callback`, `POST /auth/telegram` с HMAC-верификацией) **удалён в коммите `677dbab`**, т.к. в РФ Telegram стал редиректить этот флоу на VK ID/MAX вместо завершения логина (внешнее изменение Telegram, не баг кода). Маршруты `GET /auth/telegram-callback` и `POST /auth/telegram` физически ещё есть в `backend/src/api/auth.js`, но это мёртвый код, помеченный в коде как неиспользуемый.

Актуальный флоу — нативный модуль + `POST /auth/telegram-native` (JWT id_token, верификация через JWKS). Полное описание — [[project-telegram-oidc]].

**Данные в users (актуально):** `tg_id`, `username`, `first_name`, `last_name`, `avatar_url`, `phone` (через scope=phone)

**Аватар:** всегда обновляется при логине через Bot API (`getUserProfilePhotos`).

---

## VK ID авторизация — завершена (2026-05-29)

**Флоу:**
1. Нажимает «Войти через VK» → `VkIdModule.signIn()` (нативный VK ID SDK 2.6.0)
2. SDK показывает системный диалог (One Tap или браузер)
3. SDK возвращает `AccessToken` с `userData` (имя, фото, email, телефон)
4. `POST /auth/vk` → `secure.checkToken` (сервисный ключ, не привязан к IP) → upsert user → JWT

**Why `secure.checkToken`, не `users.get`:** `users.get` с user access token привязан к IP устройства — сервер получает отказ `access_token was given to another ip address`.

**Данные в users:** `vk_id`, `first_name`, `last_name`, `email`, `phone`, `avatar_url`

**Телефон:** VK передаёт через scope `phone`, но реально возвращает только приложениям с бизнес-аккаунтом VK ID Console. Разблокируется после регистрации в RuStore.

**Нативный модуль:**
- `modules/vk-id/android/src/main/java/pro/mihmih/haba/vkid/VkIdModule.kt` — Expo Module (New Arch совместимый)
- `modules/vk-id/android/build.gradle` — зависимость `com.vk.id:vkid:2.6.0`
- `modules/vk-id/expo-module.config.json` — автолинкинг через `nativeModulesDir`
- `modules/vk-id/index.ts` — JS-обёртка `signInWithVK()`
- Manifest placeholders: `VKIDClientID=54615454`, `VKIDClientSecret`, `VKIDRedirectHost=vk.com`, `VKIDRedirectScheme=vk54615454`

**VK ID Console:** app ID `54615454`, Android, SHA-1 debug keystore зарегистрирован.

**Env на сервере:** `VK_CLIENT_SECRET`, `VK_SERVICE_TOKEN` добавлены в `.env`.

**Why New Arch совместимый модуль:** `newArchEnabled=true` в `gradle.properties` — старый `ReactContextBaseJavaModule` + `PackageList` не работает в Bridgeless режиме. Нужен Expo Module с `expo-module.config.json`.

**How to apply:** При добавлении новых нативных модулей — использовать Expo Modules API (`Module` класс), размещать в `modules/<name>/android/`, создавать `expo-module.config.json`.

---

## Фикс гонки в `POST /auth/refresh` — duplicate key в refresh_tokens (2026-06-21)

В логах (`pm2 logs step-bot --err`) регулярно встречалась `PostgresError: duplicate key value violates unique constraint "refresh_tokens_token_key"` (код `23505`) у разных пользователей.

**Причина:** `makeRefreshToken` подписывала JWT только из `{ sub: userId, type: 'refresh' }` + `iat`/`exp` (точность секунда) — без nonce. `/auth/refresh` делал `SELECT` → `DELETE` → генерация нового токена → `INSERT` как раздельные шаги. При двух почти одновременных рефрешах одним и тем же refreshToken (несколько экранов поймали 401 одновременно, либо фоновый health-sync воркер рефрешит независимо от приложения) оба запроса проходили `SELECT` раньше, чем кто-либо сделал `DELETE` — и если оба генерировали новый токен в одну секунду, payload совпадал целиком → identical JWT-строка → второй `INSERT` падал на UNIQUE.

**Фикс** (`backend/src/api/auth.js`):
- `SELECT`+`DELETE` объединены в одну атомарную операцию `DELETE ... RETURNING` — при гонке только один из параллельных запросов реально получает строку.
- В payload refresh-токена добавлен случайный `jti: crypto.randomUUID()` — исключает совпадение строк даже при честном одновременном рефреше с разных устройств.

**How to apply:** Если в логах снова появится `refresh_tokens_token_key` — проверить, не регрессировал ли клиент к раздельным SELECT/DELETE, и не добавился ли где-то ещё путь генерации refresh-токена без `jti`.
