import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '@/lib/settings-context';
import { colors } from '@/lib/colors';
import DropdownMenu, { DropdownMenuItem } from '@/components/DropdownMenu';

type Props = {
  visible: boolean;
  onClose: () => void;
  items: DropdownMenuItem[];
  /** Ширина меню. По умолчанию 320. */
  width?: number;
};

export default function DropdownPopover({ visible, onClose, items, width = 320 }: Props) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const overlayColor = colorScheme === 'dark' ? colors.blackTransparent[80] : colors.blackTransparent[24];
  const [mounted, setMounted] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);

  const anim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      Animated.timing(overlayAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(
        () => {
          setMounted(false);
          // Действие (например, навигация) запускается только после того, как Modal
          // реально размонтирован — иначе на Fabric/Android гонка между закрытием
          // Modal и пушем нового экрана даёт "addViewAt: ...already has a parent".
          if (pendingAction.current) {
            const action = pendingAction.current;
            pendingAction.current = null;
            action();
          }
        },
      );
    }
  }, [visible]);

  // closing items wrap onPress так, чтобы меню закрылось, а действие выполнилось
  // уже после того, как Modal закрытия полностью размонтируется.
  const wrapped = items.map((item) => ({
    ...item,
    onPress: () => {
      pendingAction.current = item.onPress;
      onClose();
    },
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, backgroundColor: overlayColor, opacity: overlayAnim }}>
          <Pressable style={{ flex: 1 }} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={{
            position: 'absolute',
            top: insets.top + 56,
            right: 24,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
          }}
        >
          {visible && <DropdownMenu items={wrapped} style={{ width, elevation: 0 }} />}
        </Animated.View>
      </View>
    </Modal>
  );
}
