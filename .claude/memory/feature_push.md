---
name: feature-push
description: Push-уведомления — FCM HTTP v1 напрямую (без Expo); 5 типов пушей и их триггеры, включая кастомное время и запись в групповой count-цели
metadata:
  type: project
---

## Архитектура

FCM HTTP v1 без Expo Push Service. Бэкенд сам ходит в Google FCM API по service account (`service-account.json` на сервере, `/var/www/haba/backend/service-account.json`, НЕ в git). Только Android (iOS отложен — [[infra-ios-plan]]).

**Why:** Приложение для РФ, не хочется зависеть от Expo серверов в США. FCM работает у 95%+ пользователей в РФ.

**Файлы:**
- `lib/notifications.ts` — `registerForPush()` (permission + `getDevicePushTokenAsync` + `registerPushToken()` на бэкенд), `unregisterCurrentPushToken()`, `addTokenRotationListener()`, `getNotificationsModule()` (ленивый `require('expo-notifications')`, безопасно для Expo Go/несобранного APK)
- `lib/api.ts` — `registerPushToken(token, platform)` / `unregisterPushToken(token)` → `POST`/`DELETE /push/register`
- `push_tokens` — отдельная таблица (не колонка в `users`), см. [[infra-database]]
- `backend/src/push/fcm.js` — кэш OAuth2 access token, обработка UNREGISTERED/404 (чистит протухший токен из `push_tokens`)
- `backend/src/push/notify.js` — `notifyHabitJoin`, `notifyGoalIfReached`, `notifyEntryAdded` (учитывают `habits.notifications`)
- `backend/src/jobs/habit-reminders.js` — cron `0 19 * * *` МСК; исключает привычки с заданным `notification_times` (их покрывает hourly-джоб ниже)
- `backend/src/jobs/habit-notification-times.js` — cron `0 * * * *` МСК (ежечасно), напоминания по кастомному времени привычки (`habits.notification_times TEXT[]`), см. пуш №4 ниже
- `app/_layout.tsx` — регистрация токена после логина, слушатель ротации токена, обработка тапа по пушу

## Два тоггла

- **Глобальный** (`app-settings.tsx`, `SegmentedControl`, `settings.notifications: 'on'|'off'`, хранится в `SecureStore` через `lib/settings-context.tsx`) — уровень устройства, не привязан к цели:
  - Выключение → `unregisterCurrentPushToken()` (отписывает текущий FCM-токен на бэкенде немедленно)
  - Включение → `registerForPush()` (регистрирует токен заново)
  - `app/_layout.tsx`: эффект авто-регистрации токена после логина зависит от `settings.notifications` — если `off`, токен не регистрируется даже при старте приложения
- **Per-habit** (`habits.notifications`, см. [[infra-database]]) — тоггл «Уведомления» при создании/редактировании цели (`create-habit.tsx`, `edit-habit/[id].tsx`); `PATCH /habits/:id` принимает `notifications`, сохраняя текущее значение если поле не передано (старый клиент)

Каждый из 3 пушей ниже учитывает оба тоггла — если выключен любой, пуш не уходит.

## Какие пуши есть и как они выглядят со стороны пользователя

1. **Напоминание за день** (`backend/src/jobs/habit-reminders.js`)
   - Когда: каждый день в 19:00 МСК, если у пользователя есть хотя бы одна активная цель (`closed_at IS NULL`, `notifications=true`), по которой сегодня ещё нет ни одной отметки
   - Текст: заголовок «Тапа», тело «Не забудь отметить свои цели за сегодня 🎯»
   - Один пуш на пользователя в день, даже если непомеченных целей несколько (не спамит по каждой цели отдельно)
   - Тап по пушу: `data` без `habitId` → просто открывает приложение, без перехода на конкретную цель

2. **Вступление в группу** (`notifyHabitJoin`, при `POST /habits/join`)
   - Когда: кто-то вступает в групповую цель по инвайт-коду
   - Кому: только создателю цели (не самому вступившему)
   - Текст: заголовок — название цели, тело «{Имя} присоединился к цели»
   - Тап → переход на экран цели (`/(tabs)/habit/{habitId}`)

3. **Цель достигнута за день** (`notifyGoalIfReached` → `notifyGoalReached`, при логировании вручную или синке из Health Connect)
   - Когда: значение участника за сегодня впервые пересекает порог `goal_value` цели (раньше было меньше, стало ≥) — повторные обновления в тот же день после достижения не шлют пуш повторно
   - Кому: всем остальным участникам группы, кроме того, кто достиг цели
   - Текст: заголовок — название цели, тело «{Имя} выполнил цель на сегодня 🎯»
   - Тап → переход на экран цели
   - Применимо только к целям с числовым `goal_value` (групповые цели по шагам); у «Подтягиваний» и курения `goal_value` нет, этот пуш для них не срабатывает

4. **Напоминание по кастомному времени** (`backend/src/jobs/habit-notification-times.js`, `sendNotificationTimeReminders`)
   - Когда: ежечасно (cron `0 * * * *` МСК) — если текущий час есть в `habits.notification_times` (`TEXT[]`, напр. `['09:00','18:00']`) привычки, и участник ещё не залогировался сегодня
   - Настраивается только при создании привычки через мастер (`custom-habit/step3.tsx`, 1-3 раза в день + выбор часа 06:00-23:00); в `edit-habit` — нередактируемо, `PATCH /habits/:id` это поле не принимает
   - Не зависит от `goal_value` — работает для любой периодичности `daily`
   - Текст (одна цель у пользователя в этот час): заголовок «Тапа», тело «Не забудь отметить цель «{название}» 🎯», тап → переход на экран цели (`data.habitId`)
   - **Объединённая нотификация (2026-08-01):** если у пользователя в этот час совпало несколько целей — вместо N отдельных пушей одна, без `habitId` (тап открывает приложение, без перехода на конкретную цель). Текст: до 3 целей — имена через запятую и «и» («Не забудь отметить «A», «B» и «C» 🎯»), 4+ — без имён («Не забудь отметить 4 цели за сегодня 🎯», склонение цель/цели/целей). Группировка по `user_id` в `sendNotificationTimeReminders`.

5. **Запись в групповой count-цели** (`notifyEntryAdded`, при `POST /habits/:id/logs` для `type='group' AND checkin_type='count'`)
   - Когда: при КАЖДОЙ записи (не только при пересечении `goal_value` — у безлимитной цели его нет), см. [[feature-group-count-goal]]
   - Кому: всем остальным участникам группы
   - Текст: заголовок — название цели, тело «{Имя} добавил отметку о выполнении цели «{название}». За всё время: {N}» (N — сумма участника за всю историю цели)
   - Тап → переход на экран цели

**How to apply:** при добавлении нового типа пуша — класть текст/адресацию в `backend/src/push/notify.js` (транспорт через `fcm.js` не трогать), указывать `data.habitId` если нужен переход по тапу, и не забывать проверку `habit.notifications` перед отправкой.
