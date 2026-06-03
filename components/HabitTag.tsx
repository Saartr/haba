import { View } from 'react-native';
import Text from '@/components/Text';
import { colors } from '@/lib/colors';

type Variant = 'group' | 'solo';

const CONFIG: Record<Variant, { bg: string; color: string; label: string }> = {
  group: { bg: colors.purple[100], color: colors.purple[500], label: 'ГРУППОВАЯ' },
  solo:  { bg: colors.yellow[100], color: colors.yellow[600], label: 'ПЕРСОНАЛЬНАЯ' },
};

type Props = {
  type: Variant;
};

export default function HabitTag({ type }: Props) {
  const { bg, color, label } = CONFIG[type];

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
