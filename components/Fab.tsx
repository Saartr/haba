import { View, Pressable, Animated, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useRef, useEffect } from 'react';
import { useSettings } from '@/lib/settings-context';
import { useColors, colors } from '@/lib/colors';
import DropdownMenu, { DropdownMenuItem } from '@/components/DropdownMenu';
import PlusIcon from '@/assets/icons/Plus.svg';

const SHADOW = {
  shadowColor: colors.neutral[950],
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
} as const;

type Props = {
  items: DropdownMenuItem[];
};

export default function Fab({ items }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const overlayColor = colorScheme === 'dark' ? colors.blackTransparent[80] : colors.blackTransparent[24];
  const anim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  function handleItemPress(item: DropdownMenuItem) {
    setOpen(false);
    item.onPress();
  }

  return (
    <>
      {/* Fullscreen overlay behind the FAB */}
      {mounted && (
        <Animated.View
          style={{
            position: 'absolute',
            top: -9999, left: -9999, right: -9999, bottom: -9999,
            backgroundColor: overlayColor,
            opacity: overlayAnim,
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={() => setOpen(false)} />
        </Animated.View>
      )}

      {/* Dropdown menu */}
      {mounted && (
        <Animated.View
          style={{
            position: 'absolute',
            right: 0,
            bottom: 56 + 16,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
          }}
        >
          <DropdownMenu
            items={items.map(item => ({ ...item, onPress: () => handleItemPress(item) }))}
            style={{ width: 360, elevation: 0 }}
          />
        </Animated.View>
      )}

      {/* Single FAB button instance */}
      <Pressable onPress={() => setOpen(o => !o)} style={{ height: 56 }}>
        <View style={{
          width: 56,
          height: 56,
          borderRadius: 24,
          backgroundColor: c.brand.primary,
          alignItems: 'center',
          justifyContent: 'center',
          ...SHADOW,
        }}>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <PlusIcon width={24} height={24} color={colors.neutral[0]} />
          </Animated.View>
        </View>
      </Pressable>
    </>
  );
}
