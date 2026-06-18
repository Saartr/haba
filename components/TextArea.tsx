import { View, TextInput, TextInputProps } from 'react-native';
import Text from '@/components/Text';
import { useState } from 'react';
import { useColors } from '@/lib/colors';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'editable' | 'multiline'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  disabled?: boolean;
};

export default function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
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
    <View style={{ gap: 8, width: '100%' }}>
      <Text weight="bold" className="text-body-14 tracking-default" style={{ color: c.text.label }}>
        {label}
      </Text>

      <View
        style={{
          minHeight: 76,
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 12,
          // @ts-ignore — iOS only, ignored on Android
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor,
          backgroundColor: disabled ? c.surface.disabled : c.surface.input,
        }}
      >
        <TextInput
          multiline
          textAlignVertical="top"
          className="font-manrope-semibold text-body-16 tracking-default"
          placeholderTextColor={c.text.placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          editable={!disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ color: disabled ? c.text.secondary : c.text.primary, padding: 0 }}
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
