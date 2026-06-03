import { View, ViewStyle } from 'react-native';
import { useColors, colors } from '@/lib/colors';

const SHADOW = {
  shadowColor: colors.neutral[950],
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 6,
  elevation: 3,
} as const;

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function Card({ children, style }: Props) {
  const c = useColors();

  return (
    <View style={[{
      backgroundColor: c.surface.input,
      borderRadius: 32,
      paddingVertical: 16,
      paddingHorizontal: 24,
      gap: 16,
      ...SHADOW,
    }, style]}>
      {children}
    </View>
  );
}
