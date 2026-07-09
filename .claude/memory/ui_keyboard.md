---
name: ui-keyboard
description: Клавиатура на Android edge-to-edge не ресайзит окно — useKeyboardPadding + «парящая» кнопка на экранах форм
metadata:
  type: project
---

**Проблема:** Expo SDK 55 всегда включает edge-to-edge на Android — окно НЕ ресайзится под клавиатуру, несмотря на `adjustResize` в манифесте (проверено uiautomator-дампом: корень остаётся на всю высоту экрана). Клавиатура просто накрывает контент: сфокусированный инпут и нижняя кнопка прятались под ней, системный автоскролл «показать сфокусированный инпут» не срабатывает (он работает только при реальном resize).

**Решение — `lib/use-keyboard-height.ts`:**
- `useKeyboardHeight()` — высота клавиатуры через `Keyboard.addListener` (iOS `keyboardWillShow`, Android `keyboardDidShow`); тот же паттерн, что внутри `BottomSheet` (тот свою копию сохраняет — у него свой тайминг сброса при анимации закрытия, не трогать)
- `useKeyboardPadding(footerPadding = 24)` — готовый `paddingBottom` для экранов вида «SafeAreaView(edges=['bottom']) → ScrollView → футер с кнопкой (paddingBottom: 24)»: `kbHeight - footerPadding + 16` (зазор до клавиатуры). **insets.bottom НЕ вычитать** — клавиатура на Android встаёт НАД системным навбаром, той же зоной, которую компенсирует SafeAreaView (проверено пиксельным замером скриншота: итоговый зазор ровно 16dp)

**«Парящая» кнопка** (одобрено пользователем после итераций): ScrollView заезжает под футер (`style={{ marginBottom: -80 }}` = кнопка 56 + отступ 24), контенту `paddingBottom: 104`, футер `pointerEvents="box-none"` — контент виден и скроллится вокруг/за кнопкой, без слоя-«подложки», обрезавшего контент по краю ScrollView.

**Применено на:** `custom-habit/step1-3`, `preset-habits`, `edit-habit/[id]`.

**How to apply:** новый экран «форма + кнопка снизу» — использовать этот же трио-паттерн (`useKeyboardPadding` на SafeAreaView + отрицательный margin у ScrollView + box-none футер). Не пытаться чинить через KeyboardAvoidingView behavior='height' или вычитание insets — оба пути уже проверены и дают полосу фона/перекрытие. Для полноценного автоскролла сфокусированного инпута под клавиатуру есть `react-native-keyboard-controller` (рекомендация Expo, нужен prebuild) — пока не ставили.
