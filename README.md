# Тапа — социальный трекер привычек

Мобильное приложение (iOS + Android) для отслеживания привычек с групповым соревнованием через Telegram.

---

## Стек

**Фронтенд**
- React Native + Expo SDK 55 (Expo Router, TypeScript)
- NativeWind v4 (Tailwind CSS для RN)
- expo-secure-store (хранение JWT)
- react-native-svg (SVG-иконки и иллюстрации)
- react-native-webview (Telegram Login Widget)

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
│   └── welcome.tsx          # Экран приветствия. Кнопка «Войти через Telegram» открывает
│                            # Modal с WebView → Telegram Login Widget.
│                            # После успешного входа: POST /api/v1/auth/telegram → JWT.
│                            # tg:// deeplinks перехватываются через Linking.openURL().
└── (tabs)/                  # Основное приложение (требует токена)
    ├── _layout.tsx          # Stack-навигатор (без таб-бара): index + two
    ├── index.tsx            # Главный экран привычек.
    │                        # Верхняя шторка: «Привет, {displayName}» + аватар.
    │                        # Аватар: фото из Telegram или инициал First Name.
    │                        # Тап по аватару → two (профиль).
    │                        # Username/First Name обрезается до 12 символов + «…».
    │                        # Empty state: маскот tapa_quest.png + кнопка «Добавить».
    └── two.tsx              # Профиль (заглушка)

lib/
├── api.ts                   # Fetch-клиент. BASE_URL = https://bot.mihmih.pro/api/v1
│                            # Автоматический refresh токена при 401.
│                            # Экспортирует: telegramAuth(data), getMe()
│                            # Типы: TelegramUser, UserProfile
├── auth.ts                  # Работа с токенами через expo-secure-store.
│                            # Экспортирует: saveTokens, getTokens, clearTokens, isAuthenticated
├── auth-context.tsx         # React Context: { authed, checked, user, setAuthed, refreshUser }
│                            # user: UserProfile | null — профиль из /auth/me
│                            # При логине: user устанавливается сразу из ответа сервера
│                            # При старте: isAuthenticated() → refreshUser() если ok
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
├── icons/                   # SVG-иконки: Plus, Telegram, Mail, Pin, Loading, arrow_back
└── images/                  # tapa_welcome.svg (welcome-экран), tapa_quest.png (empty state)

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
- `c.icon.onPrimary / placeholder / pressed / error` — иконки (pressed = белый в обеих темах)
- `c.border.input / error` — рамки инпута
- `c.semantic.error` — цвет ошибки

---

## Бэкенд (`/var/www/step-bot` на сервере)

```
src/
├── index.js                 # Точка входа. Express + grammy + роутинг.
│                            # Middleware: req.bot = bot (доступ к боту из роутеров)
│                            # Маунтит: /api/v1/auth → authRouter
│                            # Маршруты: /webhook, /miniapp/*, /health
│
├── api/
│   └── auth.js              # REST API авторизации (JWT + Telegram Login Widget)
│                            # GET  /api/v1/auth/telegram-login
│                            #   → HTML-страница с кнопкой «Открыть Telegram»
│                            #   → редирект на oauth.telegram.org
│                            # GET  /api/v1/auth/telegram-callback
│                            #   → пустая HTML-страница; приложение читает tgAuthResult из URL
│                            # POST /api/v1/auth/telegram
│                            #   body: { id, hash, auth_date, username, first_name, ... }
│                            #   → верифицирует HMAC-подпись Telegram
│                            #   → upsert пользователя в БД
│                            #   → скачивает аватар (photo_url или Bot API), сохраняет в /public/avatars/
│                            #   → возвращает { accessToken, refreshToken, user }
│                            #     user: { username, first_name, last_name, avatar_url }
│                            # POST /api/v1/auth/refresh
│                            #   body: { refreshToken }
│                            #   → ротирует refresh-токен, выдаёт новую пару
│                            # GET  /api/v1/auth/me  (Bearer token)
│                            #   → { username, first_name, last_name, avatar_url }
│
├── handlers/
│   └── commands.js          # Все команды и callback-хендлеры бота.
│
├── jobs/
│   └── digest.js            # Cron-задачи (timezone: Europe/Moscow)
│                            # 19:00 — напоминание тем, кто не внёс шаги сегодня
│                            # 20:00 — вечерний дайджест: таблица лидеров за день
│                            # 21:00 — финальные итоги для групп с дедлайном сегодня
│
├── db/
│   ├── client.js            # Подключение к PostgreSQL через DATABASE_URL (SSL)
│   └── migrate.js           # CREATE TABLE IF NOT EXISTS + ALTER TABLE IF NOT EXISTS.
│
└── utils.js                 # progressBar, fmt, dayLabel

public/
└── avatars/                 # Фото профилей пользователей. Файлы: {userId}.jpg
                             # Доступны по https://bot.mihmih.pro/avatars/{userId}.jpg
                             # Nginx: location /avatars/ { alias /var/www/step-bot/public/avatars/; }
```

### Аватары — как работает

1. При POST `/auth/telegram` сервер пробует скачать аватар:
   - Сначала из `photo_url` виджета (с redirect-следованием)
   - Если не вышло — через Bot API (`getUserProfilePhotos`)
2. Файл сохраняется как `/var/www/step-bot/public/avatars/{userId}.jpg`
3. Nginx отдаёт файл напрямую по `https://bot.mihmih.pro/avatars/{userId}.jpg`
4. Если файл уже есть (size > 0) — повторная загрузка не происходит

### Переменные окружения сервера (`.env`)

| Переменная | Назначение |
|-----------|------------|
| `TELEGRAM_TOKEN` | Токен бота `@Step_Challenges_Bot` |
| `WEBHOOK_SECRET` | Секрет для проверки Telegram webhook |
| `PORT` | Порт Express (3000) |
| `WEBHOOK_URL` | `https://bot.mihmih.pro/webhook` |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для подписи JWT токенов |

---

## База данных (PostgreSQL)

```sql
users           — id, tg_id, username, first_name, last_name, avatar_url, created_at
groups          — id, name, invite_code, creator_id → users, created_at
group_members   — user_id → users, group_id → groups, joined_at
goals           — id, group_id → groups, steps_per_day, period_days, starts_at, deadline
steps           — id, user_id → users, goal_id → goals, count, recorded_at
                  UNIQUE(user_id, goal_id, recorded_at)
refresh_tokens  — id, user_id → users, token UNIQUE, expires_at, created_at
```

`avatar_url` — полный URL вида `https://bot.mihmih.pro/avatars/{userId}.jpg`. `null` если аватар недоступен.

---

## Авторизация (флоу — Telegram Login Widget)

1. Пользователь нажимает «Войти через Telegram» — открывается Modal с WebView
2. WebView загружает `/api/v1/auth/telegram-login` — страница с кнопкой-ссылкой на `oauth.telegram.org`
3. WebView перехватывает `tg://` deep links и открывает Telegram через `Linking.openURL()`
4. После подтверждения в Telegram — редирект на `/api/v1/auth/telegram-callback#tgAuthResult=...`
5. Фронт парсит `tgAuthResult` из URL fragment, декодирует base64, отправляет `POST /api/v1/auth/telegram`
6. Сервер верифицирует HMAC-подпись, upsert пользователя, скачивает аватар, возвращает JWT
7. Токены сохраняются в `expo-secure-store`, профиль сразу доступен через `AuthContext`

### JWT

- `accessToken` — `{ sub: userId }`, TTL 15 минут
- `refreshToken` — `{ sub: userId, type: 'refresh' }`, TTL 30 дней, ротируется при использовании

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

Редактирование файлов сервера: скачать через `scp`, отредактировать локально, загрузить обратно:
```powershell
# Скачать
scp -i /tmp/haba_deploy root@147.45.134.216:/var/www/step-bot/src/api/auth.js C:\tmp\auth.js
# Загрузить
scp -i /tmp/haba_deploy C:\tmp\auth.js root@147.45.134.216:/var/www/step-bot/src/api/auth.js
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

**Сборка и установка на телефон:**
```powershell
cd C:\haba\android
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="C:\Users\Saartr\AppData\Local\Android\Sdk"
.\gradlew assembleDebug
adb install app\build\outputs\apk\debug\app-debug.apk
```

APK: `android/app/build/outputs/apk/debug/app-debug.apk`

> Первая сборка ~7 минут. Повторные — 1-2 минуты.
