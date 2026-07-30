import { View, Pressable } from 'react-native';
import { useState } from 'react';
import Text from '@/components/Text';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import CalendarMonthly from '@/components/CalendarMonthly';
import CalendarMonthIcon from '@/assets/icons/CalendarMonth.svg';
import { useColors } from '@/lib/colors';

export type DatePickerProps = {
  label: string;
  value: string | null; // ISO 'YYYY-MM-DD'
  onChange: (iso: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
};

export default function DatePicker({
  label,
  value,
  onChange,
  placeholder = 'ДД.ММ.ГГГГ',
  disabled = false,
  error,
}: DatePickerProps) {
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<string | null>(null);

  function formatDisplay(iso: string | null): string | null {
    if (!iso) return null;
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }

  function handleOpen() {
    if (disabled) return;
    setTempDate(value);
    setOpen(true);
  }

  function handleConfirm() {
    if (tempDate) onChange(tempDate);
    setOpen(false);
  }

  const borderColor = disabled
    ? c.border.input
    : error
    ? c.border.error
    : open
    ? c.brand.primary
    : c.border.input;

  const displayValue = formatDisplay(value);
  const iconColor = error ? c.border.error : disabled ? c.text.placeholder : c.text.secondary;

  return (
    <>
      <View style={{ gap: 8 }}>
        <Text weight="bold" style={{ fontSize: 14, color: c.text.label, letterSpacing: 0.2, lineHeight: 14 * 1.4 }}>
          {label}
        </Text>

        <View style={{ borderRadius: 12, borderWidth: 1, borderColor, overflow: 'hidden' }}>
          <Pressable
            onPress={handleOpen}
            disabled={disabled}
            android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: false }}
            style={{
              height: 56,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 20,
              backgroundColor: disabled ? c.surface.disabled : c.surface.input,
            }}
          >
            <Text weight="semibold" style={{
              flex: 1,
              fontSize: 16,
              letterSpacing: 0.2,
              color: displayValue
                ? (disabled ? c.text.placeholder : c.text.primary)
                : c.text.placeholder,
            }}>
              {displayValue ?? placeholder}
            </Text>
            <CalendarMonthIcon width={24} height={24} color={iconColor} />
          </Pressable>
        </View>

        {error ? (
          <Text weight="semibold" style={{ fontSize: 14, color: c.semantic.error, letterSpacing: 0.2 }}>
            {error}
          </Text>
        ) : null}
      </View>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <View style={{ gap: 24 }}>
          <CalendarMonthly
            selectedDate={tempDate ?? undefined}
            onDateSelect={setTempDate}
            initialDate={tempDate ?? undefined}
            allowFutureSelect
          />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Button label="Отмена" variant="secondary" onPress={() => setOpen(false)} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Подтвердить" onPress={handleConfirm} disabled={!tempDate} />
            </View>
          </View>
        </View>
      </BottomSheet>
    </>
  );
}
