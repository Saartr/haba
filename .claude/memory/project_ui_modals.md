---
name: project-ui-modals
description: "Модалки и меню — BottomSheet, ConfirmModal/useConfirm, DropdownPopover: общие конвенции анимации и оверлея"
metadata:
  type: project
---

Восстановлено 2026-06-20 после порчи файла (содержимое было потеряно, кроме обрывка «мо») — переписано по актуальному коду `components/`.

**Why:** Все модалки/меню в проекте построены на одном паттерне (`Modal` + кастомная `Animated`-анимация), а не на встроенной анимации `react-native`'s `Modal` — чтобы анимации открытия/закрытия были одинаковыми везде и не дёргались при сворачивании клавиатуры.

## Общие конвенции (BottomSheet и DropdownPopover)

- `<Modal transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>` — `animationType="none"`, анимация ручная через `Animated.Value`
- `mounted` стейт отдельно от `visible` — при `visible=false` сначала доигрывается анимация скрытия (200мс), потом `setMounted(false)` и `Modal` реально размонтируется
- Оверлей: `colors.blackTransparent[80]` (тёмная тема) / `colors.blackTransparent[24]` (светлая) — через `useSettings().colorScheme`, см. [[feedback_design_system_usage]]
- Закрытие: тап на оверлей (`Pressable` поверх) + системная кнопка «назад» (`onRequestClose`)
- Длительность анимации — 200мс на появление и скрытие контента; у `DropdownPopover` оверлей появляется медленнее (500мс) при открытии
- `elevation: 0` на Android, чтобы не было системной тени поверх кастомной

## `components/BottomSheet.tsx`

Шторка снизу. Props: `visible`, `title?` (если не передан — без шапки с крестиком), `onClose`, `children`.
- Анимация: `translateY` 32→0 + fade
- Учитывает клавиатуру: слушает `keyboardWillShow/Hide` (iOS) / `keyboardDidShow/Hide` (Android), поднимает шторку через `paddingBottom` (не `transform`, чтобы не конфликтовать с анимацией появления)
- `borderTopLeftRadius/borderTopRightRadius: 24`, фон `c.surface.input`

## `components/ConfirmModal.tsx` — `useConfirm()` / `ConfirmProvider`

Не отдельный модальный примитив, а обёртка над `BottomSheet`: контекст + хук `useConfirm()`, возвращающий `confirm(options) => Promise<boolean>` (resolve по нажатию кнопки или закрытию шторки).

`ConfirmOptions`: `title`, `description?`, `confirmLabel?` (default «Подтвердить»), `confirmIcon?` (default — галочка `Check.svg`), `destructive?` (красная кнопка `c.semantic.error` вместо `c.brand.primary` — для удаления/выхода).

**How to apply:** для любого диалога подтверждения — `const confirm = useConfirm(); const ok = await confirm({ title, description, destructive: true })`, не писать кастомный `Modal`/`Alert.alert` вручную.

## `components/DropdownPopover.tsx`

Полноэкранный оверлей + позиционированное меню (по умолчанию `top: insets.top + 56, right: 24`, ширина 320). Рендерит `components/DropdownMenu.tsx` (`DropdownMenuItem[]`) внутри.

Каждый `item.onPress` оборачивается: сначала `onClose()`, потом сам `onPress` — меню гарантированно закрывается до выполнения действия (так и используется «⋮»-меню в `habit/[id].tsx`: Редактировать/Удалить).

**How to apply:** для контекстных меню («⋮», dropdown-кнопки) — `DropdownPopover` + `DropdownMenuItem[]`, не кастомный `Pressable`-список вручную.
