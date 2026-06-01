import { View, Pressable, Modal, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/lib/settings-context';
import { useColors, colors } from '@/lib/colors';
import DropdownMenu, { DropdownMenuItem } from '@/components/DropdownMenu';
import PlusIcon from '@/assets/icons/Plus.svg';

const SHADOW = {
  shadowColor: '#121212',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
} as const;

type Props = {
  items: DropdownMenuItem[];
};

function FabButton({ open, onPress }: { open: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={{ height: 56 }}>
      {({ pressed }) => (
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 24,
          backgroundColor: pressed ? c.brand.pressed : c.brand.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...SHADOW,
        }}>
          <View style={{ transform: [{ rotate: open ? '45deg' : '0deg' }] }}>
            <PlusIcon width={24} height={24} color={colors.neutral[0]} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

export default function Fab({ items }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const overlayColor = colorScheme === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(18,18,18,0.24)';
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [open]);

  function handleItemPress(item: DropdownMenuItem) {
    setOpen(false);
    item.onPress();
  }

  return (
    <>
      <View style={{ opacity: open ? 0 : 1 }} pointerEvents={open ? 'none' : 'auto'}>
        <FabButton open={false} onPress={() => setOpen(true)} />
      </View>

      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Animated.View style={{ flex: 1, backgroundColor: overlayColor, opacity: anim }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)} />

          <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 24, gap: 16, alignItems: 'flex-end' }}>
            <Animated.View style={{
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }}>
              <DropdownMenu
                items={items.map(item => ({ ...item, onPress: () => handleItemPress(item) }))}
                style={{ width: 360 }}
              />
            </Animated.View>
            <FabButton open={open} onPress={() => setOpen(false)} />
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}
