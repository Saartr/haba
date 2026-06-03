import { View, Pressable, FlatList } from 'react-native';
import Text from '@/components/Text';
import BottomSheet from '@/components/BottomSheet';
import { useColors } from '@/lib/colors';
import ChevronDownIcon from '@/assets/icons/ChevronDown.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useState } from 'react';

type Option = { label: string; value: string };

type Props = {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export default function Select({ label, options, value, onChange, placeholder, disabled = false, error }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  function handlePress() {
    if (disabled) return;
    setOpen(true);
  }

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
  }

  const borderColor = disabled
    ? c.border.input
    : error
    ? c.border.error
    : open
    ? c.brand.primary
    : c.border.input;

  const bgColor = disabled ? c.surface.disabled : c.surface.input;
  const textColor = selected ? c.text.primary : c.text.placeholder;
  const chevronColor = disabled ? c.text.placeholder : c.text.secondary;

  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2, lineHeight: 14 * 1.4 }}>
        {label}
      </Text>

      <View style={{ borderRadius: 12, borderWidth: 1, borderColor, overflow: 'hidden' }}>
        <Pressable
          onPress={handlePress}
          android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
          style={{
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            paddingHorizontal: 20,
            backgroundColor: bgColor,
          }}
        >
          <Text weight="semibold" style={{ flex: 1, fontSize: 16, letterSpacing: 0.2, color: disabled ? c.text.placeholder : textColor }}>
            {selected?.label ?? placeholder ?? ''}
          </Text>
          <View style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}>
            <ChevronDownIcon width={24} height={24} color={chevronColor} />
          </View>
        </Pressable>
      </View>

      {error ? (
        <Text weight="semibold" style={{ fontSize: 14, color: c.semantic.error, letterSpacing: 0.2 }}>
          {error}
        </Text>
      ) : null}

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        {/* отменяем горизонтальный padding шторки, чтобы подсветка строки шла от края до края */}
        <FlatList
          data={options}
          keyExtractor={o => o.value}
          scrollEnabled={false}
          style={{ marginHorizontal: -24 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleSelect(item.value)}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 16,
                paddingHorizontal: 24,
                backgroundColor: item.value === value ? c.surface.disabled : 'transparent',
              }}
            >
              {item.value === value
                ? <CheckIcon width={24} height={24} color={c.text.link} />
                : <View style={{ width: 24 }} />
              }
              <Text weight="semibold" style={{ fontSize: 16, letterSpacing: 0.2, color: item.value === value ? c.text.link : c.text.primary }}>
                {item.label}
              </Text>
            </Pressable>
          )}
        />
      </BottomSheet>
    </View>
  );
}
