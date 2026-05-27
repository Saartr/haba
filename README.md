# Тапа — социальный трекер привычек

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием через Telegram.

---

## Стек

**Фронтенд** (`C:\haba`)
- React Native + Expo SDK 55, Expo Router, TypeScript
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)
- react-native-svg (SVG-иконки и иллюстрации)
- react-native-webview (Telegram Login Widget)
- Шрифт: Manrope (medium / semibold / bold)

**Бэкенд** (`backend/` в репо, `/var/www/haba/backend` на сервере `bot.mihmih.pro`)
- Node.js v22, Express 5
- grammy v1 (Telegram Bot API) — бот `@Step_Challenges_Bot`
- PostgreSQL (библиотека `postgres` tag)
- PM2 (процесс-менеджер, имя процесса `step-bot`)
- node-cron (дайджесты в 19:00 / 20:00 / 21:00 МСК)

**Деплой бэкенда** — ручной скрипт `deploy-backend.ps1` (см. ниже).

---

## Окружение разработки

| Параметр | Значение |
|----------|----------|
| ОС | Windows 11 |
| Телефон (Android) | CPH2745, IP `192.168.1.139` |
| IP компьютера | `192.168.1.143` |
| VPN | Amnezia — телефон в split-tunnel, трафик к нему идёт напрямую |

**Запуск dev-сервера (PowerShell):**
```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME="192.168.1.143"; npx expo start
# затем 'a' — открыть на Android
```

---

## Структура фронтенда

```
app/
├── _layout.tsx              # Root layout. Проверяет JWT, редиректит:
│                            # есть токен → (tabs), нет → (auth)/welcome
├── +not-found.tsx
├── dev.tsx                  # Галерея компонентов (только __DEV__)
├── (auth)/
│   ├── _layout.tsx          # Stack без хедера
│   └── welcome.tsx          # Кнопка «Войти через Telegram» → Modal с WebView
│                            # → Telegram Login Widget. После колбэка POST
│                            # /api/v1/auth/telegram → JWT.
│                            # tg:// deeplinks через Linking.openURL().
└── (tabs)/                  # Основное приложение (авторизованные)
    ├── _layout.tsx          # Stack без таб-бара
    ├── index.tsx            # Главный: шторка с приветствием + аватар,
    │                        # FlatList привычек или empty state,
    │                        # кнопки «Добавить» / «Вступить»
    ├── two.tsx              # Профиль: аватар, имя, меню (настройки
    │                        # профиля / приложения / о приложении),
    │                        # «Выйти» с подтверждением, «Удалить аккаунт»
    ├── create-habit.tsx     # Создание привычки: имя, цель (5/7/10k),
    │                        # тип (solo/group), уведомления → POST /habits
    ├── habit/[id].tsx       # Детали привычки: участники, логи, streak
    ├── profile-settings.tsx # Редактирование first_name
    ├── app-settings.tsx     # Тема (Light/Dark/System) через SettingsContext
    ├── about-app.tsx        # О приложении + ссылки на legal/[type]
    └── legal/[type].tsx     # Правовые документы (privacy / terms)

lib/
├── api.ts                   # Fetch-клиент. BASE_URL = https://bot.mihmih.pro/api/v1
│                            # Авто-refresh токена при 401.
│                            # Эндпоинты: telegramAuth, getMe, updateProfile,
│                            # createHabit, getHabits, getHabit, joinHabit,
│                            # logHabit, excludeMember, transferHabit, closeHabit
├── auth.ts                  # JWT в expo-secure-store:
│                            # saveTokens, getTokens, clearTokens, isAuthenticated
├── auth-context.tsx         # { authed, checked, user, setAuthed,
│                            #   refreshUser, updateUser }
├── settings-context.tsx     # { colorScheme, setColorScheme } — тема приложения
└── colors.ts                # Цветовые токены TapaDS + хук useColors().
                             # Используется ВЕЗДЕ вместо хардкода hex.

components/
├── Button.tsx               # variant: 'main' | 'text', icon, loading, disabled
├── Input.tsx                # icon, error, disabled, через useColors()
├── Text.tsx                 # weight: 'medium' | 'semibold' | 'bold' (default: medium)
├── Lists.tsx                # Список меню-айтемов (icon + label + chevron)
├── SegmentedControl.tsx     # Радио-группа с кнопками-сегментами
├── Select.tsx               # Селект в bottom-sheet стиле
├── useColorScheme.ts        # Хук определения light/dark темы (native)
└── useColorScheme.web.ts    # Web-версия

assets/
├── icons/                   # SVG: Plus, GroupPlus, Telegram, Mail, Pin, Loading,
│                            # arrow_back, ChevronDown, ChevronRight, Check, Close,
│                            # Share, Block, Footprint, MoreVertical, DeleteForever,
│                            # InfoCircle, Logout, Settings, User
└── images/                  # tapa_welcome.svg, tapa_quest.png

global.css                   # Tailwind + CSS custom properties для семантических
                             # токенов (light/dark через @media)
tailwind.config.js           # Палитра TapaDS + типографика h1-h5, body-16/14/12
```

### Дизайн-система

**TapaDS — единственный источник правды** для цветов, иконок, отступов и компонентов.
Figma: https://www.figma.com/design/TzdQy6wcvOb4yKaz3LfJVU/TapaDS

Цвета — только через `useColors()`:
- `c.brand.primary / pressed` — фон кнопок
- `c.surface.default / input / disabled` — фоны экранов и полей
- `c.text.primary / secondary / label / placeholder / onPrimary / link`
- `c.icon.onPrimary / placeholder / pressed / error`
- `c.border.input / error`
- `c.semantic.error`

Хардкодить hex запрещено.

---

## Структура бэкенда

```
backend/
├── package.json             # express ^5, grammy ^1, postgres ^3, jsonwebtoken,
│                            # node-cron, dotenv
├── package-lock.json
└── src/
    ├── index.js             # Точка входа. Express + grammy.
    │                        # /api/v1/auth → authRouter
    │                        # /api/v1/habits → habitsRouter
    │                        # /webhook, /miniapp/*, /health
    ├── api/
    │   ├── auth.js          # JWT + Telegram Login Widget (см. ниже)
    │   └── habits.js        # CRUD привычек, члены, логи, streak
    ├── handlers/
    │   └── commands.js      # Команды бота и callback-хендлеры
    ├── jobs/
    │   └── digest.js        # Cron-задачи (timezone: Europe/Moscow)
    │                        # 19:00 — напоминание невнёсшим шаги
    │                        # 20:00 — вечерний дайджест
    │                        # 21:00 — финальные итоги для дедлайнов
    ├── db/
    │   ├── client.js        # PostgreSQL через DATABASE_URL (SSL)
    │   ├── migrate.js       # Базовые таблицы users/groups/goals/steps/refresh_tokens
    │   └── migrate_habits.js # Таблицы habits/habit_members/habit_logs
    ├── miniapp/             # Telegram Mini App (HTML + JS)
    └── utils.js             # progressBar, fmt, dayLabel
```

На сервере `/var/www/haba/backend/public/avatars/{userId}.jpg` — статика, отдаёт nginx (`location /avatars/ → alias`). Папка `public/avatars/` исключена из git.

### Авторизация (Telegram Login Widget)

1. Юзер жмёт «Войти через Telegram» → Modal с WebView
2. WebView загружает `GET /api/v1/auth/telegram-login` → редирект на `oauth.telegram.org`
3. `tg://` deeplinks перехватываются, открывается Telegram через `Linking.openURL()`
4. После подтверждения — редирект на `/api/v1/auth/telegram-callback#tgAuthResult=...`
5. Фронт парсит base64 из fragment → `POST /api/v1/auth/telegram`
6. Сервер: HMAC-верификация → upsert user → скачивание аватара → возвращает `{ accessToken, refreshToken, user }`

**JWT:**
- `accessToken` — `{ sub: userId }`, TTL 15 минут
- `refreshToken` — `{ sub, type: 'refresh' }`, TTL 30 дней, ротируется при использовании (DELETE старого + INSERT нового)

### Аватары

1. При `POST /auth/telegram` сервер скачивает аватар:
   - Сначала из `photo_url` виджета (с redirect-following)
   - Если нет — через Bot API `getUserProfilePhotos`
2. Сохраняет в `/var/www/haba/backend/public/avatars/{userId}.jpg`
3. Если файл уже существует (size > 0) — повторно не качает
4. Nginx отдаёт по `https://bot.mihmih.pro/avatars/{userId}.jpg`

### Переменные окружения сервера (`.env`)

| Переменная | Назначение |
|------------|------------|
| `TELEGRAM_TOKEN` | Токен бота `@Step_Challenges_Bot` |
| `WEBHOOK_SECRET` | Секрет для проверки Telegram webhook |
| `PORT` | Порт Express (3000) |
| `WEBHOOK_URL` | `https://bot.mihmih.pro/webhook` |
| `DATABASE_URL` | PostgreSQL connection string (SSL) |
| `JWT_SECRET` | Секрет для подписи JWT |

`.env` не в git — хранится только на сервере в `/var/www/haba/backend/.env`.

---

## База данных (PostgreSQL)

**Бот-функциональность (исторические таблицы):**
```sql
users           — id, tg_id, username, first_name, last_name, avatar_url, created_at
groups          — id, name, invite_code, creator_id → users, created_at
group_members   — user_id → users, group_id → groups, joined_at
goals           — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps           — id, user_id → users, goal_id → goals, count, recorded_at
                  UNIQUE(user_id, goal_id, recorded_at)
refresh_tokens  — id, user_id → users, token UNIQUE, expires_at, created_at
```

**Привычки:**
```sql
habits          — id, creator_id → users, name, category, type CHECK('solo'|'group'),
                  goal_value INT NULL, goal_unit TEXT NULL, notifications BOOL,
                  invite_code TEXT UNIQUE, closed_at, created_at
habit_members   — habit_id → habits, user_id → users, joined_at
                  PK(habit_id, user_id)
habit_logs      — id, habit_id → habits, user_id → users, date DATE, value INT
                  UNIQUE(habit_id, user_id, date)
```

`avatar_url` — полный URL вида `https://bot.mihmih.pro/avatars/{userId}.jpg`, `null` если нет.

---

## Деплой бэкенда

Деплой ручной — без GitHub Actions. Изменения в `backend/` коммитятся в `main`, потом запускается скрипт.

```powershell
# В корне репо c:\haba
./deploy-backend.ps1
```

Что делает: `ssh Haba` → `git pull --ff-only` → `npm install --omit=dev` → `pm2 restart step-bot` → `pm2 list`.

**Ветки:**
- `main` — стабильная, деплоится на прод
- `dev` — разработка. Push в `dev` НЕ деплоится автоматически. Готово → мерж в `main` → запуск скрипта.

**SSH-доступ:**
```bash
ssh Haba                                      # алиас в ~/.ssh/config
# = ssh -i ~/.ssh/haba_deploy root@147.45.134.216
```

**Полезное на сервере:**
```bash
ssh Haba 'pm2 list'
ssh Haba 'pm2 logs step-bot --lines 50 --nostream'
ssh Haba 'pm2 restart step-bot'
```

Править файлы на сервере напрямую — нельзя (`git pull` затрёт). Все правки — локально в `backend/` + `git push` + `./deploy-backend.ps1`. Исключение: `.env` (он не в git) — `scp` туда-обратно + `pm2 restart`.

---

## Сборка APK (Android)

**Требования:**
- Android Studio: `C:\Program Files\Android\Android Studio`
- Android SDK: `C:\Users\Saartr\AppData\Local\Android\Sdk`
- Gradle 8.13 в `android/gradle/wrapper/gradle-wrapper.properties`

**Первый раз:**
```powershell
cd C:\haba
npx expo prebuild --platform android --clean
# обновить distributionUrl до 8.13 в android/gradle/wrapper/gradle-wrapper.properties
```

**Сборка и установка:**
```powershell
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`. Первая сборка ~7 минут, повторные 1-2 минуты.

## iOS

Ещё не собирается — нужен Apple Developer Account ($99/год). План: EAS Build (Expo cloud CI), без локального Mac.
