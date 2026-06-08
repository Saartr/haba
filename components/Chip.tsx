import { Pressable, View, ViewStyle, StyleProp } from 'react-native';
import Text from '@/components/Text';
import { useColors } from '@/lib/colors';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

// Чип-пилюля (фильтр периода и т.п.). Два состояния: selected / default.
// Цвета семантические (useColors) — корректны в светлой и тёмной теме.
// Фон вешаем на вложенный View (как в Button) — на самом Pressable в Fabric не прокрашивается.
export default function Chip({ label, selected = false, onPress, style }: Props) {
  const c = useColors();
  const bg = selected ? c.brand.primary : c.surface.cardGrey;
  const fg = selected ? c.text.onPrimary : c.text.secondary;

  return (
    <Pressable onPress={onPress} style={[{ alignSelf: 'flex-start' }, style]}>
      {({ pressed }) => (
        <View style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 100,
          backgroundColor: bg,
          opacity: pressed ? 0.85 : 1,
          // @ts-ignore
          borderCurve: 'continuous',
        }}>
          <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, color: fg }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
