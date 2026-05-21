# Тапа — социальный трекер привычек

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием через Telegram.

---

## Стек

**Фронтенд**
- React Native + Expo SDK 55 (Expo Router, TypeScript)
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)
- react-native-svg (SVG-иконки и иллюстрации)

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
├── dev.tsx                  # Галерея компонентов (только __DEV__, в проде редирект на /)
├── (auth)/                  # Флоу авторизации (не требует токена)
│   ├── _layout.tsx          # Stack-навигатор без хедера
│   ├── welcome.tsx          # Экран приветствия с SVG-иллюстрацией и кнопкой входа
│   ├── enter-username.tsx   # Ввод @username → POST /api/v1/auth/send-code
│   ├── verify-code.tsx      # Ввод 6-значного кода → POST /api/v1/auth/verify-code
│   │                        # Кнопка активна только при 6 символах
│   └── success.tsx          # Заглушка (не используется в основном флоу)
└── (tabs)/                  # Основное приложение (требует токена)
    ├── _layout.tsx          # Tab-навигатор: Привычки / Профиль
    ├── index.tsx            # Главный экран привычек (заглушка)
    └── two.tsx              # Профиль (заглушка)

lib/
├── api.ts                   # Fetch-клиент. BASE_URL = https://bot.mihmih.pro/api/v1
│                            # Автоматический refresh токена при 401.
│                            # Экспортирует: sendCode(username), verifyCode(username, code)
├── auth.ts                  # Работа с токенами через expo-secure-store.
│                            # Экспортирует: saveTokens, getTokens, clearTokens, isAuthenticated
├── auth-context.tsx         # React Context: { authed, setAuthed }. Обёртка в _layout.tsx
├── colors.ts                # Цветовые константы и хук useColors() для dark/light темы.
│                            # useColors() возвращает SemanticColors — темо-зависимые токены.
│                            # Используется во всех компонентах вместо хардкода цветов.
└── design.md                # Спецификация дизайн-системы TapaDS (типографика, токены,
                             # компоненты Button/Input, отступы, радиусы)

components/
├── Button.tsx               # Кнопка. variant: 'main' | 'text'. Поддерживает icon, loading,
│                            # disabled. borderRadius=12 (radius/3 по TapaDS).
│                            # borderCurve: 'continuous' на iOS (нативный суперэллипс).
├── Input.tsx                # Поле ввода. Поддерживает icon, error, disabled.
│                            # Цвета полностью через useColors() — dark-mode-aware.
├── Text.tsx                 # Обёртка над RN Text. Prop weight: 'medium'|'semibold'|'bold'
│                            # подставляет нужный font-family (Manrope). Default: 'medium'.
├── useColorScheme.ts        # Хук определения light/dark темы
└── useColorScheme.web.ts    # Web-версия хука

assets/
├── icons/                   # SVG-иконки: Mail, Pin, Telegram, Loading, arrow_back
└── images/                  # tapa_welcome.svg (welcome-экран), иконки приложения

global.css                   # Tailwind-директивы + CSS custom properties для семантических
                             # токенов цвета (light/dark через @media prefers-color-scheme)
tailwind.config.js           # Палитра TapaDS (purple, neutral, red, green, yellow) +
                             # семантические токены (brand, surface, text, icon, border, semantic)
                             # через CSS-переменные. Типографика: h1-h5, body-16/14/12.
babel.config.js              # babel-preset-expo + nativewind/babel
metro.config.js              # withNativeWind(config, { input: './global.css' })
```

### Дизайн-система (TapaDS)

Все цвета, отступы, радиусы и типографика описаны в `lib/design.md`.

**Семантические цвета** — использовать `useColors()` из `lib/colors.ts`, не хардкодить hex:
- `c.brand.primary / c.brand.pressed` — фон кнопок
- `c.surface.default / c.surface.input / c.surface.disabled` — фоны экранов и инпутов
- `c.text.primary / secondary / label / placeholder / onPrimary / link` — текст
- `c.icon.onPrimary / placeholder / error` — иконки
- `c.border.input / error` — рамки инпута
- `c.semantic.error` — цвет ошибки

---

## Бэкенд (`/var/www/step-bot` на сервере)

```
src/
├── index.js                 # Точка входа. Express + grammy + роутинг.
│                            # Middleware: req.bot = bot (доступ к боту из роутеров)
│                            # Маунтит: /api/v1/auth → authRouter
│                            # Статика: /avatars → /public/avatars (фото профилей)
│                            # Маршруты: /webhook, /miniapp/*, /health
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
│                            #   → возвращает { accessToken, refreshToken, user }
│                            #     user: { username, first_name, last_name, avatar_url }
│                            # POST /api/v1/auth/refresh
│                            #   body: { refreshToken }
│                            #   → ротирует refresh-токен, выдаёт новую пару
│                            # GET /api/v1/auth/me  (Bearer token)
│                            #   → { username, first_name, last_name, avatar_url }
│
├── handlers/
│   └── commands.js          # Все команды и callback-хендлеры бота.
│                            # upsertUser(bot, tgFrom) — вспомогательная функция:
│                            #   сохраняет username/first_name/last_name в БД,
│                            #   при первом входе скачивает аватар из Telegram
│                            #   и сохраняет в /public/avatars/{userId}.jpg
│                            # /start — upsertUser + приветствие + join по invite-ссылке
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
│   └── migrate.js           # CREATE TABLE IF NOT EXISTS + ALTER TABLE IF NOT EXISTS.
│                            # Запускается при старте сервера.
│
└── utils.js                 # progressBar(percent) — текстовый прогресс-бар █░░
                             # fmt(n) — форматирование числа (ru-RU локаль)
                             # dayLabel(days) — "день/дня/дней"

public/
└── avatars/                 # Фото профилей пользователей. Файлы: {userId}.jpg
                             # Доступны по https://bot.mihmih.pro/avatars/{userId}.jpg
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
users           — id, tg_id, username, first_name, last_name, avatar_url, created_at
groups          — id, name, invite_code, creator_id → users, created_at
group_members   — user_id → users, group_id → groups, joined_at
goals           — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps           — id, user_id → users, goal_id → goals, count, recorded_at
                  UNIQUE(user_id, goal_id, recorded_at)
auth_codes      — user_id PK → users, code, expires_at, attempts
refresh_tokens  — id, user_id → users, token UNIQUE, expires_at, created_at
```

`avatar_url` — полный URL вида `https://bot.mihmih.pro/avatars/{userId}.jpg`. `null` если у пользователя нет аватара или он скрыт. Аватар скачивается один раз при первом `/start`.

---

## Авторизация (флоу)

1. Пользователь пишет `/start` боту `@Step_Challenges_Bot` — бот сохраняет профиль (`tg_id`, `username`, `first_name`, `last_name`) и аватар
2. В приложении вводит `@username` → `POST /api/v1/auth/send-code`
3. Бот присылает 6-значный код в Telegram (TTL 5 минут, макс 5 попыток)
4. Вводит код → `POST /api/v1/auth/verify-code` → получает `{ accessToken (15м), refreshToken (30д), user }`
5. Токены хранятся в `expo-secure-store`
6. При 401 — автоматический refresh через `POST /api/v1/auth/refresh`
7. При перезапуске приложения профиль можно получить через `GET /api/v1/auth/me`

### JWT

- `accessToken` — `{ sub: userId }`, TTL 15 минут
- `refreshToken` — `{ sub: userId, type: 'refresh' }`, TTL 30 дней, хранится в таблице `refresh_tokens`, при использовании ротируется

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
