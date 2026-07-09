import { View } from 'react-native';
import Text from '@/components/Text';
import { colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';

type Variant = 'group' | 'solo' | 'skip' | 'failed' | 'done';

type TagStyle = { bg: string; color: string; label: string };

const LIGHT_CONFIG: Record<Variant, TagStyle> = {
  group:  { bg: colors.purple[100], color: colors.purple[500], label: 'ГРУППОВАЯ' },
  solo:   { bg: colors.yellow[100], color: colors.yellow[600], label: 'ПЕРСОНАЛЬНАЯ' },
  skip:   { bg: colors.neutral[100], color: colors.neutral[600], label: 'ПРОПУСК' },
  failed: { bg: colors.red[200], color: colors.red[500], label: 'НЕ ВЫПОЛНЕНО' },
  done:   { bg: colors.green[200], color: colors.green[500], label: 'ВЫПОЛНЕНО' },
};

const DARK_CONFIG: Record<Variant, TagStyle> = {
  group:  { bg: colors.purple[900], color: colors.purple[300], label: 'ГРУППОВАЯ' },
  solo:   { bg: colors.yellow[900], color: colors.yellow[400], label: 'ПЕРСОНАЛЬНАЯ' },
  skip:   { bg: colors.neutral[700], color: colors.neutral[300], label: 'ПРОПУСК' },
  failed: { bg: colors.red[900], color: colors.red[400], label: 'НЕ ВЫПОЛНЕНО' },
  done:   { bg: colors.green[900], color: colors.green[400], label: 'ВЫПОЛНЕНО' },
};

type Props = {
  type: Variant;
};

export default function HabitTag({ type }: Props) {
  const { colorScheme } = useSettings();
  const { bg, color, label } = (colorScheme === 'dark' ? DARK_CONFIG : LIGHT_CONFIG)[type];

  return (
    <View style={{
      alignSelf: 'flex-start',
      backgroundColor: bg,
      borderRadius: 12,
      paddingVertical: 4,
      paddingHorizontal: 8,
    }}>
      <Text
        weight="bold"
        style={{
          fontSize: 12,
          lineHeight: 20,
          letterSpacing: 0.3,
          color,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
