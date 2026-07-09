import { View, ViewStyle } from 'react-native';
import { useColors } from '@/lib/colors';

// Карточки и подложки — плоские, без теней (убраны по требованию в обеих темах).
// Плавающие элементы (Fab, Toolbar, Snackbar, DropdownMenu) держат свои тени сами.

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
    }, style]}>
      {children}
    </View>
  );
}
