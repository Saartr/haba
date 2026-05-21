import { View, TextInput, TextInputProps } from 'react-native';
import Text from '@/components/Text';
import { useState } from 'react';
import { useColors } from '@/lib/colors';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'editable'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  icon?: React.ReactNode;
  error?: string;
  disabled?: boolean;
};

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  error,
  disabled = false,
  ...textInputProps
}: Props) {
  const c = useColors();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? c.border.error
    : focused
    ? c.brand.primary
    : c.border.input;

  return (
    <View className="gap-2 w-full">
      <Text weight="bold" className="text-body-14 tracking-default" style={{ color: c.text.label }}>
        {label}
      </Text>

      <View
        style={{
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 20,
          borderRadius: 12,
          // @ts-ignore — iOS only, ignored on Android
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor,
          backgroundColor: disabled ? c.surface.disabled : c.surface.input,
        }}
      >
        {icon}
        <TextInput
          className="flex-1 font-manrope-semibold text-body-16 tracking-default"
          placeholderTextColor={c.text.placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ color: disabled ? c.text.secondary : c.text.primary }}
          {...textInputProps}
        />
      </View>

      {error ? (
        <Text weight="semibold" className="text-body-14 tracking-default" style={{ color: c.border.error }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
