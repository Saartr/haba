import { View, Pressable, ViewStyle } from 'react-native';
import Text from '@/components/Text';
import { useColors, colors } from '@/lib/colors';

const SHADOW = {
  shadowColor: '#121212',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

export type DropdownMenuItem = {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  items: DropdownMenuItem[];
  style?: ViewStyle;
};

export default function DropdownMenu({ items, style }: Props) {
  const c = useColors();

  return (
    <View style={[{
      backgroundColor: c.surface.input,
      borderRadius: 24,
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 4,
      minWidth: 200,
      ...SHADOW,
    }, style]}>
      {items.map((item, index) => (
        <Pressable
          key={index}
          onPress={item.onPress}
          android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 58,
          }}>
            <Text
              weight="semibold"
              style={{
                fontSize: 16,
                lineHeight: 16 * 1.6,
                letterSpacing: 0.2,
                color: item.destructive ? colors.red[500] : c.text.secondary,
              }}
            >
              {item.label}
            </Text>
            {item.icon && (
              <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                {item.icon}
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
