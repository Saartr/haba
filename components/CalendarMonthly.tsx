import { View, Pressable, Animated, PanResponder } from 'react-native';
import { useState, useRef } from 'react';
import Text from '@/components/Text';
import { colors, useColors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import ChevronRightIcon from '@/assets/icons/ChevronRight.svg';

// В тёмной теме text.secondary (#b5b5b5) недостаточно тусклый для неактивных дат —
// контраст к фону карточки выше, чем у text.secondary в светлой теме, из-за чего
// прошедшие/недоступные дни визуально не отличаются от обычных. Локальный подбор
// только для этого компонента, не трогая глобальный token text.secondary.
const OTHER_MONTH_COLOR_DARK = colors.neutral[500];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

// Состояния ячейки (из Figma TapaDS node 344:151 — Grid calendar item, все варианты Type × Selected).
// Цвет текста определяется только Type (other-month/today/обычный), фон cardGrey — только Selected,
// зелёная точка — только наличием записи. Эти три флага независимы и комбинируются свободно
// (в отличие от прежней версии, где типы вроде 'today-selected-record' были захардкожены как единый enum).
// hasMissed (красная точка) и hasPlanned (серая точка) в самой Figma не описаны — состояния
// добавлены по прямому запросу пользователя для экрана подтягиваний: красная — пропущенная/
// непройденная тренировка, серая — тренировка по плану впереди (ещё не наступила).
type DayState = {
  isOtherMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasRecord: boolean;
  hasMissed: boolean;
  hasPlanned: boolean;
};

export type CalendarMonthlyProps = {
  /** ISO-даты с записями: ['2026-06-07', '2026-06-14'] */
  logs?: string[];
  /** ISO-даты без записи/с провалом (красная точка вместо зелёной). Приоритет — у logs. */
  missedDates?: string[];
  /** ISO-даты будущих тренировок по плану (серая точка). Приоритет — у logs и missedDates. */
  plannedDates?: string[];
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

function getDayState(
  date: Date,
  isCurrentMonth: boolean,
  selectedISO: string | undefined,
  logsSet: Set<string>,
  missedSet: Set<string>,
  plannedSet: Set<string>,
  periodStart: string | undefined,
  periodEnd: string | undefined,
): DayState {
  const iso = toISO(date);
  const outOfPeriod = (periodStart != null && iso < periodStart) || (periodEnd != null && iso > periodEnd);
  const isOtherMonth = !isCurrentMonth || outOfPeriod;
  const hasRecord = !isOtherMonth && logsSet.has(iso);
  const hasMissed = !isOtherMonth && !hasRecord && missedSet.has(iso);

  return {
    isOtherMonth,
    isToday: !isOtherMonth && isTodayDate(date),
    isSelected: !isOtherMonth && iso === selectedISO,
    hasRecord,
    hasMissed,
    hasPlanned: !isOtherMonth && !hasRecord && !hasMissed && plannedSet.has(iso),
  };
}

function DayCell({
  date,
  state,
  onPress,
}: {
  date: Date;
  state: DayState;
  onPress: () => void;
}) {
  const c = useColors();
  const { colorScheme } = useSettings();
  const { isOtherMonth, isToday, isSelected, hasRecord, hasMissed, hasPlanned } = state;
  const dotColor = hasRecord ? colors.green[500] : hasMissed ? colors.red[500] : hasPlanned ? colors.neutral[400] : null;

  const disabled = isOtherMonth || isFutureDate(date);
  const otherMonthColor = colorScheme === 'dark' ? OTHER_MONTH_COLOR_DARK : c.text.secondary;
  const textColor = isOtherMonth ? otherMonthColor : isToday ? c.brand.primary : c.text.primary;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      android_ripple={disabled ? undefined : { color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: 48 }}
    >
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: isSelected ? c.surface.cardGrey : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text weight="semibold" style={{ fontSize: 16, color: textColor, lineHeight: 20 }}>
          {date.getDate()}
        </Text>
        {dotColor && (
          <View style={{
            position: 'absolute',
            bottom: 4,
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: dotColor,
          }} />
        )}
      </View>
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

function parseYearMonth(iso: string): { y: number; m: number } {
  return { y: parseInt(iso.slice(0, 4), 10), m: parseInt(iso.slice(5, 7), 10) - 1 };
}

function isSameOrBeforeMonth(y: number, m: number, ref: { y: number; m: number }): boolean {
  return y < ref.y || (y === ref.y && m <= ref.m);
}

function isSameOrAfterMonth(y: number, m: number, ref: { y: number; m: number }): boolean {
  return y > ref.y || (y === ref.y && m >= ref.m);
}

const SWIPE_THRESHOLD = 50;
const SWIPE_OUT_X = 350;

export default function CalendarMonthly({
  logs = [],
  missedDates = [],
  plannedDates = [],
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
  // Блокирует начало нового жеста/повторный тап по стрелке, пока текущая анимация
  // смены месяца не завершилась — без этого быстрый повторный свайп прерывает
  // ещё летящую Animated.timing, translateX уезжает за пределы ±SWIPE_OUT_X,
  // и сетка дат визуально уезжает за overflow:hidden (выглядит как пустое место).
  const isAnimatingRef = useRef(false);

  // Заголовок «Месяц Год» анимируется отдельно от сетки: гаснет и уезжает
  // в сторону свайпа, пока едет сетка, затем появляется с противоположной
  // стороны сразу после смены месяца — без этого текст менялся мгновенно
  // и выглядело дёргано на фоне плавно едущей сетки.
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslateX = useRef(new Animated.Value(0)).current;
  const TITLE_SHIFT = 16;

  const logsSet = new Set(logs);
  const missedSet = new Set(missedDates);
  const plannedSet = new Set(plannedDates);

  // Границы навигации по periodStart/periodEnd — на месяце начала/конца периода
  // соответствующая стрелка скрывается, дальше листать некуда.
  const startYM = periodStart ? parseYearMonth(periodStart) : null;
  const endYM = periodEnd ? parseYearMonth(periodEnd) : null;
  const canGoPrev = !startYM || !isSameOrBeforeMonth(viewYear, viewMonth, startYM);
  const canGoNext = !endYM || !isSameOrAfterMonth(viewYear, viewMonth, endYM);

  // goRef и animateRef объявлены до panResponder, чтобы PanResponder (создаётся один раз)
  // всегда видел актуальный месяц и функцию анимации через .current
  const goRef = useRef<(direction: 'prev' | 'next') => void>(() => {});
  const animateRef = useRef<(direction: 'prev' | 'next') => void>(() => {});

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, gs) =>
      !isAnimatingRef.current && Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
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
    if (isAnimatingRef.current) return;
    if ((direction === 'prev' && !canGoPrev) || (direction === 'next' && !canGoNext)) {
      isAnimatingRef.current = true;
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }).start(() => {
        isAnimatingRef.current = false;
      });
      return;
    }
    isAnimatingRef.current = true;
    const toX = direction === 'next' ? -SWIPE_OUT_X : SWIPE_OUT_X;
    const titleExitX = direction === 'next' ? -TITLE_SHIFT : TITLE_SHIFT;
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: toX,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(titleOpacity, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(titleTranslateX, { toValue: titleExitX, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      goRef.current(direction);
      translateX.setValue(0);
      titleTranslateX.setValue(-titleExitX);
      Animated.parallel([
        Animated.timing(titleOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(titleTranslateX, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start(() => {
        isAnimatingRef.current = false;
      });
    });
  }
  animateRef.current = animateAndGo;

  const cells = getMonthGrid(viewYear, viewMonth);
  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      {/* Заголовок месяца — боковые колонки фиксированной ширины (24), чтобы название
          месяца всегда оставалось по центру независимо от того, скрыта ли стрелка */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <View style={{ width: 24, alignItems: 'flex-start' }}>
          {canGoPrev && (
            <Pressable onPress={() => animateAndGo('prev')} hitSlop={12} android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}>
              <View style={{ transform: [{ rotate: '180deg' }] }}>
                <ChevronRightIcon width={24} height={24} color={c.text.primary} />
              </View>
            </Pressable>
          )}
        </View>
        <Animated.View style={{ flex: 1, opacity: titleOpacity, transform: [{ translateX: titleTranslateX }] }}>
          <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2, textAlign: 'center' }}>
            {MONTHS_RU[viewMonth]} {viewYear}
          </Text>
        </Animated.View>
        <View style={{ width: 24, alignItems: 'flex-end' }}>
          {canGoNext && (
            <Pressable onPress={() => animateAndGo('next')} hitSlop={12} android_ripple={{ color: 'rgba(0,0,0,0.06)', borderless: true, radius: 20 }}>
              <ChevronRightIcon width={24} height={24} color={c.text.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Заголовок дней недели */}
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {WEEKDAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
            <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2, lineHeight: 16 * 1.6 }}>
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
              const state = getDayState(date, isCurrentMonth, selectedDate, logsSet, missedSet, plannedSet, periodStart, periodEnd);
              return (
                <DayCell
                  key={di}
                  date={date}
                  state={state}
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
