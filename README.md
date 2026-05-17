# Хаба — социальный трекер привычек

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием через Telegram.

---

## Стек

**Фронтенд**
- React Native + Expo SDK 55 (Expo Router, TypeScript)
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)

**Бэкенд** — сервер `bot.mihmih.pro`, путь `/var/www/step-bot`
- Node.js v22, Express 5
- grammy v1 (Telegram Bot API)
- PostgreSQL (библиотека `postgres`)
- PM2 (процесс-менеджер)
- node-cron (расписание дайджестов)

---

## Окружение разработки

| Параметр | Значение |
|----------|---------- |
| ОС | Windows 11 |
| Телефон (Android) | CPH2745, IP `192.168.1.139` |
| IP компьютера | `192.168.1.143` |
| VPN | Amnezia — телефон добавлен в split-tunnel, трафик к нему идёт напрямую |

**Запуск dev-сервера:**
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.143"; npx expo start
# затем нажать 'a' для открытия на Android
```

---

## Структура фронтенда (`C:\haba`)

```
app/
├── _layout.tsx              # Root layout. Проверяет JWT при старте,
│                            # редиректит: есть токен → (tabs), нет → (auth)/welcome
├── +not-found.tsx
├── (auth)/                  # Флоу авторизации (не требует токена)
│   ├── _layout.tsx          # Stack-навигатор без хедера
│   ├── welcome.tsx          # Сплэш-экран с кнопкой «Войти через Telegram»
│   ├── enter-username.tsx   # Ввод @username → POST /api/v1/auth/send-code
│   ├── verify-code.tsx      # Ввод 6-значного кода → POST /api/v1/auth/verify-code
│   │                        # Состояния: ввод, неверный код, повторная отправка
│   └── success.tsx          # Экран успешной авторизации (временный)
└── (tabs)/                  # Основное приложение (требует токена)
    ├── _layout.tsx          # Tab-навигатор: Привычки / Профиль
    ├── index.tsx            # Главный экран привычек (заглушка)
    └── two.tsx              # Профиль (заглушка)

lib/
├── api.ts                   # Fetch-клиент. BASE_URL = https://bot.mihmih.pro/api/v1
│                            # Автоматический refresh токена при 401.
│                            # Экспортирует: sendCode(username), verifyCode(username, code)
└── auth.ts                  # Работа с токенами через expo-secure-store.
                             # Экспортирует: saveTokens, getTokens, clearTokens, isAuthenticated

components/
├── useColorScheme.ts        # Хук для определения light/dark темы
└── useColorScheme.web.ts    # Web-версия хука

assets/images/               # Иконки приложения (icon, splash, android adaptive)
global.css                   # @tailwind base/components/utilities
tailwind.config.js           # Контент: app/**/*.tsx, components/**/*.tsx
                             # Кастомные цвета: primary #00C9A7, error #FF4D4F
babel.config.js              # babel-preset-expo + nativewind/babel
metro.config.js              # withNativeWind(config, { input: './global.css' })
```

---

## Бэкенд (`/var/www/step-bot` на сервере)

```
src/
├── index.js                 # Точка входа. Express + grammy + роутинг.
│                            # Middleware: req.bot = bot (доступ к боту из роутеров)
│                            # Маунтит: /api/v1/auth → authRouter
│                            # Старые маршруты: /webhook, /miniapp/*, /health
│
├── api/
│   └── auth.js              # REST API авторизации (JWT)
│                            # POST /api/v1/auth/send-code
│                            #   body: { username }
│                            #   → ищет юзера по username в БД
│                            #   → генерирует 6-значный OTP (TTL 5 мин)
│                            #   → шлёт через бота в Telegram
│                            # POST /api/v1/auth/verify-code
│                            #   body: { username, code }
│                            #   → проверяет код (макс 5 попыток)
│                            #   → возвращает { accessToken, refreshToken }
│                            # POST /api/v1/auth/refresh
│                            #   body: { refreshToken }
│                            #   → ротирует refresh-токен, выдаёт новую пару
│
├── handlers/
│   └── commands.js          # Все команды и callback-хендлеры бота.
│                            # /start — приветствие + join по invite-ссылке
│                            # /steps <число> — записать шаги за сегодня
│                            # /status — прогресс + таблица лидеров
│                            # /members — список участников (создатель может кикать)
│                            # /goal — задать цель группы (шаги/день + период)
│                            # /deletegroup — удалить свою группу
│                            # /help — список команд
│                            # /app — кнопка Mini App для записи шагов
│                            # Callback: create_group, join_group, kick_*, 
│                            #           goal_steps_*, goal_period_*, new_challenge_*
│
├── jobs/
│   └── digest.js            # Cron-задачи (timezone: Europe/Moscow)
│                            # 19:00 — напоминание тем, кто не внёс шаги сегодня
│                            # 20:00 — вечерний дайджест: таблица лидеров за день
│                            # 21:00 — финальные итоги для групп с дедлайном сегодня
│
├── db/
│   ├── client.js            # Подключение к PostgreSQL через DATABASE_URL (SSL)
│   │                        # Pool: max 10 соединений, idle_timeout 20s
│   └── migrate.js           # CREATE TABLE IF NOT EXISTS для всех таблиц.
│                            # Запускается при старте сервера.
│
└── utils.js                 # progressBar(percent) — текстовый прогресс-бар █░░
                             # fmt(n) — форматирование числа (ru-RU локаль)
                             # dayLabel(days) — "день/дня/дней"
```

### Переменные окружения сервера (`.env`)

| Переменная | Назначение |
|-----------|------------|
| `TELEGRAM_TOKEN` | Токен бота `@Step_Challenges_Bot` |
| `WEBHOOK_SECRET` | Секрет для проверки Telegram webhook |
| `PORT` | Порт Express (3000) |
| `WEBHOOK_URL` | `https://bot.mihmih.pro/webhook` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для подписи JWT токенов |
| `GOOGLE_CLIENT_ID` | Google OAuth (для Mini App шагомера) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |

---

## База данных (PostgreSQL)

```sql
users           — id, tg_id, username, created_at
groups          — id, name, invite_code, creator_id → users, created_at
group_members   — user_id → users, group_id → groups, joined_at
goals           — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps           — id, user_id → users, goal_id → goals, count, recorded_at
                  UNIQUE(user_id, goal_id, recorded_at)
auth_codes      — user_id PK → users, code, expires_at, attempts
refresh_tokens  — id, user_id → users, token UNIQUE, expires_at, created_at
```

---

## Авторизация (флоу)

1. Пользователь пишет `/start` боту `@Step_Challenges_Bot` — бот сохраняет `tg_id` + `username` в таблицу `users`
2. В приложении вводит `@username` → `POST /api/v1/auth/send-code`
3. Бот присылает 6-значный код в Telegram (TTL 5 минут)
4. Вводит код → `POST /api/v1/auth/verify-code` → получает `accessToken` (15м) + `refreshToken` (30д)
5. Токены хранятся в `expo-secure-store`
6. При 401 — автоматический refresh через `POST /api/v1/auth/refresh`

---

## SSH-доступ к серверу

```bash
ssh root@147.45.134.216
# ключ: /tmp/haba_deploy (ed25519, добавлен в ~/.ssh/authorized_keys)
```

Управление процессом:
```bash
pm2 status
pm2 restart step-bot --update-env
pm2 logs step-bot --lines 50
```

---

## Сборка APK (Android)

**Требования:**
- Android Studio установлен в `C:\Program Files\Android\Android Studio`
- Android SDK: `C:\Users\Saartr\AppData\Local\Android\Sdk`
- Gradle: 8.13 (прописан в `android/gradle/wrapper/gradle-wrapper.properties`)

**Первый раз — генерация нативной папки:**
```powershell
cd C:\haba
npx expo prebuild --platform android --clean
```

После prebuild обязательно обновить версию Gradle в `android/gradle/wrapper/gradle-wrapper.properties`:
```
distributionUrl=https\://services.gradle.org/distributions/gradle-8.13-bin.zip
```

**Сборка и установка на телефон (одна команда):**
```powershell
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

APK находится по пути: `android/app/build/outputs/apk/debug/app-debug.apk`

> Первая сборка ~7 минут (скачивает зависимости). Повторные — 1-2 минуты.
