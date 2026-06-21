---
name: project-push-plan
description: "✅ Реализовано: push-уведомления через FCM HTTP v1 напрямую (без Expo посредника)"
metadata:
  type: project
---

## Push-уведомления — FCM HTTP v1 напрямую (реализовано)

**Выбранный подход:** FCM HTTP v1 без Expo Push Service. Бэкенд сам ходит в Google FCM API по service account (`service-account.json` на сервере, `/var/www/haba/backend/service-account.json`, НЕ в git). Expo не участвует как посредник.

**Why:** Приложение для РФ, не хочется зависеть от Expo серверов в США. FCM работает у 95%+ пользователей в РФ.

**Текущая реализация:**
- `lib/notifications.ts` — `registerForPush()` (permission + `getDevicePushTokenAsync` + `registerPushToken()` на бэкенд), `unregisterCurrentPushToken()`, `addTokenRotationListener()`, `getNotificationsModule()` (ленивый `require('expo-notifications')`, безопасно для Expo Go/несобранного APK)
- `lib/api.ts` — `registerPushToken(token, platform)` / `unregisterPushToken(token)` → `POST`/`DELETE /push/register`
- `push_tokens` — отдельная таблица (не колонка в `users`), см. [[project_database]]
- `backend/src/push/fcm.js` — кэш OAuth2 access token, обработка UNREGISTERED/404 (чистит протухший токен из `push_tokens`)
- `backend/src/push/notify.js` — `notifyHabitJoin`, `notifyGoalIfReached` (учитывают `habits.notifications`)
- `backend/src/jobs/habit-reminders.js` — cron `0 19 * * *` МСК, напоминания только по привычкам с `notifications = true`
- `app/_layout.tsx` — регистрация токена после логина (Android), слушатель ротации токена

---

## Глобальный тоггл «Уведомления» в настройках (2026-06-21)

Тоггл в `app-settings.tsx` (`SegmentedControl`, `settings.notifications: 'on'|'off'`, хранится в `SecureStore` через [[project_database]]-независимый `lib/settings-context.tsx`) реально включает/выключает push:
- Выключение → `unregisterCurrentPushToken()` (отписывает текущий FCM-токен на бэкенде немедленно, не дожидаясь перезапуска)
- Включение → `registerForPush()` (регистрирует токен заново)
- `app/_layout.tsx`: эффект авто-регистрации токена после логина теперь зависит от `settings.notifications` — если `off`, токен не регистрируется даже при старте приложения

Это глобальный тоггл уровня устройства (не привязан к конкретной цели). Отдельно от него — поле `habits.notifications` (per-habit, см. [[project_database]]) учитывается в `backend/src/push/notify.js` и `backend/src/jobs/habit-reminders.js`: тоггл «Уведомления» при создании/редактировании цели (`create-habit.tsx`, `edit-habit/[id].tsx`) теперь не `disabled` — `PATCH /habits/:id` принимает `notifications`, сохраняя текущее значение если поле не передано (старый клиент).
