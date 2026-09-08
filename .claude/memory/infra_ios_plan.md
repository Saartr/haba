---
name: infra-ios-plan
description: "iOS — постоянное направление: что уже работает, чем заблокировано, как собирать без Mac"
metadata:
  type: project
---

iOS — **постоянное направление**, а не разовый эксперимент (решение пользователя 2026-08-31).
Не путать с веб-версией, которая остаётся пробой гипотезы ([[rules-web-scope]]).

## Что уже сделано (2026-08-31)

- Проект связан с EAS: `@saartr/tapa`, `projectId` в `app.json`
- `ios.bundleIdentifier = pro.mihmih.haba` — тот же, что package на Android
- В `eas.json` профиль `simulator` (`ios.simulator: true`) — такой сборке **не нужны учётные
  данные Apple**, собирается без Developer Account
- **Сборка под симулятор прошла с первого раза**, без единой правки нативного кода.
  В собранном `.app` проверено: `VkIdModule`, `YandexIdModule`, `HealthSync`, `HealthConnect`
  отсутствуют (все три модуля объявлены `platforms: ["android"]`, плагины трогают только
  Android, у health-connect нет podspec), а `ExpoSecureStore`/`ExpoNotifications`/`RNSVG`
  слинкованы. Схема `haba://` в iOS-сборке зарегистрирована.
- **Вход через Яндекс на iOS реализован** — `modules/yandex-id/index.ios.ts`, тот же
  authorization code + PKCE, что на вебе, но через `ASWebAuthenticationSession`
  (`expo-web-browser`). Возврат в приложение — через страницу callback, которая по префиксу
  `app.` в `state` перебрасывает на `haba://auth/yandex/callback`; отдельный Redirect URI в
  консоли Яндекса не понадобился, Universal Links (и платный Apple-аккаунт) — тоже.

## Чего на iOS нет и почему

VK ID, импорт шагов и фоновый синк. Всё это можно добавить позже — архитектура не мешает,
бэкенд уже принимает `source: 'healthkit'`. Подробности и оценки — в разговоре 2026-08-31:
HealthKit ≈ неделя, фоновая доставка через `HKObserverQuery` ≈ полторы (BGTaskScheduler
аналогом WorkManager не является), VK ID требует **отдельного приложения в консоли** со
своими ключами, потому что платформа у приложения фиксируется при создании.

## Чем заблокировано

1. **Apple Developer Account $99/год.** Без него нельзя: поставить на реальный айфон,
   entitlements (HealthKit), APNs-ключ для пушей, TestFlight, App Store. Оплата из РФ —
   отдельный вопрос.
2. **На iOS нет запасного канала.** У Android их два (RuStore + APK с сайта), на iOS только
   App Store: не прошли ревью — версии нет.

## Как смотреть приложение без Mac

- **Expo Go — НЕ работает**: он поддерживает только последний SDK. На телефоне 57, у нас 55,
  старую версию Expo Go на iOS не поставить. Это и стало поводом планировать
  [[infra-sdk57-upgrade]].
- **EAS Simulator** (облачный симулятор, гоняется прямо из CLI) — `simulator:availability`
  вернул `available: false`, аккаунт в листе ожидания: https://expo.dev/services/simulators
- **Appetize.io** — залить собранный `.app` и открыть в браузере, бесплатный тариф есть
- `expo prebuild --platform ios` на Windows не работает — проект собирают macOS-воркеры EAS
