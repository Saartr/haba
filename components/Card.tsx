import { View, ViewStyle } from 'react-native';
import { useColors } from '@/lib/colors';

const SHADOW = {
  shadowColor: '#121212',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
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
