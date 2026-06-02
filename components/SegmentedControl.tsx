import { View, Pressable } from 'react-native';
import Text from '@/components/Text';
import { useColors } from '@/lib/colors';
import CheckIcon from '@/assets/icons/Check.svg';

// Figma: drop-shadow(1px 2px 6px rgba(17,24,39,0.03)) на активном сегменте
const SEGMENT_SHADOW = {
  shadowColor: '#111827',
  shadowOffset: { width: 1, height: 2 },
  shadowOpacity: 0.03,
  shadowRadius: 6,
  elevation: 2,
} as const;

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
      <View style={{
        flexDirection: 'row',
        borderRadius: 12,
        backgroundColor: c.surface.disabled,
        padding: 8,
        gap: 8,
      }}>
        {options.map(opt => {
          const selected = opt.value === value && !disabled;
          return (
            <View key={opt.value} style={{ flex: 1, borderRadius: 8, ...(selected ? SEGMENT_SHADOW : null) }}>
              <View style={{ height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: selected ? c.surface.input : 'transparent' }}>
                <Pressable
                  onPress={() => !disabled && onChange(opt.value)}
                  android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                  }}
                >
                  {selected && (
                    <CheckIcon width={24} height={24} color={c.text.link} />
                  )}
                  <Text weight="semibold" style={{
                    fontSize: 14,
                    letterSpacing: 0.2,
                    lineHeight: 14 * 1.4,
                    color: selected ? c.text.link : c.text.secondary,
                  }}>
                    {opt.label}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
