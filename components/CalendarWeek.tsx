import { useRef, useState, useEffect } from 'react';
import { View, Pressable, FlatList, Dimensions, ActivityIndicator, Animated, Easing } from 'react-native';
import Text from '@/components/Text';
import CheckCircleIcon from '@/assets/icons/CheckCircle.svg';
import DoNotDisturbIcon from '@/assets/icons/DoNotDisturb.svg';
import CircleOutlineIcon from '@/assets/icons/Circle.svg';
import { useSettings } from '@/lib/settings-context';
import { colors } from '@/lib/colors';
import { getHabitLogs, HabitLog } from '@/lib/api';

export type DayStatus = 'check' | 'miss' | 'current' | 'future' | 'inactive';

export type CalendarDay = {
  day: number;
  weekday: string;
  status: DayStatus;
  isToday: boolean;
  iso: string;
  /** День раньше создания цели — не кликабелен даже в режиме allowAnySelect (данных нет). */
  beforeHabit: boolean;
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// Цвет иконки статуса. Фон ячейки и число — единые; статус выражается только иконкой.
// inactive — без иконки (null).
const ICON_LIGHT: Record<DayStatus, string | null> = {
  check:    colors.green[500],
  miss:     colors.red[500],
  current:  colors.purple[500],
  future:   colors.neutral[600],
  inactive: null,
};

const ICON_DARK: Record<DayStatus, string | null> = {
  check:    colors.green[500],
  miss:     colors.red[400],
  current:  colors.purple[400],
  future:   colors.neutral[500],
  inactive: null,
};

function DayIcon({ status, color }: { status: DayStatus; color: string | null }) {
  // inactive — без иконки, но место под неё резервируем, чтобы число стояло как в остальных ячейках
  if (color === null) return <View style={{ width: 24, height: 24 }} />;
  if (status === 'check') return <CheckCircleIcon width={24} height={24} color={color} />;
  if (status === 'miss')  return <DoNotDisturbIcon width={24} height={24} color={color} />;
  return <CircleOutlineIcon width={24} height={24} color={color} />;
}

// Тап и подсветка «active» доступны только дням с реальным статусом (сегодня/выполнено/
// пропущено) — у будущих и inactive-дней (до создания цели, день отдыха) в Figma нет
// варианта Selected=on, поэтому они остаются некликабельными.
// Это поведение для экранов, где тап = переключение даты записи (логировать будущее нельзя).
// На экранах, где тап только ОТКРЫВАЕТ информацию о дне (подтягивания — план на дату),
// используется allowAnySelect: кликабельно всё, кроме дней до создания цели. Иначе на
// свежей цели не нажимается вообще ничего — дни отдыха inactive, тренировочные ещё future.
function isSelectable(status: DayStatus): boolean {
  return status === 'current' || status === 'check' || status === 'miss';
}

function DayCell({ day, weekday, status, iso, isToday, beforeHabit, selected, allowAnySelect, onPress }: CalendarDay & { selected: boolean; allowAnySelect?: boolean; onPress?: (iso: string) => void }) {
  const { colorScheme } = useSettings();
  const dark = colorScheme === 'dark';
  // Логика та же, что в CalendarMonthly: «сегодня» подсвечен всегда (фон + 2px рамка
  // brand и фиолетовое число), а выбранный тапом день — на одну ступень контрастнее
  // обычной подложки, без рамки. Так подсветка выбора не перебивает метку «сегодня»
  // и читается как временная (живёт, пока открыта модалка дня).
  // Направление ступени зависит от темы: в светлой — темнее фона, в тёмной — светлее.
  const boxBg = isToday
    ? (dark ? colors.purple[900] : colors.purple[100])
    : selected
    ? (dark ? colors.neutral[700] : colors.neutral[200])
    : (dark ? colors.neutral[800] : colors.neutral[100]);
  const boxBorder = isToday ? (dark ? colors.purple[400] : colors.purple[500]) : 'transparent';
  const weekdayColor = dark ? colors.neutral[0] : colors.neutral[900];
  const dayColor = isToday ? (dark ? colors.purple[400] : colors.purple[500]) : colors.neutral[500];
  const iconColor = (dark ? ICON_DARK : ICON_LIGHT)[status];

  const canPress = allowAnySelect ? !beforeHabit : isSelectable(status);
  const Box = canPress ? Pressable : View;

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', color: weekdayColor }}>
        {weekday}
      </Text>
      <Box
        onPress={canPress ? () => onPress?.(iso) : undefined}
        android_ripple={canPress ? { color: 'rgba(0,0,0,0.06)', borderless: false } : undefined}
        style={{
          height: 62,
          borderRadius: 16,
          backgroundColor: boxBg,
          borderWidth: 2,
          borderColor: boxBorder,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 8,
        }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, color: dayColor }}>
            {day}
          </Text>
          <DayIcon status={status} color={iconColor} />
        </View>
      </Box>
    </View>
  );
}

// Все расчёты дат — в локальном времени, как и на экранах целей (dateToLocalISO в shared).
// В UTC «сегодня» съезжает на вчера у пользователей восточнее Гринвича: в Москве с 00:00
// до 03:00 toISOString() отдаёт вчерашнюю дату, и календарь подсвечивал не ту ячейку.

// Возвращает пн недели для даты смещённой на weekOffset недель от сегодня
function getWeekMonday(weekOffset: number): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay() || 7;
  const mon = new Date(today);
  mon.setDate(today.getDate() - dayOfWeek + 1 + weekOffset * 7);
  return mon;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toDateStr(d);
}

function buildDays(
  mon: Date,
  logs: Map<string, number>,
  habitCreatedAt: Date,
  goalValue: number,
  trainingDays?: number[] | null,
  noMissIndicator?: boolean,
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const dateStr = toDateStr(d);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const loggedValue = logs.get(dateStr);
    const beforeHabit = d < habitCreatedAt;
    // День отдыха (для pullups) — не входит в training_days, без иконки, как inactive
    const isoDay = d.getDay() || 7;
    const isRestDay = trainingDays != null && !trainingDays.includes(isoDay);

    let status: DayStatus;
    if (beforeHabit || isRestDay) {
      // День отдыха — без иконки независимо от того, в прошлом, сегодня или в будущем,
      // чтобы будущие тренировочные дни визуально отличались от дней отдыха при свайпе вперёд.
      status = 'inactive';
    } else if (diff > 0) {
      status = 'future';
    } else if (noMissIndicator) {
      // Без порога/красного: запись есть — галочка, нет — пустой серый кружок
      // (тот же вид, что и у будущих дней), независимо от того, прошедший день это или сегодня.
      status = loggedValue !== undefined && loggedValue > 0 ? 'check' : 'future';
    } else if (diff === 0) {
      if (loggedValue !== undefined && loggedValue >= goalValue) status = 'check';
      else if (loggedValue !== undefined) status = 'miss';
      else status = 'current';
    } else {
      status = loggedValue !== undefined && loggedValue >= goalValue ? 'check' : 'miss';
    }
    return { day: d.getDate(), weekday: WEEKDAYS[i], status, isToday: diff === 0, iso: dateStr, beforeHabit };
  });
}

// Сколько недель назад была создана привычка (округляем вниз)
function minWeekOffset(habitCreatedAt: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - habitCreatedAt.getTime();
  if (diffMs <= 0) return 0;
  const diffWeeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return -diffWeeks;
}

// Последняя неделя плана относительно сегодня (для pullups — чтобы можно было
// свайпнуть вперёд и увидеть запланированные тренировочные дни). 0, если план не передан
// или уже закончился — свайп вперёд не нужен.
function maxWeekOffset(habitCreatedAt: Date, totalWeeks?: number): number {
  if (!totalWeeks) return 0;
  const minOffset = minWeekOffset(habitCreatedAt); // отрицательное число недель с создания
  return Math.max(0, totalWeeks + minOffset);
}


type WeekPageProps = {
  weekOffset: number;
  habitId: number;
  habitCreatedAt: Date;
  currentWeekLogs: HabitLog[];
  goalValue: number;
  trainingDays?: number[] | null;
  pageWidth: number;
  userId?: number;
  horizontalPadding: number;
  noMissIndicator?: boolean;
  // Active-подсветка — общий стейт на уровне всего CalendarWeek (не для каждой недели свой),
  // иначе при переключении на дату другой недели у текущей недели остаётся своя, независимая
  // «выбранная» ячейка (по умолчанию — сегодня), и получается два выделенных дня одновременно.
  selected: string | null;
  allowAnySelect?: boolean;
  onSelect: (iso: string) => void;
};

function WeekPage({ weekOffset, habitId, habitCreatedAt, currentWeekLogs, goalValue, trainingDays, pageWidth, userId, horizontalPadding, noMissIndicator, selected, allowAnySelect, onSelect }: WeekPageProps) {
  const [logs, setLogs] = useState<Map<string, number> | null>(
    weekOffset === 0 ? null : null,
  );
  const [loading, setLoading] = useState(weekOffset !== 0);
  const { colorScheme } = useSettings();

  useEffect(() => {
    if (weekOffset === 0) {
      // Текущая неделя — используем данные из getHabit
      const map = new Map(currentWeekLogs.map(l => [l.date.slice(0, 10), l.value]));
      setLogs(map);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const mon = getWeekMonday(weekOffset);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    getHabitLogs(habitId, toDateStr(mon), toDateStr(sun), userId)
      .then(data => {
        if (cancelled) return;
        setLogs(new Map(data.map(l => [l.date.slice(0, 10), l.value])));
      })
      .catch(() => { if (!cancelled) setLogs(new Map()); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [weekOffset, habitId, userId]);

  // Обновляем текущую неделю при изменении currentWeekLogs (после логирования)
  useEffect(() => {
    if (weekOffset !== 0) return;
    setLogs(new Map(currentWeekLogs.map(l => [l.date.slice(0, 10), l.value])));
  }, [currentWeekLogs, weekOffset]);

  const mon = getWeekMonday(weekOffset);
  const days = logs ? buildDays(mon, logs, habitCreatedAt, goalValue, trainingDays, noMissIndicator) : [];

  return (
    <View style={{ width: pageWidth, paddingHorizontal: horizontalPadding, height: 86 }}>
      {loading ? (
        <ActivityIndicator
          style={{ flex: 1 }}
          color={colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500]}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {days.map((d, i) => (
            <DayCell
              key={i}
              {...d}
              selected={d.iso === selected}
              allowAnySelect={allowAnySelect}
              onPress={onSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

type Props = {
  habitId: number;
  habitCreatedAt: string;
  currentWeekLogs: HabitLog[];
  goalValue: number;
  /** Дни тренировок (1=Пн..7=Вс) — для pullups. Дни не из списка рендерятся как inactive (день отдыха). */
  trainingDays?: number[] | null;
  /** Чей календарь показывать. По умолчанию — текущий юзер. */
  userId?: number;
  /** Ширина страницы. По умолчанию — ширина экрана. Для узких контейнеров (модалка). */
  pageWidth?: number;
  /** Горизонтальный отступ внутри страницы. По умолчанию 24. */
  horizontalPadding?: number;
  /** Длительность плана в неделях (pullups) — позволяет свайпнуть вперёд и увидеть запланированные тренировки. */
  totalWeeks?: number;
  /** Приветственная wiggle-анимация при маунте. По умолчанию включена; выключить там, где
   * компонент перемонтируется не как первое появление экрана (например, переключатель вида). */
  welcomeAnimation?: boolean;
  /** Без порога/красного индикатора пропуска: запись есть — галочка, нет — пустой серый
   * кружок (как у будущих дней). Для целей без дневного лимита (например, count без goal_value). */
  noMissIndicator?: boolean;
  /** Тап по дню — если передан, ячейки становятся нажимаемыми (для просмотра плана на дату). */
  onDateSelect?: (iso: string) => void;
  /** Разрешить тап по любому дню с даты создания цели — включая будущие и дни отдыха.
   * Для экранов, где тап только показывает информацию о дне (план тренировки), а не
   * переключает дату записи. По умолчанию кликабельны только дни с реальным статусом. */
  allowAnySelect?: boolean;
  /** Управляемая подсветка выбранного дня (как selectedDate в CalendarMonthly). Если проп
   * передан, календарь не хранит выбор сам — экран решает, когда день подсвечен (например,
   * только пока открыта модалка дня). Не передан — выбор живёт внутри и стартует с сегодня. */
  selectedDate?: string | null;
};

export default function CalendarWeek({ habitId, habitCreatedAt, currentWeekLogs, goalValue, trainingDays, userId, pageWidth: pageWidthProp, horizontalPadding = 24, totalWeeks, welcomeAnimation = true, noMissIndicator, onDateSelect, allowAnySelect, selectedDate }: Props) {
  const createdAt = new Date(habitCreatedAt);
  // Локальная полночь — обязательно та же система, что и у дат ячеек в buildDays. Если
  // оставить UTC-полночь, сравнение `d < createdAt` для восточных зон отсекает сам день
  // создания цели (локальная полночь наступает раньше UTC-полуночи того же числа).
  createdAt.setHours(0, 0, 0, 0);

  const minOffset = minWeekOffset(createdAt);
  const maxOffset = maxWeekOffset(createdAt, totalWeeks);
  // Генерируем индексы недель от minOffset до maxOffset (текущая неделя — offset=0)
  const weekOffsets = Array.from(
    { length: maxOffset - minOffset + 1 },
    (_, i) => minOffset + i,
  );
  const currentIndex = weekOffsets.indexOf(0);

  const listRef = useRef<FlatList>(null);
  const { width: screenWidth } = Dimensions.get('window');
  const pageWidth = pageWidthProp ?? screenWidth;

  // Active-подсветка (TapaDS Calendar/Item, Selected=on) — единый стейт на весь календарь
  // (не по одному на страницу-неделю), иначе у каждой недели остаётся своя независимая
  // подсветка «по умолчанию сегодня», и при переключении на дату другой недели получаются
  // два выделенных дня одновременно.
  const [internalSelected, setInternalSelected] = useState<string | null>(todayIso());
  const isControlled = selectedDate !== undefined;
  const selected = isControlled ? selectedDate ?? null : internalSelected;
  function handleSelect(iso: string) {
    if (!isControlled) setInternalSelected(iso);
    onDateSelect?.(iso);
  }

  useEffect(() => {
    if (currentIndex <= 0) return;
    listRef.current?.scrollToIndex({ index: currentIndex, animated: false });
  }, [currentIndex]);

  // Welcome-анимация с ease-in-out через Animated listener → scrollToOffset
  useEffect(() => {
    if (!welcomeAnimation) return;
    const baseOffset = currentIndex * pageWidth;
    const anim = new Animated.Value(0);
    anim.addListener(({ value }) => {
      listRef.current?.scrollToOffset({ offset: baseOffset + value, animated: false });
    });
    setTimeout(() => {
      Animated.sequence([
        Animated.timing(anim, { toValue: -80, duration: 350, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0,   duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      ]).start(() => anim.removeAllListeners());
    }, 800);
  }, []);

  return (
    <FlatList
      ref={listRef}
      data={weekOffsets}
      keyExtractor={item => String(item)}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      style={{ flexGrow: 0 }}
      getItemLayout={(_, index) => ({
        length: pageWidth,
        offset: pageWidth * index,
        index,
      })}
      initialScrollIndex={currentIndex}
      renderItem={({ item: weekOffset }) => (
        <WeekPage
          weekOffset={weekOffset}
          habitId={habitId}
          habitCreatedAt={createdAt}
          currentWeekLogs={currentWeekLogs}
          goalValue={goalValue}
          trainingDays={trainingDays}
          pageWidth={pageWidth}
          userId={userId}
          horizontalPadding={horizontalPadding}
          noMissIndicator={noMissIndicator}
          selected={selected}
          allowAnySelect={allowAnySelect}
          onSelect={handleSelect}
        />
      )}
    />
  );
}
