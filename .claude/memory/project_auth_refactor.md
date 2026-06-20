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
