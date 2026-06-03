---
name: feedback-design-system-usage
description: Правила использования компонентов и цветов дизайн-системы — никогда не хардкодить, всегда брать из lib/colors.ts и components/
metadata:
  type: feedback
---

При написании любого UI-кода в этом проекте обязательно:

## Цвета

- Использовать только `colors.*` из `lib/colors.ts` или семантические токены через `useColors()` из того же файла
- Никогда не хардкодить hex (`'#121212'`), rgb/rgba (`'rgba(0,0,0,0.5)'`) в стилях
- Исключение — `android_ripple` (`rgba(0,0,0,0.06/0.08)`): это системные Material-значения, в TapaDS их нет
- `shadowColor` — всегда `colors.neutral[950]`
- Оверлеи/backdrop — `colors.blackTransparent[24]` (светлая тема), `colors.blackTransparent[80]` (тёмная)
- Если нужного оттенка нет в `lib/colors.ts` — сначала добавить его туда из Figma TapaDS, потом использовать

**Why:** Аудит (2026-06-03) выявил 10+ мест с хардкодом. Все цвета уже есть в `lib/colors.ts` (полные палитры: purple, neutral, green, red, yellow, blackTransparent).

**How to apply:** Перед написанием любого `style={}` проверить — есть ли нужный цвет в `lib/colors.ts`. Если нет — запросить из Figma MCP (fileKey `TzdQy6wcvOb4yKaz3LfJVU`, переменные на node `36:2`) и добавить.

## Компоненты

Всегда использовать готовые компоненты вместо нативных RN-примитивов:

| Вместо | Использовать |
|---|---|
| `<Text>` из react-native | `<Text>` из `@/components/Text` |
| `Pressable + View + Text` для кнопки | `<Button>` из `@/components/Button` |
| Ручной `View + Pressable + ArrowBack + Text` для навбара | `<NavigationBar>` из `@/components/NavigationBar` |
| Кастомный список с `Pressable` | `<Lists>` из `@/components/Lists` |
| Кастомная карточка | `<Card>` из `@/components/Card` |
| Нативный `Clipboard.setString` | `Clipboard.setStringAsync` из `expo-clipboard` |

**Why:** Аудит выявил 6 экранов с кастомными nav bar и кнопками вместо компонентов дизайн-системы. Компоненты уже содержат правильные стили, отступы, темизацию.

**How to apply:** Перед реализацией нового экрана — просмотреть `components/` и использовать готовое. Новые компоненты — только если в `components/` нет подходящего.
