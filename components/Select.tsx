import { View, Pressable, ActionSheetIOS, Platform, Modal, TouchableOpacity, FlatList } from 'react-native';
import Text from '@/components/Text';
import { useColors } from '@/lib/colors';
import ChevronDownIcon from '@/assets/icons/ChevronDown.svg';
import { useState } from 'react';

type Option = { label: string; value: string };

type Props = {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export default function Select({ label, options, value, onChange, disabled = false }: Props) {
  const c = useColors();
  const [androidOpen, setAndroidOpen] = useState(false);
  const selected = options.find(o => o.value === value);

  function handlePress() {
    if (disabled) return;
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...options.map(o => o.label), 'Отмена'], cancelButtonIndex: options.length },
        index => { if (index < options.length) onChange(options[index].value); },
      );
    } else {
      setAndroidOpen(true);
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2, lineHeight: 14 * 1.4 }}>
        {label}
      </Text>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => ({
          height: 56,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: c.border.input,
          backgroundColor: disabled
            ? c.surface.disabled
            : pressed
            ? c.surface.disabled
            : c.surface.input,
        })}
      >
        <Text
          weight="semibold"
          style={{ fontSize: 16, letterSpacing: 0.2, color: disabled ? c.text.placeholder : c.text.primary }}
        >
          {selected?.label ?? ''}
        </Text>
        <ChevronDownIcon width={20} height={20} color={disabled ? c.text.placeholder : c.text.secondary} />
      </Pressable>

      {/* Android fallback modal */}
      <Modal visible={androidOpen} transparent animationType="fade" onRequestClose={() => setAndroidOpen(false)}>
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
          activeOpacity={1}
          onPress={() => setAndroidOpen(false)}
        >
          <View style={{ backgroundColor: c.surface.input, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 32, paddingTop: 16 }}>
            <FlatList
              data={options}
              keyExtractor={o => o.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => { onChange(item.value); setAndroidOpen(false); }}
                  style={({ pressed }) => ({ paddingVertical: 16, paddingHorizontal: 24, backgroundColor: pressed ? c.surface.disabled : 'transparent' })}
                >
                  <Text weight="semibold" style={{ fontSize: 16, color: item.value === value ? c.text.link : c.text.primary }}>
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
