---
name: project-main-screen
description: "Главный экран (tabs/index.tsx) — верстка завершена, empty state, аватар, имя"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Главный экран `app/(tabs)/index.tsx` реализован как per Figma (node 640-2113).

**Why:** Первый экран после авторизации. Показывает приветствие, список привычек и две кнопки действий внизу.

**Что реализовано:**
- Верхняя шторка: «Привет,» (text.secondary) + displayName (text.primary), оба 20px Bold
- displayName = first_name ?? username, обрезается до 12 символов с «…»
- Аватар: 40px круг — фото из Telegram или инициал First Name (neutral[50] фон, обводка neutral[500])
- Тап по аватару → навигация на `/(tabs)/two` (профиль)
- StatusBar `backgroundColor` совпадает с цветом шторки (нет разрыва под статусбаром)
- Шторка с `borderBottomLeftRadius: 32` и тенью (только в light)
- Загрузка привычек: `useFocusEffect` → `getHabits()` из `lib/api`, ActivityIndicator в loading
- Empty state: маскот `tapa_quest.png` (171×224) + «Нет активных привычек» (если `habits.length === 0`)
- Список: FlatList с `HabitCard` (округлый, тень, имя + цель)
- Тап по карточке → `/(tabs)/habit/[id]`
- Внизу две кнопки 50/50: «Добавить» (Plus, → `/(tabs)/create-habit`) и «Вступить» (GroupPlus, `onPress={() => {}}` — пока заглушка)
- Таб-бар полностью убран, навигация только через Stack

**How to apply:** Кнопка «Вступить» — следующий шаг (присоединение к групповой привычке по invite-коду через `habits.invite_code`).
