---
name: project-auth-refactor
description: Два способа авторизации — Telegram (браузер + deeplink) и VK ID (нативный SDK)
metadata:
  type: project
---

## Telegram авторизация — завершена

**Флоу:**
1. `Linking.openURL('https://oauth.telegram.org/auth?bot_id=...&origin=https://bot.mihmih.pro&return_to=.../telegram-callback&request_access=write')`
   — открываем oauth.telegram.org **напрямую**, без серверного redirect (иначе fragment теряется)
2. Telegram показывает диалог подтверждения → redirect на `/api/v1/auth/telegram-callback#tgAuthResult=...`
3. HTML-страница читает `window.location.hash`, показывает кнопку «Открыть Тапа» + авто-редирект 500ms
4. Нажатие кнопки → `haba://auth/callback?tgAuthResult=...`
5. `_layout.tsx` ловит deeplink → `POST /auth/telegram` (HMAC-верификация) → JWT

**Важно:** `origin` должен быть `https://bot.mihmih.pro` (с протоколом) — без `https://` Telegram возвращает `tgAuthResult=false`.

**Важно:** Серверный redirect через `/telegram-login` терял fragment — Telegram добавляет `#tgAuthResult` только к финальному URL в браузере.

**Бэкенд:** `GET /auth/telegram-callback` (HTML с кнопкой), `POST /auth/telegram` (HMAC-верификация)

**Данные в users:** `tg_id`, `username`, `first_name`, `last_name`, `avatar_url`

**Аватар:** всегда обновляется при логине через Bot API (`getUserProfilePhotos`), `photo_url` из виджета временный.

**Телефон из Telegram:** недоступен через OAuth. Единственный вариант — бот с кнопкой `request_contact`.

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
