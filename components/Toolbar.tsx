import { View } from 'react-native';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import IconButton from '@/components/IconButton';
import Fab from '@/components/Fab';
import { DropdownMenuItem } from '@/components/DropdownMenu';

// Тень простыни под списком целей (index.tsx). В светлой теме — та же тень, что у самого
// Toolbar (neutral[300], offset{0,4}, opacity 0.17, radius 10, elevation 10), в тёмной — 0.7
// с neutral[950] (подложка всё равно контрастирует с фоном, тень не отключаем как у Toolbar).
export function useToolbarShadow() {
  const { colorScheme } = useSettings();
  const isDark = colorScheme === 'dark';
  if (isDark) {
    return {
      shadowColor: colors.neutral[950],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.7,
      shadowRadius: 10,
      elevation: 10,
    } as const;
  }
  return {
    shadowColor: colors.neutral[300],
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.17,
    shadowRadius: 10,
    elevation: 10,
  } as const;
}

// Тень самого Toolbar. В светлой теме — точно та же тень, что раньше была у карточек
// (Card.tsx до удаления теней): neutral[300], offset{0,4}, opacity 0.2, radius 10, elevation 10.
// В тёмной — отключена (elevation:0) по требованию: Toolbar маленький, на тёмном фоне не нужна.
function useToolbarOwnShadow() {
  const { colorScheme } = useSettings();
  const isDark = colorScheme === 'dark';
  if (isDark) {
    return {
      shadowColor: colors.neutral[950],
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0,
      shadowRadius: 10,
      elevation: 0,
    } as const;
  }
  return {
    shadowColor: colors.neutral[400],
    shadowOffset: { width: -10, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
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
  const { colorScheme } = useSettings();
  const shadow = useToolbarOwnShadow();
  const backgroundColor = colorScheme === 'dark' ? colors.neutral[800] : c.surface.default;

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor,
      ...shadow,
    }}>
      <IconButton icon={icon} onPress={onIconPress} disabled={iconDisabled} />
      <Fab size="S" items={fabItems} shadow={false} />
    </View>
  );
}
