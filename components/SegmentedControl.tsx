import { useRef, useEffect, useState } from 'react';
import { View, Pressable, Animated, Easing } from 'react-native';
import Text from '@/components/Text';
import { useColors, colors } from '@/lib/colors';
import CheckIcon from '@/assets/icons/Check.svg';

const SEGMENT_SHADOW = {
  shadowColor: colors.neutral[950],
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
  const selectedIndex = options.findIndex(o => o.value === value);
  const [segmentWidth, setSegmentWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (segmentWidth === 0) return;
    const toValue = selectedIndex * (segmentWidth + 8);
    if (isFirstRender.current) {
      translateX.setValue(toValue);
      isFirstRender.current = false;
      return;
    }
    Animated.timing(translateX, {
      toValue,
      duration: 200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [selectedIndex, segmentWidth]);

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
        {/* Скользящий индикатор */}
        {segmentWidth > 0 && (
          <Animated.View
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              width: segmentWidth,
              height: 40,
              borderRadius: 8,
              backgroundColor: c.surface.input,
              transform: [{ translateX }],
              ...SEGMENT_SHADOW,
            }}
          />
        )}

        {options.map((opt, i) => {
          const selected = opt.value === value && !disabled;
          return (
            <View
              key={opt.value}
              style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}
              onLayout={e => {
                if (i === 0) setSegmentWidth(e.nativeEvent.layout.width);
              }}
            >
              <Pressable
                onPress={() => !disabled && onChange(opt.value)}
                android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
                style={{
                  height: 40,
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
                <Text weight="semibold" numberOfLines={1} ellipsizeMode="tail" style={{
                  fontSize: 14,
                  letterSpacing: 0.2,
                  lineHeight: 14 * 1.4,
                  color: selected ? c.text.link : c.text.secondary,
                  flexShrink: 1,
                }}>
                  {opt.label}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
