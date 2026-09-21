---
name: rules-naming
description: Приложение называется «Тапа» в UI; Android-пакет с 2026-09-21 — ru.apptapa.app (его закрепила Google Play Console); scheme, SecureStore keys и пространства имён модулей остаются haba
metadata:
  type: project
---

Приложение называется **Тапа** (`tapa` для латиницы в коде/конфигах). Переименовано в `app.json` (`name: "Tapa"`, `slug: "tapa"`), `package.json` (`name: "tapa"`), юридических текстах (`legal/[type].tsx`).

## Android-пакет сменён: `pro.mihmih.haba` → `ru.apptapa.app` (2026-09-21)

**Why:** Google Play Console при создании приложения сама предложила имя пакета из домена
сайта (`apptapa.ru` → `ru.apptapa.app`), его приняли, и в рамках проверки разработчиков Android
(developer verification) имя закрепилось за приложением (Play Console ведёт Петр — [[team]]).
Имя пакета в Play постоянное — сменить, удалить или использовать повторно нельзя. Решение
Михаила — оставить `ru.apptapa.app` и перевести на него всё Android-приложение, а не заводить в
Play новое приложение под старым пакетом.

Для Android это **другое приложение**: сборки `pro.mihmih.haba` (RuStore — versionCode 2, сайт —
до 4) новым пакетом не обновляются, только переустановка (данные на сервере, нужен повторный
вход). Регистрации старого пакета в консолях Яндекса, VK и Firebase **не удалять**, пока у
людей стоит старая версия. Что ещё нужно сделать по консолям — [[infra-google-play]].

`ios.bundleIdentifier` пока остаётся `pro.mihmih.haba` — решение за Михаилом.

**НЕ переименовано (смена сломает deeplinks и сессии, пользы нет):**
- `app.json` `scheme`: `"haba"` (deeplink `haba://join/...`, `haba://auth/callback`)
- `lib/auth.ts` SecureStore keys: `haba_access_token`, `haba_refresh_token`, `haba_pending_invite`
- пространства имён нативных модулей: `pro.mihmih.haba.vkid`, `.yandexid`, `.healthsync` — это
  имена библиотек, от пакета приложения они не зависят
- Backend deeplinks: `haba://join/...`

**How to apply:** новые UI-строки — «Тапа». Пакет приложения в коде не зашивать — брать из
`app.json` (`cfg.android.package` в config-плагинах, как в `with-vk-manifest-placeholders.js` и
`with-yandex-manifest-placeholders.js`: там он был зашит строкой, и смена пакета роняла prebuild).
Scheme, SecureStore keys и пространства имён модулей не переименовывать.
