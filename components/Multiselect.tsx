import { View, Pressable, FlatList } from 'react-native';
import Text from '@/components/Text';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import { useColors } from '@/lib/colors';
import ChevronDownIcon from '@/assets/icons/ChevronDown.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useEffect, useState } from 'react';

type Option = { label: string; value: string };

type Props = {
  label: string;
  options: Option[];
  value: string[];
  onChange: (value: string[]) => void;
  exactCount: number;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export default function Multiselect({ label, options, value, onChange, exactCount, placeholder, disabled = false, error }: Props) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open]);

  function handlePress() {
    if (disabled) return;
    setOpen(true);
  }

  function toggle(val: string) {
    if (draft.includes(val)) {
      setDraft(draft.filter(v => v !== val));
    } else if (draft.length < exactCount) {
      setDraft([...draft, val]);
    }
  }

  function handleConfirm() {
    onChange(draft);
    setOpen(false);
  }

  function handleCancel() {
    setOpen(false);
  }

  const selectedLabels = options.filter(o => value.includes(o.value)).map(o => o.label);

  const borderColor = disabled
    ? c.border.input
    : error
    ? c.border.error
    : open
    ? c.brand.primary
    : c.border.input;

  const bgColor = disabled ? c.surface.disabled : c.surface.input;
  const textColor = selectedLabels.length ? c.text.primary : c.text.placeholder;
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
          <Text weight="semibold" numberOfLines={1} style={{ flex: 1, fontSize: 16, letterSpacing: 0.2, color: disabled ? c.text.placeholder : textColor }}>
            {selectedLabels.length ? selectedLabels.join(', ') : placeholder ?? ''}
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
        <FlatList
          data={options}
          keyExtractor={o => o.value}
          scrollEnabled={false}
          style={{ marginHorizontal: -24 }}
          renderItem={({ item }) => {
            const checked = draft.includes(item.value);
            const lockedOut = !checked && draft.length >= exactCount;
            return (
              <Pressable
                onPress={() => toggle(item.value)}
                disabled={lockedOut}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 16,
                  paddingHorizontal: 24,
                  opacity: lockedOut ? 0.4 : 1,
                  backgroundColor: checked ? c.surface.cardGrey : 'transparent',
                }}
              >
                {checked
                  ? <CheckIcon width={24} height={24} color={c.text.secondary} />
                  : <View style={{ width: 24 }} />
                }
                <Text weight="semibold" style={{ fontSize: 16, letterSpacing: 0.2, color: c.text.secondary }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          }}
        />
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Button label="Отмена" variant="secondary" onPress={handleCancel} />
          </View>
          <View style={{ flex: 1 }}>
            <Button label="Подтвердить" onPress={handleConfirm} disabled={draft.length !== exactCount} />
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
