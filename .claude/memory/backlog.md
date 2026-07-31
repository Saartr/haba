---
name: backlog
description: Функциональность, которую нужно реализовать позже (решение принято, реализация отложена); известные баги на исправление
metadata:
  type: project
---

## Известные баги (решение принято, чинить позже)

### HabitCard на главном экране: карточки «Шаги» показывают стрик вместо «Шагов за сегодня»
**Файл (актуально на 2026-07-31):** `lib/habit-status.ts`, функция `computeHabitStatus()` (тернарники `subtitle` и `value`). Логика переехала сюда из `index.tsx`/`HabitCard` при рефакторинге `177db44` («распил экрана цели» + общий `lib/habit-status.ts`) — старый путь к файлу устарел, баг актуален, ветки те же.

**Причина:** `checkin_type` в БД ограничен CHECK-constraint тремя значениями (`'boolean'|'count'|'progression'`). Ветки `isBoolean`/`isProgression`/`isCount` покрывают их все — значит финальная ветка `: 'Шагов за сегодня'` (и аналогичная в `value`: `` `${todayVal}/${habit.goal_value ?? 0}` ``) **никогда не выполняется**, это мёртвый код.

Пресеты категории «Шаги» создаются через `preset-habits.tsx`, который **не передаёт `checkin_type`** в `createHabit()` → бэкенд (`backend/src/api/habits.js:110`, `${checkin_type ?? 'boolean'}`) подставляет дефолт `'boolean'`. Из-за этого `isBoolean === true` для «Шагов», и подпись/значение карточки берутся из ветки для обычных boolean-целей: подпись «Текущий стрик» вместо «Шагов за сегодня», значение — голое число стрика вместо `2000/3000`.

При этом `done` (довольный/недовольный Тапа) в этой же ветке всё ещё сравнивает `todayVal` с `goal_value` — то есть аватар считается по шагам, а текст рядом показывает стрик. Несостыковка видна прямо на карточке.

**Как чинить:** добавить `habit.category === 'steps'` явной проверкой ПЕРЕД `isBoolean` в обеих ветках (`subtitle` и `value`) — по аналогии с тем, как уже приоритетно проверяются `smoking`/`pullups`.

**How to apply:** при следующей работе с `index.tsx`/`HabitCard` — исправить эту ветку, если пользователь попросит вернуться к багу.

## Отложенные фичи (решения приняты)

### expo-clipboard — подключить при следующей пересборке APK
`Clipboard` из `react-native` deprecated. `expo-clipboard` установлен (`npm install` выполнен), но нативный модуль `ExpoClipboard` требует `prebuild`.
**Что нужно:** при следующем `npx expo prebuild --platform android --clean`:
1. В `app/(tabs)/habit/[id].tsx` заменить `import { Clipboard } from 'react-native'` → `import * as Clipboard from 'expo-clipboard'`
2. Заменить `Clipboard.setString(...)` → `Clipboard.setStringAsync(...)`
**Файл:** `app/(tabs)/habit/[id].tsx:14` и `:747` (номера строк сдвигаются по мере правок файла — искать по `import { Clipboard } from 'react-native'` и `Clipboard.setString`)

