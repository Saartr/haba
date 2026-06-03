import { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, Animated, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '@/components/Text';
import CloseIcon from '@/assets/icons/Close.svg';
import { useColors } from '@/lib/colors';

type Props = {
  visible: boolean;
  /** Заголовок с крестиком. Если не передан — шапка не рисуется. */
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheet({ visible, title, onClose, children }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const [kbHeight, setKbHeight] = useState(0);

  const anim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      // Сбрасываем высоту клавиатуры, иначе при следующем открытии stale-значение
      // поднимет шторку в середину экрана (клавиатуры уже нет, а отступ остался).
      setKbHeight(0);
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => setMounted(false),
      );
    }
  }, [visible]);

  // Поднимаем шторку над клавиатурой через paddingBottom (не transform — чтобы не конфликтовать
  // с анимацией появления и не мигать при сворачивании клавиатуры).
  useEffect(() => {
    if (!mounted) return;
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [mounted]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          paddingBottom: kbHeight > 0 ? kbHeight + (Platform.OS === 'android' ? insets.bottom : 0) : 0,
          backgroundColor: 'rgba(18,18,18,0.24)',
          opacity: overlayAnim,
        }}
      >
        {/* tap outside closes */}
        <Pressable style={{ flex: 1 }} onPress={onClose} />

        <Animated.View
          style={{
            backgroundColor: c.surface.input,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 32,
            paddingBottom: (kbHeight > 0 ? 32 : insets.bottom + 24),
            paddingHorizontal: 24,
            gap: 32,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [32, 0] }) }],
          }}
        >
          {/* Header (опционально) */}
          {title ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text weight="bold" style={{ fontSize: 24, lineHeight: 24 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
                {title}
              </Text>
              <Pressable onPress={onClose} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                <CloseIcon width={24} height={24} color={c.text.primary} />
              </Pressable>
            </View>
          ) : null}

          {children}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
