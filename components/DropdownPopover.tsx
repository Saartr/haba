import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '@/lib/settings-context';
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
  const overlayColor = colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(18,18,18,0.24)';
  const [mounted, setMounted] = useState(false);

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
        () => setMounted(false),
      );
    }
  }, [visible]);

  // closing items wrap onPress so the menu closes before the action fires
  const wrapped = items.map((item) => ({ ...item, onPress: () => { onClose(); item.onPress(); } }));

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
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
        <DropdownMenu items={wrapped} style={{ width, elevation: 0 }} />
      </Animated.View>
    </Modal>
  );
}
