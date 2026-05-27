# Haba — трекер привычек

Мобильное приложение (Android) для отслеживания привычек с групповым соревнованием через Telegram.

## Стек

- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4, дизайн-система TapaDS
- Бэкенд: Node.js v22, Express 5, PostgreSQL, PM2 (`bot.mihmih.pro`)
- Telegram Bot: `@Step_Challenges_Bot` (grammy v1)

## Авторизация

Флоу через системный браузер и Android deep link:

1. Пользователь нажимает кнопку — приложение открывает `https://bot.mihmih.pro/api/v1/auth/telegram-login` через `Linking.openURL`
2. Сервер делает redirect на `oauth.telegram.org`
3. Пользователь подтверждает вход в Telegram
4. Telegram редиректит на `/api/v1/auth/telegram-callback` — страница читает `tgAuthResult` из фрагмента URL и редиректит на `haba://auth/callback#tgAuthResult=...`
5. Приложение перехватывает deeplink через `Linking.addEventListener`, парсит данные и вызывает `POST /api/v1/auth/telegram`
6. Сервер проверяет HMAC-подпись, создаёт/обновляет пользователя, возвращает JWT

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
