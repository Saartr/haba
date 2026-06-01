import { View } from 'react-native';
import Text from '@/components/Text';

type Variant = 'group' | 'solo';

const CONFIG: Record<Variant, { bg: string; color: string; label: string }> = {
  group: { bg: '#E0DBFF', color: '#6047FF', label: 'ГРУППОВАЯ' },
  solo:  { bg: '#FEF9C3', color: '#CA8A04', label: 'ПЕРСОНАЛЬНАЯ' },
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
