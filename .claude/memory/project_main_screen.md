---
name: project-main-screen
description: "Главный экран (tabs/index.tsx) — верстка завершена, empty state, аватар, имя"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Главный экран `app/(tabs)/index.tsx` реализован как per Figma (node 640-2113).

**Why:** Первый экран после авторизации. Показывает приветствие, список привычек и FAB-кнопку действий внизу справа.

**Что реализовано:**
- Верхняя шторка: «Привет,» (text.secondary) + displayName (text.primary), оба 20px Bold
- displayName = first_name ?? username, обрезается до 12 символов с «…»
- Аватар: 40px круг — фото из Telegram или инициал First Name (neutral[50] фон, обводка neutral[500])
- Тап по аватару → навигация на `/(tabs)/profile` (не `/two`, маршрут переименован)
- StatusBar `backgroundColor` совпадает с цветом шторки (нет разрыва под статусбаром)
- Шторка с `borderBottomLeftRadius: 32` и тенью (только в light)
- Загрузка привычек: `useFocusEffect` → `getHabits()` из `lib/api`, ActivityIndicator в loading
- Empty state: маскот `assets/images/chill.svg` (не `tapa_quest.png`) + «Нет активных привычек» (если `habits.length === 0`)
- Список: FlatList с `HabitCard` (округлый, тень, имя + цель)
- Тап по карточке → `/(tabs)/habit/[id]`
- FAB справа внизу (`components/Fab.tsx`): круглая кнопка с плюсом, по тапу разворачивается dropdown-меню «Создать привычку» (→ `/(tabs)/create-habit`) и «Вступить в группу» — **реализовано** (не заглушка): открывает BottomSheet с полем ввода кода/ссылки, по сабмиту `joinHabit(code)`, успех → навигация на привычку + снэкбар «Вы вступили в группу», ошибка → текст ошибки в шите
- Таб-бар полностью убран, навигация только через Stack

**Fab.tsx:** один инстанс кнопки. Плюс плавно поворачивается в крестик (Animated rotate 0→45°). Fullscreen-overlay с fade-in, закрытие по тапу вне меню и по системной кнопке «назад» (`BackHandler`). Не использует `Modal` — overlay растянут через `position:absolute` с большими отрицательными offset'ами, т.к. компонент сидит в угловой absolute-обёртке. Цвет кнопки при нажатии не меняется (по требованию).
