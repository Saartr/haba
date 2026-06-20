---
name: project-health-sync-plan
description: "✅ Реализовано: фоновый синк шагов через WorkManager (health-sync Expo Module)"
metadata:
  type: project
---

## Цель

Фоновый синк шагов из Health Connect через Android WorkManager — даже если пользователь не открывал приложение несколько дней.

**Why:** `useEffect` в экране привычки синкает только при открытии. Пользователь мог не заходить день-два — данные пропадут.

**How to apply:** WorkManager запускается раз в час, читает шаги за последние 7 дней, досинкает пропущенные дни на сервер напрямую (без JS).

---

## Модуль: `modules/health-sync/`

По образцу `modules/vk-id/`. New Architecture совместим (Expo Module API).

### Файлы
```
modules/health-sync/
  expo-module.config.json
  package.json
  index.ts                          ← JS: scheduleSync / cancelSync
  android/
    build.gradle                    ← зависимость work-runtime-ktx
    src/main/java/pro/mihmih/haba/healthsync/
      HealthSyncModule.kt           ← Expo Module: 3 функции
      HealthSyncWorker.kt           ← CoroutineWorker
```

### HealthSyncModule.kt — функции (фактически: saveWorkerToken, getWorkerToken, scheduleSync, syncNow, cancelSync)
- `saveWorkerToken(refreshToken: String)` — пишет в незашифрованный SharedPreferences ("health_sync_prefs", "refresh_token")
- `scheduleSync(baseUrl: String, habitIds: IntArray, startDates: ...)` — регистрирует периодическую задачу WorkManager (**интервал 6ч**, не 1ч как планировалось изначально; требует сеть, KEEP если уже есть). Принимает также `startDates` — границу даты создания привычки, чтобы не досинкать дни до создания привычки.
- `cancelSync()` — отменяет задачу по тегу "health_sync"

### HealthSyncWorker.kt — алгоритм
1. Читаем refreshToken из SharedPreferences ("health_sync_prefs", "refresh_token")
2. POST {baseUrl}/auth/refresh → свежий accessToken (если 401/нет токена → Result.success(), ждём)
3. getGrantedPermissions() → нет READ_STEPS → Result.success() (не ретраим)
4. habitIds из inputData → если пусто → Result.success()
5. Для каждого дня из окна (фактически 90 дней, не 7): aggregateRecord за день → steps > 0 → POST /habits/:id/logs/sync для каждого habitId
6. Result.success()

### Токены
- Worker читает refreshToken из `SharedPreferences("health_sync_prefs")` ключ `"refresh_token"`
- JS пишет туда через `saveWorkerToken()` при каждом `saveTokens()` в `lib/auth.ts`
- Worker сам делает refresh и использует свежий accessToken только для этой задачи (не сохраняет)

---

## JS-интеграция

### lib/auth.ts
`saveTokens()` дополнительно вызывает `HealthSyncModule.saveWorkerToken(refreshToken)`

### app/_layout.tsx
После логина:
```ts
const ids = await getStepHabitIds();
if (ids.length > 0 && await hasStepsPermission()) {
  scheduleSync(BASE_URL, ids);
} else {
  cancelSync();
}
```
При логауте: `cancelSync()`

### app/(tabs)/app-settings.tsx
При включении тоггла HC → `scheduleSync`, при выключении → `cancelSync`

### app/(tabs)/create-habit.tsx + closeHabit
После создания/закрытия step-привычки — пересчитать habitIds, перепланировать.

---

## Важные ограничения

- Worker НЕ запускается если нет step-привычек (cancelSync при отсутствии)
- Worker внутри проверяет habitIds — если пусто, сразу Result.success()
- Android Doze/Battery Saver: WorkManager гарантирует выполнение, но не точный интервал
- HC недоступен без разрешения → Worker тихо выходит Result.success()

---

## Статус реализации

Все шаги реализованы (проверено аудитом 2026-06-20):

- [x] Шаг 1: modules/health-sync/ структура (build.gradle, expo-module.config.json, package.json)
- [x] Шаг 2: HealthSyncModule.kt
- [x] Шаг 3: HealthSyncWorker.kt
- [x] Шаг 4: index.ts
- [x] Шаг 5: lib/auth.ts — saveWorkerToken при saveTokens
- [x] Шаг 6: app/_layout.tsx — scheduleSync/cancelSync
- [x] Шаг 7: app-settings.tsx — интеграция с тогглом
- [x] Шаг 8: create-habit + closeHabit — перепланирование
- [x] Шаг 9: prebuild + сборка APK + проверка
