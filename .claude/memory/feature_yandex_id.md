---
name: feature-yandex-id
description: "✅ Реализовано: вход через Яндекс ID вместо Telegram (нативный SDK + /auth/yandex)"
metadata:
  type: project
---

## Зачем

Заменил вход через Telegram (2026-08-25). Причина не техническая: с 7 июля 2026 действует
199-ФЗ (ст. 13.55 КоАП) — авторизацию россиян нельзя проводить через иностранные сервисы,
штраф для юрлиц 500–700 тыс. ₽. Разрешены: телефон, ЕСИА, ЕБС, российская ИС. VK ID и
Яндекс ID в список попадают, Telegram — нет. Подробности удалённого флоу — [[feature-telegram-login]].

## Регистрация приложения

oauth.yandex.ru, платформа Android, package `pro.mihmih.haba`, права `login:info`,
`login:email`, `login:avatar`.

- **client_id:** `1e466a3264584e3aaf95945ce4a25449` (публичный, лежит в git)
- **Секрет приложения НЕ нужен** — нативный SDK отдаёт готовый OAuth-токен, обмена
  code→token на сервере нет.
- SHA-256 debug: `FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C`
- SHA-256 release: `5E:3A:2C:58:EA:0F:49:33:60:25:A8:B7:96:D9:97:F5:7A:95:34:C3:CA:E6:9D:87:6A:87:6E:2F:52:D2:16:AA`

## Нативный модуль `modules/yandex-id/`

Зависимость `com.yandex.android:authsdk:3.1.3` — **в mavenCentral**, отдельный maven-репозиторий
не нужен (в отличие от VK, которому нужны зеркала vkpartner.ru). Поэтому в
`with-native-maven-repos.js` для Яндекса ничего не добавлялось.

**Отличие от VK ID:** SDK работает через `ActivityResultContract`, а не колбэк. Поэтому
модуль хранит `pendingPromise` между `startActivityForResult` и `OnActivityResult`, а
повторный `signIn()` во время незавершённого входа отклоняется с `IN_PROGRESS` — иначе
первый промис затёрся бы и завис навсегда.

Отмена входа приходит как `YandexAuthResult.Cancelled` → промис реджектится с кодом
`YANDEX_AUTH_CANCELLED`; на экранах это не показывается как ошибка.

**client_id** SDK читает из manifestPlaceholders → `plugins/with-yandex-manifest-placeholders.js`
(`android/` стирается `prebuild --clean`, поэтому только через config-плагин). Плагин
намеренно падает на prebuild, если client_id пуст: иначе манифест смерджится и вход
сломается уже в рантайме с невнятной ошибкой.

## Бэкенд

`POST /auth/yandex` и `POST /auth/link/yandex` принимают `{ accessToken }`.

Верификация — `GET https://login.yandex.ru/info?format=json` с заголовком
`Authorization: OAuth <token>`. Токен **не привязан к IP** (в отличие от VK, где из-за этого
пришлось звать `secure.checkToken` с сервисным ключом вместо `users.get`).

🔴 **Обязательно сверять `client_id` из ответа со своим** (`YANDEX_CLIENT_ID` в `.env`).
Без этой проверки токен, выданный любому другому приложению Яндекса, можно предъявить
нашему серверу и войти под чужим аккаунтом.

## БД

`migrate_yandex.js`: `yandex_id TEXT` + partial unique index (как у vk_id) и
`yandex_avatar_id TEXT`.

**Зачем второе поле:** URL аватара собирается как
`https://avatars.yandex.net/get-yapic/{default_avatar_id}/islands-200`, а сам
`default_avatar_id` приходит только вместе с живым OAuth-токеном. Без сохранения
`POST /auth/refresh-avatar` не смог бы перекачать фото Яндекс-аккаунту — у VK для этого есть
сервисный токен, у Яндекса аналога нет. `is_avatar_empty=true` — заглушка, не качаем.

## Выбор аккаунта (проверено на устройстве)

`YandexAuthLoginOptions(loginType = LoginType.NATIVE)` — **своего списка аккаунтов SDK не
показывает**. Он передаёт вход установленному приложению Яндекса (Браузер / Старт / Алиса),
и логин проходит под тем аккаунтом, который там активен. Чтобы войти под другим — переключить
аккаунт в самом приложении Яндекса, в нашем UI переключателя нет.

Альтернативы, если понадобится явный выбор: `LoginType.CHROME_TAB` или `WEBVIEW` — они
открывают страницу Яндекса со списком аккаунтов и кнопкой «Добавить», но теряют вход в одно
касание. Смена режима = правка Kotlin + пересборка APK.

## Хвосты

- Иконка `assets/icons/Yandex.svg` нарисована вручную (глиф «Я»), в TapaDS её нет.
  Брендбук Яндекса требует официальный знак — заменить до релиза.
- `users.tg_id`, таблицы бота и сам бот удалены следом (см. `migrate_drop_legacy.js`),
  поэтому в `ensureAvatar` больше нет ветки Telegram — остались VK и Яндекс.
