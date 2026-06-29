import { View, Pressable, Animated, PanResponder } from 'react-native';
import { useState, useRef } from 'react';
import Text from '@/components/Text';
import Button from '@/components/Button';
import BottomSheet from '@/components/BottomSheet';
import CalendarMonthIcon from '@/assets/icons/CalendarMonth.svg';
import ChevronRightIcon from '@/assets/icons/ChevronRight.svg';
import { useColors } from '@/lib/colors';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonthGrid(year: number, month: number) {
  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  return cells;
}

function shiftMonth(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
  if (m > 11) { y += 1; m = 0; }
  if (m < 0) { y -= 1; m = 11; }
  return { year: y, month: m };
}

const SWIPE_THRESHOLD = 50;
const SWIPE_OUT_X = 350;

function PickerCalendar({
  selectedDate,
  onDateSelect,
}: {
  selectedDate: string | null;
  onDateSelect: (iso: string) => void;
}) {
  const c = useColors();
  const now = new Date();
  const [viewYear, setViewYear] = useState(
    selectedDate ? parseInt(selectedDate.slice(0, 4)) : now.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseInt(selectedDate.slice(5, 7)) - 1 : now.getMonth(),
  );

  const translateX = useRef(new Animated.Value(0)).current;
  const goRef = useRef<(dir: 'prev' | 'next') => void>(() => {});
  const animateRef = useRef<(dir: 'prev' | 'next') => void>(() => {});

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderMove: (_, gs) => translateX.setValue(gs.dx),
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -SWIPE_THRESHOLD) animateRef.current('next');
      else if (gs.dx > SWIPE_THRESHOLD) animateRef.current('prev');
      else Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }).start();
    },
  })).current;

  goRef.current = (dir) => {
    const { year, month } = shiftMonth(viewYear, viewMonth, dir === 'next' ? 1 : -1);
    setViewYear(year);
    setViewMonth(month);
  };

  function animateAndGo(dir: 'prev' | 'next') {
    const toX = dir === 'next' ? -SWIPE_OUT_X : SWIPE_OUT_X;
    Animated.timing(translateX, { toValue: toX, duration: 180, useNativeDriver: true }).start(() => {
      goRef.current(dir);
      translateX.setValue(0);
    });
  }
  animateRef.current = animateAndGo;

  const cells = getMonthGrid(viewYear, viewMonth);
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      {/* Заголовок месяца */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 16, gap: 16 }}>
        <Pressable onPress={() => animateAndGo('prev')} hitSlop={12} android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <ChevronRightIcon width={24} height={24} color={c.text.primary} />
          </View>
        </Pressable>
        <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2, minWidth: 140, textAlign: 'center' }}>
          {MONTHS_RU[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={() => animateAndGo('next')} hitSlop={12} android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}>
          <ChevronRightIcon width={24} height={24} color={c.text.primary} />
        </Pressable>
      </View>

      {/* Дни недели */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text weight="semibold" style={{ fontSize: 13, color: c.text.secondary, letterSpacing: 0.2 }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Сетка со свайпом */}
      <View style={{ overflow: 'hidden' }}>
        <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
          {weeks.map((week, wi) => (
            <View key={wi} style={{ flexDirection: 'row' }}>
              {week.map(({ date, isCurrentMonth }, di) => {
                const iso = toISO(date);
                const isSelected = iso === selectedDate;
                const isOtherMonth = !isCurrentMonth;

                return (
                  <Pressable
                    key={di}
                    onPress={isOtherMonth ? undefined : () => onDateSelect(iso)}
                    android_ripple={isOtherMonth ? undefined : { color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 56 }}
                  >
                    <View style={{
                      width: 40,
                      height: 48,
                      borderRadius: 8,
                      overflow: 'hidden',
                      backgroundColor: isSelected ? c.surface.cardGrey : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Text weight="semibold" style={{
                        fontSize: 16,
                        lineHeight: 20,
                        color: isOtherMonth ? c.text.secondary : isSelected ? c.brand.primary : c.text.primary,
                      }}>
                        {date.getDate()}
                      </Text>
                    </View>
                    {/* Рамка выбранной ячейки вынесена наружу, чтобы overflow:hidden не обрезал border */}
                    {isSelected && (
                      <View style={{
                        position: 'absolute',
                        width: 40,
                        height: 48,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: c.brand.primary,
                        pointerEvents: 'none',
                      }} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </Animated.View>
      </View>
    </View>
  );
}

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
          <PickerCalendar
            selectedDate={tempDate}
            onDateSelect={setTempDate}
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
