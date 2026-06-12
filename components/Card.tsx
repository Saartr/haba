import { View, ViewStyle } from 'react-native';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';

// Общая тень карточек (стиль панелей Telegram Desktop): широкий блюр, малое смещение.
// Используется в Card и Lists через useCardShadow, чтобы тени не расходились.
// На Android вид определяет elevation, на iOS — shadow* параметры.
// Цвет зависит от темы: светлая — neutral[300]; тёмная — neutral[900].
export function useCardShadow() {
  const { colorScheme } = useSettings();
  return {
    shadowColor: colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[300],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  } as const;
}

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function Card({ children, style }: Props) {
  const c = useColors();
  const shadow = useCardShadow();

  return (
    <View style={[{
      backgroundColor: c.surface.input,
      borderRadius: 32,
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 16,
      ...shadow,
    }, style]}>
      {children}
    </View>
  );
}
