---
name: project-pending-features
description: Функциональность, которую нужно реализовать позже (решение принято, реализация отложена)
metadata:
  type: project
---

## Отложенные фичи (решения приняты)

### expo-clipboard — подключить при следующей пересборке APK
`Clipboard` из `react-native` deprecated. `expo-clipboard` установлен (`npm install` выполнен), но нативный модуль `ExpoClipboard` требует `prebuild`.
**Что нужно:** при следующем `npx expo prebuild --platform android --clean`:
1. В `app/(tabs)/habit/[id].tsx` заменить `import { Clipboard } from 'react-native'` → `import * as Clipboard from 'expo-clipboard'`
2. Заменить `Clipboard.setString(...)` → `Clipboard.setStringAsync(...)`
**Файл:** `app/(tabs)/habit/[id].tsx:13` и `:476`

### Передать права создателя группы
Кнопка «Передать права» в меню групповой цели — сейчас `onPress: () => {}` (заглушка без фидбека).
**Что нужно:** экран/шторка выбора участника → `POST /habits/:id/transfer`.
**Файл:** `app/(tabs)/habit/[id].tsx`, `DropdownPopover` items, `transferHabit` в `lib/api.ts` уже есть.

### Редактировать привычку
Кнопка «Редактировать» в solo-меню — заглушка.
**Что нужно:** `PATCH /habits/:id` на бэкенде (нет), экран редактирования на фронте.
**Файл:** `backend/src/api/habits.js` (нет маршрута), `app/(tabs)/habit/[id].tsx`.

### Уведомления — реальные push
Тоггл «Уведомления» в настройках сохраняет значение, но push-уведомления не подключены. Тоггл сейчас `disabled`.
**Что нужно:** Expo Notifications + сервер-сайд рассылка (или node-cron дайджест).
