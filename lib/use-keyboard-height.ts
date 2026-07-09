import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// Высота открытой клавиатуры (0 — скрыта). Окно на Android (edge-to-edge) само не
// ресайзится под клавиатуру — экраны с инпутами добавляют paddingBottom на контейнер,
// чтобы поле ввода и нижняя кнопка не прятались под клавиатурой. Тот же приём, что
// в BottomSheet (см. components/BottomSheet.tsx).
export function useKeyboardHeight(enabled: boolean = true): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [enabled]);

  return height;
}

// Зазор между верхним краем клавиатуры и нижней кнопкой.
const KEYBOARD_GAP = 16;

// paddingBottom для экранов вида «SafeAreaView(edges=['bottom']) → ScrollView → футер
// с кнопкой (paddingBottom: 24)». Клавиатура на Android встаёт НАД системным навбаром —
// той же зоной, которую компенсирует SafeAreaView, поэтому inset не вычитаем. Вычитаем
// собственный отступ футера (иначе он превращается в лишнюю полосу фона под кнопкой)
// и добавляем небольшой зазор до клавиатуры.
export function useKeyboardPadding(footerPadding: number = 24): number {
  const kbHeight = useKeyboardHeight();
  return kbHeight > 0 ? Math.max(0, kbHeight - footerPadding + KEYBOARD_GAP) : 0;
}
