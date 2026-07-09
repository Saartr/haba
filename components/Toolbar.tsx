import { View } from 'react-native';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import IconButton from '@/components/IconButton';
import Fab from '@/components/Fab';
import { DropdownMenuItem } from '@/components/DropdownMenu';

// Тень в Figma отличается по теме сильнее, чем у карточек: в тёмной теме не отключается
// (как у Card), а становится заметно контрастнее — opacity 0.08 → 0.48. Цвет/офсет/радиус те же.
function useToolbarShadow() {
  const { colorScheme } = useSettings();
  const isDark = colorScheme === 'dark';
  return {
    shadowColor: colors.neutral[950],
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: isDark ? 0.48 : 0.08,
    shadowRadius: 12,
    elevation: isDark ? 8 : 4,
  } as const;
}

type Props = {
  icon: React.ReactNode;
  onIconPress: () => void;
  iconDisabled?: boolean;
  fabItems: DropdownMenuItem[];
};

export default function Toolbar({ icon, onIconPress, iconDisabled, fabItems }: Props) {
  const c = useColors();
  const shadow = useToolbarShadow();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: c.surface.default,
      ...shadow,
    }}>
      <IconButton icon={icon} onPress={onIconPress} disabled={iconDisabled} />
      <Fab size="S" items={fabItems} />
    </View>
  );
}
