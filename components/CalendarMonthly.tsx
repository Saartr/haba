import { View, Pressable, Animated, PanResponder } from 'react-native';
import { useState, useRef } from 'react';
import Text from '@/components/Text';
import { colors, useColors } from '@/lib/colors';
import ChevronRightIcon from '@/assets/icons/ChevronRight.svg';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Состояния ячейки (из Figma TapaDS node 343:401)
type DayType =
  | 'other-month'            // Вне текущего месяца или вне period — серый, не кликабельный
  | 'default'                // Обычный день — тёмный текст
  | 'has-record'             // Есть запись — тёмный текст + зелёная точка
  | 'today'                  // Сегодня, не выбран — фиолетовое кольцо (border), тёмный текст
  | 'today-selected'         // Сегодня + выбран, нет записи — серая карточка, фиолетовый текст
  | 'today-selected-record'  // Сегодня + выбран + есть запись — серая карточка, фиолетовый текст + зелёная точка
  | 'selected'               // Выбранный не-сегодня — серая карточка, тёмный текст
  | 'selected-record';       // Выбранный с записью — серая карточка, тёмный текст + зелёная точка

export type CalendarMonthlyProps = {
  /** ISO-даты с записями: ['2026-06-07', '2026-06-14'] */
  logs?: string[];
  /** Начало периода цели (включительно). Дни до — как other-month. */
  periodStart?: string;
  /** Конец периода цели (включительно). Дни после — как other-month. */
  periodEnd?: string;
  /** Текущая выбранная ISO-дата. */
  selectedDate?: string;
  onDateSelect?: (isoDate: string) => void;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isTodayDate(d: Date): boolean {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate();
}

function isFutureDate(d: Date): boolean {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const cmp = new Date(d);
  cmp.setHours(0, 0, 0, 0);
  return cmp > t;
}

function getMonthGrid(year: number, month: number) {
  const cells: Array<{ date: Date; isCurrentMonth: boolean }> = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Пн = 0 в нашей сетке
  let startDow = firstDay.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), isCurrentMonth: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  // Только до конца последней строки (не всегда 6 строк)
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
  }
  return cells;
}

function getDayType(
  date: Date,
  isCurrentMonth: boolean,
  selectedISO: string | undefined,
  logsSet: Set<string>,
  periodStart: string | undefined,
  periodEnd: string | undefined,
): DayType {
  if (!isCurrentMonth) return 'other-month';

  const iso = toISO(date);
  if (periodStart && iso < periodStart) return 'other-month';
  if (periodEnd && iso > periodEnd) return 'other-month';

  const today = isTodayDate(date);
  const selected = iso === selectedISO;
  const record = logsSet.has(iso);

  if (today && selected && record) return 'today-selected-record';
  if (today && selected) return 'today-selected';
  if (today) return 'today';
  if (record && selected) return 'selected-record';
  if (record) return 'has-record';
  if (selected) return 'selected';
  return 'default';
}

function DayCell({
  date,
  type,
  onPress,
}: {
  date: Date;
  type: DayType;
  onPress: () => void;
}) {
  const c = useColors();

  const disabled = type === 'other-month' || isFutureDate(date);
  const isSelected = type === 'today-selected' || type === 'today-selected-record' || type === 'selected' || type === 'selected-record';
  const hasRecord = type === 'has-record' || type === 'selected-record' || type === 'today-selected-record';
  const isTodayRing = type === 'today';

  const textColor =
    type === 'today-selected' || type === 'today-selected-record' ? c.brand.primary
    : type === 'other-month' ? c.text.secondary
    : c.text.primary;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_ripple={disabled ? undefined : { color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}
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
        <Text weight="semibold" style={{ fontSize: 16, color: textColor, lineHeight: 20 }}>
          {date.getDate()}
        </Text>
        {hasRecord && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: colors.green[500],
          }} />
        )}
      </View>
      {/* Кольцо "сегодня" вынесено наружу, чтобы overflow:hidden не обрезал border */}
      {isTodayRing && (
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
}

function shiftMonth(year: number, month: number, delta: number) {
  let m = month + delta;
  let y = year;
  if (m > 11) { y += 1; m = 0; }
  if (m < 0)  { y -= 1; m = 11; }
  return { year: y, month: m };
}

const SWIPE_THRESHOLD = 50;
const SWIPE_OUT_X = 350;

export default function CalendarMonthly({
  logs = [],
  periodStart,
  periodEnd,
  selectedDate,
  onDateSelect,
}: CalendarMonthlyProps) {
  const c = useColors();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const translateX = useRef(new Animated.Value(0)).current;

  const logsSet = new Set(logs);

  // goRef и animateRef объявлены до panResponder, чтобы PanResponder (создаётся один раз)
  // всегда видел актуальный месяц и функцию анимации через .current
  const goRef = useRef<(direction: 'prev' | 'next') => void>(() => {});
  const animateRef = useRef<(direction: 'prev' | 'next') => void>(() => {});

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
    onPanResponderMove: (_, gs) => translateX.setValue(gs.dx),
    onPanResponderRelease: (_, gs) => {
      if (gs.dx < -SWIPE_THRESHOLD) {
        animateRef.current('next');
      } else if (gs.dx > SWIPE_THRESHOLD) {
        animateRef.current('prev');
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 20,
        }).start();
      }
    },
  })).current;

  // Обновляем рефы на каждом рендере — PanResponder всегда вызывает актуальную версию
  goRef.current = (direction: 'prev' | 'next') => {
    const { year, month } = shiftMonth(viewYear, viewMonth, direction === 'next' ? 1 : -1);
    setViewYear(year);
    setViewMonth(month);
  };

  function animateAndGo(direction: 'prev' | 'next') {
    const toX = direction === 'next' ? -SWIPE_OUT_X : SWIPE_OUT_X;
    Animated.timing(translateX, {
      toValue: toX,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      goRef.current(direction);
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

      {/* Заголовок дней недели */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text weight="semibold" style={{ fontSize: 13, color: c.text.secondary, letterSpacing: 0.2 }}>
              {d}
            </Text>
          </View>
        ))}
      </View>

      {/* Сетка со свайпом — overflow:hidden обрезает выезд за края */}
      <View style={{ overflow: 'hidden' }}>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map(({ date, isCurrentMonth }, di) => {
              const iso = toISO(date);
              const type = getDayType(date, isCurrentMonth, selectedDate, logsSet, periodStart, periodEnd);
              return (
                <DayCell
                  key={di}
                  date={date}
                  type={type}
                  onPress={() => onDateSelect?.(iso)}
                />
              );
            })}
          </View>
        ))}
      </Animated.View>
      </View>
    </View>
  );
}
