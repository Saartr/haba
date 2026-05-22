---
name: project-main-screen
description: "Главный экран (tabs/index.tsx) — верстка завершена, empty state, аватар, имя"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f334f79-b33a-4bdb-b852-d3bff627bebf
---

Главный экран `app/(tabs)/index.tsx` реализован как per Figma (node 640-2113).

**Why:** Первый экран после авторизации. Показывает приветствие и empty state пока нет привычек.

**Что реализовано:**
- Верхняя шторка: «Привет,» (text.secondary) + displayName (text.primary), оба 20px Bold
- displayName = first_name ?? username, обрезается до 12 символов с «…»
- Аватар: 40px круг — фото из Telegram или инициал First Name (neutral[200] фон)
- Тап по аватару → навигация на `/(tabs)/two` (профиль)
- StatusBar `backgroundColor` совпадает с цветом шторки (нет разрыва под статусбаром)
- Шторка расширяется под статусбар через `useSafeAreaInsets` + `paddingTop: insets.top + 16`
- Empty state: маскот `tapa_quest.png` (171×224) + текст «Нет активных привычек» + кнопка «Добавить»
- Иконка + в кнопке: `Plus.svg` с `fill="currentColor"`, цвет `c.icon.onPrimary`
- Таб-бар полностью убран, навигация только через Stack

**How to apply:** Следующий шаг — функциональность «Добавить привычку» (сейчас `onPress={() => {}}`).
