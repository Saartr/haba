---
name: project-push-plan
description: "✅ Реализовано: push-уведомления через FCM HTTP v1 напрямую (без Expo посредника)"
metadata:
  type: project
---

## Push-уведомления — FCM HTTP v1 напрямую (реализовано)

Все шаги ниже реализованы (проверено аудитом 2026-06-20): `lib/notifications.ts`, `backend/src/push/fcm.js` (с кэшем access token и обработкой UNREGISTERED/404), `backend/src/push/notify.js` (`notifyHabitJoin`, `notifyGoalIfReached`), `backend/src/jobs/habit-reminders.js` (cron `0 19 * * *` МСК). `push_tokens` — отдельная таблица (не колонка в `users`, как был изначальный план ниже) — см. [[project_database]].

**Выбранный подход:** FCM HTTP v1 без Expo Push Service. Бэкенд сам ходит в Google FCM API по service account. Expo не участвует как посредник.

**Why:** Приложение для РФ, не хочется зависеть от Expo серверов в США. FCM работает у 95%+ пользователей в РФ. Для tg-пользователей — fallback через бота.

---

### Шаг 1 — Firebase проект

1. console.firebase.google.com → создать проект
2. Project Settings → General → добавить Android-приложение (package `pro.mihmih.haba`)
3. Скачать `google-services.json` → положить в корень репо (в `.gitignore` уже нет, добавить)
4. Project Settings → Service Accounts → Generate new private key → скачать `service-account.json`
5. `service-account.json` положить на сервер: `/var/www/haba/backend/service-account.json` (НЕ в git)

### Шаг 2 — Фронтенд: установка и конфиг

```bash
npx expo install expo-notifications
```

В `app.json` добавить:
```json
{
  "android": {
    "googleServicesFile": "./google-services.json"
  },
  "plugins": [
    ["expo-notifications", {
      "icon": "./assets/images/icon.png",
      "color": "#6047ff"
    }]
  ]
}
```

Следующий `prebuild` подхватит автоматически.

### Шаг 3 — Фронтенд: регистрация FCM токена

В `lib/notifications.ts` (новый файл):
```ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerPushToken(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return null;
  const token = await Notifications.getDevicePushTokenAsync();
  return token.data; // FCM token
}
```

Вызывать после логина в `auth-context.tsx` → отправлять на бэкенд `PATCH /auth/me { push_token }`.

Также добавить listener на смену токена:
```ts
Notifications.addPushTokenListener(({ data }) => {
  // отправить обновлённый токен на бэкенд
});
```

### Шаг 4 — Фронтенд: обработка тапа по уведомлению

В `app/_layout.tsx`:
```ts
Notifications.addNotificationResponseReceivedListener(response => {
  const habitId = response.notification.request.content.data?.habitId;
  if (habitId) router.push(`/(tabs)/habit/${habitId}`);
});
```

### Шаг 5 — Бэкенд: миграция БД

В `backend/src/db/migrate_push.js`:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
```

### Шаг 6 — Бэкенд: сохранение токена

`PATCH /auth/me` принимает опциональный `push_token` и сохраняет в users.

### Шаг 7 — Бэкенд: отправка уведомлений

Новый файл `backend/src/utils/fcm.js`:
- Читает `service-account.json`
- Получает OAuth2 access token через Google Auth Library (`google-auth-library`)
- POST на `https://fcm.googleapis.com/v1/projects/{projectId}/messages:send`

```js
async function sendPush(pushToken, { title, body, data }) {
  const accessToken = await getAccessToken(); // по service-account.json
  await fetch(`https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: pushToken,
        notification: { title, body },
        data,
        android: { priority: 'high' },
      },
    }),
  });
}
```

### Шаг 8 — Бэкенд: cron-дайджест

В `backend/src/jobs/digest.js` добавить задачу (например 20:00 МСК):
- Найти пользователей с `notifications = true` и `push_token IS NOT NULL`
- У кого нет лога за сегодня по активным привычкам → отправить напоминание
- Fallback: если есть `tg_id` → отправить через бота

### Зависимости бэкенда

```bash
npm install google-auth-library
```

---

## Порядок реализации

1. Создать Firebase проект, получить файлы
2. Шаг 5 (миграция) + Шаг 6 (PATCH /auth/me)
3. Шаг 2-3 (фронт: expo-notifications, регистрация токена)
4. Шаг 7 (fcm.js утилита)
5. Шаг 8 (cron дайджест)
6. Шаг 4 (обработка тапа)
7. Следующий `prebuild` → пересборка APK с google-services.json

**How to apply:** При реализации читать этот план пошагово. service-account.json — секрет, на сервер через scp, не в git.

---

## Глобальный тоггл «Уведомления» в настройках (2026-06-21)

Тоггл в `app-settings.tsx` (`SegmentedControl`, `settings.notifications: 'on'|'off'`, хранится в `SecureStore` через [[project_database]]-независимый `lib/settings-context.tsx`) реально включает/выключает push:
- Выключение → `unregisterCurrentPushToken()` (отписывает текущий FCM-токен на бэкенде немедленно, не дожидаясь перезапуска)
- Включение → `registerForPush()` (регистрирует токен заново)
- `app/_layout.tsx`: эффект авто-регистрации токена после логина теперь зависит от `settings.notifications` — если `off`, токен не регистрируется даже при старте приложения

Это глобальный тоггл уровня устройства (не привязан к конкретной цели). Отдельно от него — поле `habits.notifications` (per-habit, см. [[project_database]]) учитывается в `backend/src/push/notify.js` и `backend/src/jobs/habit-reminders.js`: тоггл «Уведомления» при создании/редактировании цели (`create-habit.tsx`, `edit-habit/[id].tsx`) теперь не `disabled` — `PATCH /habits/:id` принимает `notifications`, сохраняя текущее значение если поле не передано (старый клиент).
