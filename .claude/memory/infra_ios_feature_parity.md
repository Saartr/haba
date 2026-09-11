---
name: infra-ios-feature-parity
description: "Что на iOS ещё не перенесено: инвентарь платформенных веток, приоритеты и чем каждое заблокировано"
metadata:
  type: project
---

Цель, поставленная 2026-09-08: **сначала перенести весь функционал на iOS, потом чинить
баги — от критичных к некритичным**. Это инвентарь того, что осталось.

Статус самой платформы — в [[infra-ios-plan]]: приложение уже работает на живом iPhone
через Expo Go, вход через Яндекс проходит.

## Инвентарь: 21 платформенная ветка в 12 файлах

Найдено `grep -rn "Platform.OS === 'android'\|Platform.OS !== 'android'" app components lib modules`.
Разбивка по смыслу:

### 1. Пуш-уведомления — 6 веток
`lib/notifications.ts` (4), `app/_layout.tsx` (регистрация токена),
`app/(tabs)/habit/[id].tsx` (слушатель уведомлений).

Бэкенд шлёт FCM HTTP v1, а он умеет и iOS. То есть серверная часть готова, нужен только
APNs-ключ и снятие платформенных проверок.
**Блокирует:** Apple Developer Account (APNs-ключ выдаётся только там). В Expo Go проверить
нельзя в принципе.

### 2. Шаги и фоновый синк — 10 веток
`lib/health.ts`, `modules/health-sync/index.ts`, `app/_layout.tsx` (2: планирование синка и
синк при возврате из фона), `app/(tabs)/app-settings.tsx`, `app/(tabs)/habit/[id].tsx` (2),
`app/(tabs)/preset-habits.tsx`, `app/(tabs)/profile.tsx`,
`components/habit-screens/GroupHabitScreen.tsx` (там честная заглушка: «Подключение трекера
на iOS пока недоступно»).

Нужен HealthKit вместо Health Connect и `HKObserverQuery` + background delivery вместо
WorkManager (прямого аналога у iOS нет: `BGTaskScheduler` запускается когда система сочтёт
нужным). Бэкенд уже принимает `source: 'healthkit'`.
**Блокирует:** Apple Developer Account (HealthKit — это entitlement). В Expo Go тоже не
проверить: нативного модуля там нет.

### 3. Вход через VK — ✅ СДЕЛАНО 2026-09-09
`modules/vk-id/index.ios.ts`, кнопка в `app/(auth)/welcome.tsx` — на обеих платформах,
на iOS ветка `signInWithVKCode` → `POST /auth/vk/web`.

Приём тот же, что у Яндекса: системная веб-сессия + PKCE, без нативного SDK. Понадобилось
отдельное веб-приложение в консоли VK (`54761714`): платформа у существующего (`54615454`)
зафиксирована как Android, и redirect туда вписать некуда. Его ключи на сервере —
`VK_WEB_CLIENT_ID` / `VK_WEB_CLIENT_SECRET` / `VK_WEB_SERVICE_TOKEN` в `.env`.
На аккаунты это не влияет: `vk_id` пользователя один во всех приложениях VK.
Проверено на живом iPhone, подробности — [[feature-auth]], раздел «Вход через VK на iOS».

### 4. Не функционал, а осознанная разница вёрстки — 1 ветка
`components/BottomSheet.tsx`: `Platform.OS === 'android' ? insets.bottom : 0`. Трогать не надо.

## Порядок, вытекающий из блокировок

1. ~~VK ID~~ — сделано 2026-09-09
2. **Всё оставшееся упирается в Apple Developer Account** ($99/год, оплата из РФ — отдельный
   вопрос). Пока его нет, пуши и шаги на iOS не сделать и не проверить даже частично
3. Графические баги — после переноса функционала, по договорённости

## Известные графические баги

Пользователь бегло посмотрел на iPhone и заметил «пару графических багов», подробности не
называл. Ожидаемые кандидаты (проверить, когда дойдут руки): тени (`elevation` на Android
против `shadow*` на iOS — Toolbar, Fab, Snackbar, бегунок SegmentedControl), safe area на
устройствах с вырезом (на главном экране инсеты расставлены вручную), клавиатура на экранах
форм (`useKeyboardPadding` — хак под android edge-to-edge, см. [[ui-keyboard]]).
