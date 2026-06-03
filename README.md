# Тапа — трекер привычек

Мобильное приложение (Android) для отслеживания привычек с групповым соревнованием через Telegram.

> **Имя приложения:** Тапа. В коде и системных идентификаторах — `haba` / `tapa` (scheme, package, SecureStore keys остаются `haba` для обратной совместимости).

## Стек

- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4, дизайн-система TapaDS
- Бэкенд: Node.js v22, Express 5, PostgreSQL, PM2 (`bot.mihmih.pro`)
- Telegram Bot: `@Step_Challenges_Bot` (grammy v1)

## Архитектурная проверка (2026-06-03)

Полная проверка целостности фронтенд↔бэкенд контракта. Найдено и исправлено:

### Критические фиксы
| Проблема | Файл | Исправление |
|---|---|---|
| `PATCH /auth/me` не возвращал `tg_id`/`vk_id` | `backend/src/api/auth.js` | Добавлены в RETURNING и ответ |
| `DELETE /habits/:id` = hard DELETE (уничтожал данные) | `backend/src/api/habits.js` | Soft-close: `SET closed_at = now()` |
| `AVATARS_DIR` = `/var/www/step-bot/...` (legacy path) | `auth.js`, `index.js` | Исправлен на `/var/www/haba/backend/public/avatars` |

### Предупреждения
| Проблема | Файл | Исправление |
|---|---|---|
| `POST /habits`, `POST /habits/join` не возвращали `is_creator` | `habits.js` | Добавлен `{ ...habit, is_creator }` |
| `verifyVkToken` URL через string interpolation | `auth.js` | `URLSearchParams` для безопасного кодирования |
| `updateProfile` тип: `first_name?` вместо `first_name` | `lib/api.ts` | Сделан обязательным |
| `HabitLog` тип без `id`, `habit_id`, `source` | `lib/api.ts` | Поля добавлены |

### Переименование Haba → Тапа
- `app.json`: `name` → `"Tapa"`, `slug` → `"tapa"`
- `package.json`: `name` → `"tapa"`
- Юридические тексты: «приложения Haba» → «приложения Тапа»
- Scheme `haba://`, package `pro.mihmih.haba`, SecureStore keys — **не меняются** (системные идентификаторы)

## UI-компоненты

Переиспользуемые модалки и меню (верстка по Figma TapaDS, единая анимация):

- **`BottomSheet`** — базовая шторка снизу. Заголовок опционален (без него — только контент). Анимация: overlay fade-in + карточка slide (`translateY` 32→0). На ней построены «Пригласить в группу», «Внести шаги», выбор языка (`Select`).
- **`ConfirmModal` + `useConfirm()`** — императивный диалог да/нет поверх `BottomSheet`. `const ok = await confirm({ title, description, confirmLabel, destructive })`. Заменяет `Alert.alert`. `ConfirmProvider` в `app/_layout.tsx`.
- **`DropdownPopover`** — меню по «трём точкам» (правый верхний угол). Анимация overlay fade + меню slide сверху вниз.

> На Android `DropdownMenu` внутри анимируемого контейнера передаётся со `style={{ elevation: 0 }}` — иначе тень рисуется мгновенно и даёт тёмную рамку при появлении.

## Авторизация

Два способа входа: Telegram и VK ID.

### Telegram

Нативный Telegram Login SDK (OIDC):

1. `TelegramLoginModule.signIn()` → нативный SDK открывает Telegram для подтверждения
2. SDK возвращает `id_token` (OIDC JWT, RS256, подпись верифицируется через JWKS)
3. `POST /auth/telegram-native` → верификация JWT → upsert user → JWT

**Важно:** Release-сборка требует SHA-256 fingerprint ключа подписи в BotFather → Native Login → Android.

Сохраняет: `tg_id`, `username`, `first_name`, `last_name`, `phone` (при scope=phone), `avatar_url`. Аватар обновляется при каждом логине через Bot API.

### VK ID

Нативный VK ID SDK 2.6.0 через Expo Module (совместим с New Architecture):

1. `signInWithVK()` → нативный диалог VK One Tap
2. SDK возвращает `AccessToken` с профилем пользователя
3. `POST /auth/vk` → верификация через `secure.checkToken` (сервисный ключ) → JWT

Сохраняет: `vk_id`, `first_name`, `last_name`, `email`, `phone`, `avatar_url`.

> `phone` возвращается VK только для приложений с бизнес-аккаунтом VK ID Console — разблокируется после регистрации в RuStore.

Схема `haba://` настроена в `app.json` (нативная папка `android/` генерируется через `prebuild`).

## Трекер шагов (Health Connect)

Интеграция с Google Health Connect для автоматического импорта шагов.

**Текущий статус:** ✅ работает на debug APK.

**Что реализовано:**
- Ручной ввод шагов (кнопка «Внести шаги» → «Записать»)
- Автосинк шагов в фоне при наличии разрешения (через `useFocusEffect` в экране привычки)
- Кнопка «Подключить трекер» в модалке «Внести шаги»

**Важно — Android 14+:** Health Connect требует `<activity-alias>` с `android.intent.action.VIEW_PERMISSION_USAGE` в манифесте. Без него `requestPermission()` молча возвращает `[]` без показа диалога. Alias добавляется через `plugins/with-health-permissions.js` (функция `ensureRationaleAlias`) — попадает в манифест автоматически при `prebuild`.

**Ручной патч после `npm install`:** в `node_modules/react-native-health-connect/.../HealthConnectPermissionDelegate.kt` нужно удалить вызов `coroutineContext.cancel()` — иначе запрос разрешений сломается после первого вызова. patch-package не настроен, патч теряется при переустановке зависимостей.

**Для публикации в Google Play** (не для разработки) потребуется Google Play Developer Account ($25 разово).

## Сборка APK (debug)

Папка `android/` в `.gitignore` — генерируется локально через prebuild.

```powershell
# Первый раз — генерация нативной папки:
npx expo prebuild --platform android --clean

# Сборка и установка:
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

> ⚠️ После каждого `npm install` нужно вручную переналожить патч на `react-native-health-connect` (удаление `coroutineContext.cancel()` в `HealthConnectPermissionDelegate.kt`) — patch-package не настроен. Без патча запрос разрешений HC ломается после первого вызова.

### 🚨 Release-сборка и Telegram Native Login

Telegram Native Login проверяет подпись приложения по **SHA-256 fingerprint** ключа. В BotFather (Native Login → Android) зарегистрирован **debug**-ключ:
```
FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
```
Он работает **только для debug-сборок**. При сборке **release** APK/AAB:

1. У release-ключа **другой** SHA-256 → вычислить:
   ```powershell
   keytool -list -v -keystore <release.keystore> -alias <alias>   # строка SHA256:
   ```
2. Добавить этот SHA-256 в **BotFather → Web Login → Native Login → Android** (можно несколько fingerprint'ов одновременно — debug + release).
3. Если публикуешь через **Google Play** — у Google свой ключ подписи (App Signing). Его SHA-256 взять в **Play Console → App Integrity → App signing key** и тоже добавить в BotFather.

Без этого Telegram-логин в release-сборке **не заработает** (Telegram отклонит native-callback). Подробнее: `.claude/memory/project_telegram_oidc.md`.

## Запуск dev-сервера

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.143"; npx expo start
# затем 'a' для Android
```

## Деплой бэкенда

```powershell
./deploy-backend.ps1
```

Бэкенд живёт в `backend/` в этом репо. Все правки — локально, затем деплой через скрипт. Никакой прямой правки на сервере.
