---
name: feature-auth
description: Два способа авторизации — Яндекс ID и VK ID (оба нативные SDK); Telegram удалён 2026-08-25
metadata:
  type: project
---

## ⛔ Telegram авторизация УДАЛЕНА (2026-08-25) — заменена на Яндекс ID

Вход через Telegram снят целиком: нативный модуль, config-плагины, эндпоинты
`/auth/telegram-native` и `/auth/link/telegram`, кнопки на экранах. Причина — 199-ФЗ
(с 7 июля 2026 авторизация россиян через иностранные сервисы запрещена, штраф до 700 тыс. ₽).
Актуальный провайдер вместо него — [[feature-yandex-id]] (`/auth/yandex`, `/auth/link/yandex`).
Следом удалены и `users.tg_id`, и сам бот шагов — см. `migrate_drop_legacy.js`.

Ниже — история того, что было до удаления.

## Telegram авторизация — заменена на нативный OIDC-логин (2026-06)

Старый флоу через `oauth.telegram.org` + браузерный deeplink (`Linking.openURL`, `/auth/telegram-callback`, `POST /auth/telegram` с HMAC-верификацией) **удалён в коммите `677dbab`**, т.к. в РФ Telegram стал редиректить этот флоу на VK ID/MAX вместо завершения логина (внешнее изменение Telegram, не баг кода). Маршруты `GET /auth/telegram-callback` и `POST /auth/telegram` физически ещё есть в `backend/src/api/auth.js`, но это мёртвый код, помеченный в коде как неиспользуемый.

Актуальный флоу — нативный модуль + `POST /auth/telegram-native` (JWT id_token, верификация через JWKS). Полное описание — [[feature-telegram-login]].

**Данные в users (на тот момент):** `tg_id`, `username`, `first_name`, `last_name`, `avatar_url`, `phone`. Колонка `tg_id` удалена 2026-08-25.

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

**Телефон:** VK передаёт через scope `phone`, но реально возвращает только приложениям с бизнес-аккаунтом VK ID Console.
Обновление 2026-09-08: бизнес-профиль подтверждён («Business profile verified» на вкладке Access), расширенный доступ
открыт — но тумблеры **Email и Phone там выключены**, то есть по факту ни почта, ни телефон сейчас не запрашиваются.
Запрашивать невключённый scope нельзя: VK такой запрос отклоняет. Нужны — сначала включить тумблеры в консоли.

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

## Модель сессий: одна на пользователя (проверено 2026-09-10)

`POST /auth/vk` и `POST /auth/yandex` перед выдачей токенов делают
`DELETE FROM refresh_tokens WHERE user_id` — то есть **вход с нового устройства выкидывает со
всех остальных**. Сделано намеренно, но если однажды понадобится несколько устройств
одновременно, менять придётся именно это.

`requireAuth` проверяет только подпись и срок access-токена и **не сверяется с таблицей
refresh_tokens**. Украденный access-токен живёт до истечения своих 15 минут даже после выхода.
Обычный компромисс для короткоживущих токенов, но знать про него стоит.

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

**Аватар — `ensureAvatar(user, freshPhotoUrl)`** (общая для `/vk`, `/yandex`, `/link/vk`, `/link/yandex`): если `avatar_url` пуст, пробует по очереди ВСЕ привязанные провайдеры, не только текущий: VK `users.get` с сервисным токеном (`photo_max_orig`/`photo_200`/`photo_100` — `photo_200` не отдаётся, если исходник < 200×200; сервисный токен не привязан к IP, в отличие от пользовательского) → сохранённый `yandex_avatar_id` → «свежий» URL с клиента (photo200 у VK, собранный из `default_avatar_id` у Яндекса). Аватар перекачивается только если его ещё нет; принудительно — через `POST /auth/refresh-avatar`.

**`POST /auth/refresh-avatar`** — принудительно перекачивает фото с привязанных провайдеров, игнорируя текущий `avatar_url`. Кнопка «Обновить аватар» в `profile-settings.tsx`. Экран достижим: `profile.tsx` → пункт меню (`router.push('/(tabs)/profile-settings')`). Прежняя пометка о недостижимости после редизайна устарела — регрессия закрыта, сверено 2026-09-09.

---

## Вход через VK на iOS — работает (2026-09-09)

Нативного VK ID SDK под iOS у нас нет. Вместо него — OAuth 2.1 с PKCE через системную
`ASWebAuthenticationSession` (`expo-web-browser`), код на токен меняет сервер
(`POST /auth/vk/web`). Тот же приём, что у Яндекса ([[infra-ios-plan]]).

**Приложение в консоли — отдельное.** VK ID заводит по приложению на платформу: из одной
формы получились три — Web `54761714`, Android `54761715`, iOS `54761716`. Наш redirect
`https://apptapa.ru/auth/vk/callback` зарегистрирован у **веб-приложения**, поэтому в запрос
авторизации с iOS идёт именно его `client_id` (`VK_WEB_CLIENT_ID` в `lib/config.ts`).

⛔ Старое Android-приложение `54615454` удалять нельзя: его `client_id` зашит в манифест
релиза, который уже в RuStore. Удаление сломает вход через VK у всех установленных версий.
Android-приложение `54761715` и iOS `54761716` пока не используются.

`secure.checkToken` проверяет токен против выдавшего приложения, поэтому `verifyVkToken`
принимает ключи параметром: веб-флоу передаёт `VK_WEB_CREDENTIALS`
(`VK_WEB_CLIENT_SECRET` / `VK_WEB_SERVICE_TOKEN` в `.env`), мобильный — прежние.

**Две вещи, которые стоили времени:**

1. **VK не возвращает `state`.** В редиректе приходят только `code`, `expires_in`, `device_id`
   (проверено по логам nginx). Скорее всего, из-за формата: в нашем state были точки. Формат
   переделан на «префикс + 16 случайных символов + base64url» без разделителей, а сверка state
   в модуле стала условной — иначе вход не завершается. Защиту держит PKCE: код без нашего
   `code_verifier` обменять нельзя.
2. **Параметры обмена — в теле запроса, не в query.** На query VK отвечает `invalid_grant`
   с прямым «pass it in the request body and not in the query».

`device_id` из редиректа обязателен при обмене — без него VK код не примет.

---

## Служебный вход для модераторов магазинов (2026-09-11)

Google Play при публикации требует данные для входа, которые работают всегда, из любой страны
и без SMS-кодов и второго фактора. Тестовый аккаунт VK или Яндекса под это не подходит: вход с
нового устройства из-за рубежа упирается в подтверждение по SMS, а для регистрации нужен
российский номер. App Store на ревью требует того же — демо-аккаунт.

**Как устроено:**
- `POST /auth/review { login, password }` в `backend/src/api/auth.js`. Логин и пароль лежат
  только в `.env` (`REVIEW_LOGIN`, `REVIEW_PASSWORD`; пароль короче 20 символов — вход выключен).
  Без переменных маршрут отвечает 404
- пускает ровно в один аккаунт `users.is_review = true` (частичный уникальный индекс
  `users_review_unique`). Модераторы проверяют удаление аккаунта — если удалили, при следующем
  входе он заводится заново
- обычный вход выкидывает остальные сессии, служебный — нет: модераторов может быть несколько
- счётчика неудачных попыток нет **намеренно**: им любой мог бы закрыть вход модератору посреди
  проверки. От перебора защищает длина случайного пароля
- в приложении — **долгое нажатие (1 с) на иллюстрацию** в `app/(auth)/welcome.tsx` открывает
  шторку «Вход для проверки». Собрана из готовых `BottomSheet` + `Input` + `Button` без макета —
  решение пользователя: обычным пользователям точка входа не видна
- служебный аккаунт упомянут в политике конфиденциальности (п. 2), см. [[feature-legal-pages]]

**How to apply:**
- Пароль в переписку не выводить. Пользователь смотрит его сам:
  `ssh Tapa "grep ^REVIEW_ /var/www/haba/backend/.env"`. Сменили — `pm2 restart step-bot` и
  обновить данные в Play Console
- Инструкция для Play Console (App content → App access), по-английски: long-press the
  illustration on the welcome screen for 1 second, enter the username and password, tap «Войти»
- Выключить вход — убрать переменные из `.env` и перезапустить процесс
