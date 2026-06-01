import { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, Animated } from 'react-native';
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

  const anim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => setMounted(false),
      );
    }
  }, [visible]);

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
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
            paddingBottom: insets.bottom + 56,
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
