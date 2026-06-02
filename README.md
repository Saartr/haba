# Haba — трекер привычек

Мобильное приложение (Android) для отслеживания привычек с групповым соревнованием через Telegram.

## Стек

- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4, дизайн-система TapaDS
- Бэкенд: Node.js v22, Express 5, PostgreSQL, PM2 (`bot.mihmih.pro`)
- Telegram Bot: `@Step_Challenges_Bot` (grammy v1)

## UI-компоненты

Переиспользуемые модалки и меню (верстка по Figma TapaDS, единая анимация):

- **`BottomSheet`** — базовая шторка снизу. Заголовок опционален (без него — только контент). Анимация: overlay fade-in + карточка slide (`translateY` 32→0). На ней построены «Пригласить в группу», «Внести шаги», выбор языка (`Select`).
- **`ConfirmModal` + `useConfirm()`** — императивный диалог да/нет поверх `BottomSheet`. `const ok = await confirm({ title, description, confirmLabel, destructive })`. Заменяет `Alert.alert`. `ConfirmProvider` в `app/_layout.tsx`.
- **`DropdownPopover`** — меню по «трём точкам» (правый верхний угол). Анимация overlay fade + меню slide сверху вниз.

> На Android `DropdownMenu` внутри анимируемого контейнера передаётся со `style={{ elevation: 0 }}` — иначе тень рисуется мгновенно и даёт тёмную рамку при появлении.

## Авторизация

Два способа входа: Telegram и VK ID.

### Telegram

Флоу через системный браузер и Android deep link:

1. Приложение открывает `oauth.telegram.org` **напрямую** (без серверного redirect — иначе fragment теряется)
2. Telegram показывает диалог подтверждения → redirect на `/api/v1/auth/telegram-callback#tgAuthResult=...`
3. Страница callback показывает кнопку «Открыть Тапа» + авто-редирект через 500ms → `haba://auth/callback?tgAuthResult=...`
4. `_layout.tsx` перехватывает deeplink → `POST /auth/telegram` (HMAC-верификация) → JWT

**Важно:** `origin` = `https://bot.mihmih.pro` (с протоколом). Домен зарегистрирован в BotFather → `@Step_Challenges_Bot` → Domain.

Сохраняет: `tg_id`, `username`, `first_name`, `last_name`, `avatar_url`. Аватар обновляется при каждом логине через Bot API.

### VK ID

Нативный VK ID SDK 2.6.0 через Expo Module (совместим с New Architecture):

1. `signInWithVK()` → нативный диалог VK One Tap
2. SDK возвращает `AccessToken` с профилем пользователя
3. `POST /auth/vk` → верификация через `secure.checkToken` (сервисный ключ) → JWT

Сохраняет: `vk_id`, `first_name`, `last_name`, `email`, `phone`, `avatar_url`.

> `phone` возвращается VK только для приложений с бизнес-аккаунтом VK ID Console — разблокируется после регистрации в RuStore.

Схема `haba://` настроена в `app.json` и `android/app/src/main/AndroidManifest.xml`.

## Трекер шагов (Health Connect)

Интеграция с Google Health Connect для автоматического импорта шагов.

**Текущий статус:** реализовано, но заблокировано политикой Google.

Health Connect требует верификации приложения через Google Play Console — без этого `requestPermission()` возвращает пустой массив не показав диалог. Debug APK не проходит эту проверку.

**Что работает уже сейчас:**
- Ручной ввод шагов (кнопка «Внести шаги» → «Записать»)
- Автосинк срабатывает тихо в фоне при наличии разрешения

**Для разблокировки HC:**
1. Зарегистрировать [Google Play Developer Account](https://play.google.com/console) ($25 разово)
2. Собрать release AAB: `cd android && ./gradlew bundleRelease`
3. Залить в Play Console → Internal Testing
4. Установить через тестовую ссылку Play Store

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
