---
name: feature-auth
description: Два способа авторизации — Telegram (нативный OIDC-логин) и VK ID (нативный SDK)
metadata:
  type: project
---

## ⛔ Telegram авторизация УДАЛЕНА (2026-08-25) — заменена на Яндекс ID

Вход через Telegram снят целиком: нативный модуль, config-плагины, эндпоинты
`/auth/telegram-native` и `/auth/link/telegram`, кнопки на экранах. Причина — 199-ФЗ
(с 7 июля 2026 авторизация россиян через иностранные сервисы запрещена, штраф до 700 тыс. ₽).
Актуальный провайдер вместо него — [[feature-yandex-id]] (`/auth/yandex`, `/auth/link/yandex`).
Колонка `users.tg_id` и скачивание аватара по ней оставлены для старых аккаунтов.

Ниже — история того, что было до удаления.

## Telegram авторизация — заменена на нативный OIDC-логин (2026-06)

Старый флоу через `oauth.telegram.org` + браузерный deeplink (`Linking.openURL`, `/auth/telegram-callback`, `POST /auth/telegram` с HMAC-верификацией) **удалён в коммите `677dbab`**, т.к. в РФ Telegram стал редиректить этот флоу на VK ID/MAX вместо завершения логина (внешнее изменение Telegram, не баг кода). Маршруты `GET /auth/telegram-callback` и `POST /auth/telegram` физически ещё есть в `backend/src/api/auth.js`, но это мёртвый код, помеченный в коде как неиспользуемый.

Актуальный флоу — нативный модуль + `POST /auth/telegram-native` (JWT id_token, верификация через JWKS). Полное описание — [[feature-telegram-login]].

**Данные в users (актуально):** `tg_id`, `username`, `first_name`, `last_name`, `avatar_url`, `phone` (через scope=phone)

**Аватар:** всегда обновляется при логине через Bot API (`getUserProfilePhotos`).

---

## VK ID авторизация — завершена (2026-05-29)

**Флоу:**
1. Нажимает «Войти через VK» → `VkIdModule.signIn()` (нативный VK ID SDK 2.7.1)
2. SDK показывает системный диалог (One Tap или браузер)
3. SDK возвращает `AccessToken` с `userData` (имя, фото, email, телефон)
4. `POST /auth/vk` → `secure.checkToken` (сервисный ключ, не привязан к IP) → upsert user → JWT

**Why `secure.checkToken`, не `users.get`:** `users.get` с user access token привязан к IP устройства — сервер получает отказ `access_token was given to another ip address`.

**Данные в users:** `vk_id`, `first_name`, `last_name`, `email`, `phone`, `avatar_url`

**Телефон:** VK передаёт через scope `phone`, но реально возвращает только приложениям с бизнес-аккаунтом VK ID Console. Разблокируется после регистрации в RuStore.

**Нативный модуль:**
- `modules/vk-id/android/src/main/java/pro/mihmih/haba/vkid/VkIdModule.kt` — Expo Module (New Arch совместимый)
- `modules/vk-id/android/build.gradle` — зависимость `com.vk.id:vkid:2.7.1` (обновлено с 2.6.0 — версия 2.6.0 упала на `Certificate pinning failure` при обмене кода на токен, т.к. VK перевыпустил сертификат `id.vk.ru` на новый CA (HARICA), а старые версии SDK содержат захардкоженные устаревшие пины; 2.7.1 их обновляет)
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

---

## Имя и аватар: приоритеты и подтягивание (2026-07-09)

**Имя не затирается при повторном логине.** Раньше в `POST /auth/vk` и `POST /auth/telegram-native` upsert делал `COALESCE(EXCLUDED.first_name, users.first_name)` — свежее имя от провайдера побеждало сохранённое, и имя, изменённое вручную через `PATCH /auth/me`, стиралось при следующем входе. Теперь `username`/`first_name`/`last_name` приоритизируют существующее значение в БД (`COALESCE(users.x, EXCLUDED.x)`) — как всегда было в `/auth/link/*`. Провайдер только заполняет пустое.

**Аватар — `ensureAvatar(bot, user, freshPhotoUrl)`** (общая для `/vk`, `/telegram-native`, `/link/telegram`, `/link/vk`): если `avatar_url` пуст, пробует по очереди ОБА привязанных провайдера, не только текущий: Telegram Bot API (`getUserProfilePhotos`, `tg_id` передаётся числом — строкой не работало) → VK `users.get` с сервисным токеном (`photo_max_orig`/`photo_200`/`photo_100` — `photo_200` не отдаётся, если исходник < 200×200; сервисный токен не привязан к IP, в отличие от пользовательского) → «свежий» URL с клиента (photo200/claims.picture). Побочное изменение: Telegram-логин больше НЕ перекачивает аватар при каждом входе — только если его ещё нет.

**`POST /auth/refresh-avatar`** — принудительно перекачивает фото с привязанных провайдеров, игнорируя текущий `avatar_url`. Кнопка «Обновить аватар» в `profile-settings.tsx` (⚠️ после редизайна главного экрана profile-settings недостижим из UI — см. [[feature-main-screen]]).
