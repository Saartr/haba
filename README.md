# Тапа — трекер привычек

Мобильное приложение (Android) для отслеживания привычек — соло и в группе с друзьями, с пушами, календарями прогресса и импортом шагов из Health Connect.

> **Имя приложения:** Тапа. В коде и системных идентификаторах — `haba` / `tapa` (scheme `haba://`, package `pro.mihmih.haba`, SecureStore keys остаются `haba` для обратной совместимости).

## Стек

- **Фронтенд:** React Native + Expo SDK 55, Expo Router, TypeScript, NativeWind v4, дизайн-система TapaDS (Figma — источник правды)
- **Бэкенд** (`backend/` в этом репо): Node.js v22, Express 5, PostgreSQL (`postgres` tag-библиотека), PM2 — сервер `bot.mihmih.pro`
- **Пуши:** FCM HTTP v1 напрямую (без Expo Push Service)
- **Telegram Bot:** `@Step_Challenges_Bot` (grammy v1)
- **Нативные модули** (Expo Modules API, `modules/`): `vk-id` (VK ID SDK 2.7.1), `telegram-login` (Telegram Login SDK), `health-sync` (WorkManager-синк шагов)

## Что умеет

**Типы целей:**
- **Готовые:** Шаги (групповая, автоимпорт из Health Connect), Подтягивания (прогрессивный план тренировок с автопересчётом при пропуске), Отказ от курения
- **Кастомные** (мастер из 3 шагов): да/нет, количество (с единицами измерения), прогрессия до цели; периодичность — каждый день / дни недели / N раз в неделю или месяц / без ограничений; срок — бессрочно / период / до цели
- **Групповые:** инвайт-ссылки (`https://bot.mihmih.pro/join/<код>`), передача прав, исключение участников, статистика по каждому; count-цели могут быть безлимитными (без дневного порога)

**Пуши (5 типов):** напоминание в 19:00, напоминания по кастомному времени цели, вступление в группу, достижение дневной цели, запись в групповой count-цели. Глобальный тоггл + тоггл на цель.

**Авторизация:** Telegram (нативный OIDC) и VK ID (нативный SDK), привязка второго способа со слиянием аккаунтов, аватар подтягивается с любого привязанного провайдера.

## Структура проекта

```
app/                  — экраны (Expo Router): главный, цель, мастера создания, настройки
components/           — дизайн-система (Button, Card, BottomSheet, календари, ...)
components/habit-screens/ — 4 варианта экрана цели (Solo/Progression/Pullups/Group)
lib/                  — API-клиент, цвета, статусы целей, контексты, хуки
modules/              — нативные Expo-модули (vk-id, telegram-login, health-sync)
plugins/              — config-плагины (переживают prebuild --clean)
backend/              — Express-сервер: api/, db/ (миграции), push/, jobs/ (cron)
.claude/memory/       — база знаний проекта (правила, инфра, фичи) — актуальнее README
```

## Запуск dev-сервера

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.143"; npx expo start
# затем 'a' для Android
```

## Сборка APK

Папка `android/` в `.gitignore` — генерируется локально через prebuild. Перед первой сборкой нужны секреты в `%USERPROFILE%\.gradle\gradle.properties`: `gpr.user`/`gpr.key` (GitHub PAT `read:packages` — для Telegram SDK), `VKIDClientSecret`, и для release — `TAPA_STORE_FILE`/`TAPA_STORE_PASSWORD`/`TAPA_KEY_ALIAS`/`TAPA_KEY_PASSWORD`.

```powershell
# Первый раз — генерация нативной папки:
npx expo prebuild --platform android --clean

# Сборка:
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug    # или assembleRelease (fat-APK, подпись tapa-release.jks)
adb install app\build\outputs\apk\debug\app-debug.apk
```

> ⚠️ После каждого `npm install` нужно вручную переналожить патч на `react-native-health-connect`: удалить вызов `coroutineContext.cancel()` в `HealthConnectPermissionDelegate.kt` (patch-package не настроен). Без патча запрос разрешений Health Connect ломается после первого вызова.

### Telegram Native Login и подпись

Telegram проверяет SHA-256 fingerprint подписи приложения. В BotFather (Web Login → Native Login → Android) зарегистрированы **оба** ключа — debug и release (`tapa-release.jks`). Если ключ меняется (например, Google Play App Signing) — добавить его SHA-256 в BotFather, иначе Telegram-логин не заработает.

> 🔴 `oauth.telegram.org` блокируется в РФ — для входа через Telegram нужен VPN **без** split-tunneling (иначе вечный лоадер и невозврат в приложение).

## Деплой бэкенда

```powershell
./deploy-backend.ps1
```

Скрипт: `ssh Haba` → `git pull` → `npm install` → `pm2 restart step-bot`. Все правки бэкенда — только локально в `backend/`, никакой прямой правки на сервере. `.env` и аватары живут только на сервере (`/var/www/haba/backend/`). Миграции БД идемпотентны и применяются при старте сервера.

## Документация

Актуальная база знаний проекта — в [`.claude/memory/`](.claude/memory/MEMORY.md): правила работы (`rules_*`), инфраструктура (`infra_*`), устройство фич (`feature_*`), UI-паттерны (`ui_*`), известные баги (`backlog`).
