import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import { useColors, colors } from '@/lib/colors';

type Option = { label: string; value: string };

type Props = {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function SegmentedControl({ label, options, value, onChange, disabled = false }: Props) {
  const c = useColors();

  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2, lineHeight: 14 * 1.4 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: 'row',
          height: 56,
          borderRadius: 12,
          backgroundColor: c.surface.disabled,
          padding: 8,
          gap: 8,
        }}
      >
        {options.map(opt => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => !disabled && onChange(opt.value)}
              style={({ pressed }) => ({
                flex: 1,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: selected && !disabled
                  ? colors.neutral[0]
                  : pressed && !disabled
                  ? colors.neutral[200]
                  : 'transparent',
                shadowColor: selected && !disabled ? '#11182703' : 'transparent',
                shadowOffset: { width: 1, height: 2 },
                shadowOpacity: 1,
                shadowRadius: 6,
                elevation: selected && !disabled ? 1 : 0,
              })}
            >
              <Text
                weight="semibold"
                style={{
                  fontSize: 14,
                  letterSpacing: 0.2,
                  lineHeight: 14 * 1.4,
                  color: selected && !disabled
                    ? c.text.link
                    : '#6b7280',
                }}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
