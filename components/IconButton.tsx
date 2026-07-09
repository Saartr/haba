import { Pressable, View } from 'react-native';
import { isValidElement, cloneElement, ReactElement } from 'react';
import { useColors, colors } from '@/lib/colors';

type IconProps = { width?: number; height?: number; color?: string };

function iconWithColor(icon: React.ReactNode, color: string) {
  if (!isValidElement(icon)) return icon;
  return cloneElement(icon as ReactElement<IconProps>, { width: 24, height: 24, color });
}

type Props = {
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
};

export default function IconButton({ icon, onPress, disabled = false }: Props) {
  const c = useColors();

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      hitSlop={4}
      style={{ padding: 4 }}
    >
      {({ pressed }) => (
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed && !disabled ? colors.blackTransparent[8] : 'transparent',
        }}>
          {iconWithColor(icon, disabled ? colors.neutral[200] : c.text.secondary)}
        </View>
      )}
    </Pressable>
  );
}
