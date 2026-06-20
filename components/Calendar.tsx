import { useRef, useState, useEffect } from 'react';
import { View, FlatList, Dimensions, ActivityIndicator, Animated, Easing } from 'react-native';
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

function DayCell({ day, weekday, status }: CalendarDay) {
  const { colorScheme } = useSettings();
  const dark = colorScheme === 'dark';
  const boxBg = dark ? colors.neutral[800] : colors.neutral[100];
  const weekdayColor = dark ? colors.neutral[0] : colors.neutral[900];
  const iconColor = (dark ? ICON_DARK : ICON_LIGHT)[status];

  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, textAlign: 'center', color: weekdayColor }}>
        {weekday}
      </Text>
      <View style={{
        height: 62,
        borderRadius: 16,
        backgroundColor: boxBg,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
      }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text weight="bold" style={{ fontSize: 14, lineHeight: 20, color: colors.neutral[500] }}>
            {day}
          </Text>
          <DayIcon status={status} color={iconColor} />
        </View>
      </View>
    </View>
  );
}

// Возвращает пн недели для даты смещённой на weekOffset недель от сегодня
function getWeekMonday(weekOffset: number): Date {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = today.getUTCDay() || 7;
  const mon = new Date(today);
  mon.setUTCDate(today.getUTCDate() - dayOfWeek + 1 + weekOffset * 7);
  return mon;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildDays(
  mon: Date,
  logs: Map<string, number>,
  habitCreatedAt: Date,
  goalValue: number,
  trainingDays?: number[] | null,
): CalendarDay[] {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setUTCDate(mon.getUTCDate() + i);
    const dateStr = toDateStr(d);
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    const loggedValue = logs.get(dateStr);
    const beforeHabit = d < habitCreatedAt;
    // День отдыха (для pullups) — не входит в training_days, без иконки, как inactive
    const isoDay = d.getUTCDay() || 7;
    const isRestDay = trainingDays != null && !trainingDays.includes(isoDay);

    let status: DayStatus;
    if (diff > 0) {
      status = 'future';
    } else if (beforeHabit || isRestDay) {
      status = 'inactive';
    } else if (diff === 0) {
      if (loggedValue !== undefined && loggedValue >= goalValue) status = 'check';
      else if (loggedValue !== undefined) status = 'miss';
      else status = 'current';
    } else {
      status = loggedValue !== undefined && loggedValue >= goalValue ? 'check' : 'miss';
    }
    return { day: d.getUTCDate(), weekday: WEEKDAYS[i], status };
  });
}

// Сколько недель назад была создана привычка (округляем вниз)
function minWeekOffset(habitCreatedAt: Date): number {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const diffMs = today.getTime() - habitCreatedAt.getTime();
  if (diffMs <= 0) return 0;
  const diffWeeks = Math.ceil(diffMs / (7 * 24 * 60 * 60 * 1000));
  return -diffWeeks;
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
};

function WeekPage({ weekOffset, habitId, habitCreatedAt, currentWeekLogs, goalValue, trainingDays, pageWidth, userId, horizontalPadding }: WeekPageProps) {
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
    sun.setUTCDate(mon.getUTCDate() + 6);
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
  const days = logs ? buildDays(mon, logs, habitCreatedAt, goalValue, trainingDays) : [];

  return (
    <View style={{ width: pageWidth, paddingHorizontal: horizontalPadding, height: 86 }}>
      {loading ? (
        <ActivityIndicator
          style={{ flex: 1 }}
          color={colorScheme === 'dark' ? colors.neutral[400] : colors.neutral[500]}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {days.map((d, i) => <DayCell key={i} {...d} />)}
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
};

export default function Calendar({ habitId, habitCreatedAt, currentWeekLogs, goalValue, trainingDays, userId, pageWidth: pageWidthProp, horizontalPadding = 24 }: Props) {
  const createdAt = new Date(habitCreatedAt);
  createdAt.setUTCHours(0, 0, 0, 0);

  const minOffset = minWeekOffset(createdAt);
  // Генерируем индексы недель от minOffset до 0 (текущая)
  const weekOffsets = Array.from(
    { length: -minOffset + 1 },
    (_, i) => minOffset + i,
  );
  // Текущая неделя (offset=0) — последний элемент
  const currentIndex = weekOffsets.length - 1;

  const listRef = useRef<FlatList>(null);
  const { width: screenWidth } = Dimensions.get('window');
  const pageWidth = pageWidthProp ?? screenWidth;

  useEffect(() => {
    if (currentIndex <= 0) return;
    listRef.current?.scrollToIndex({ index: currentIndex, animated: false });
  }, [currentIndex]);

  // Welcome-анимация с ease-in-out через Animated listener → scrollToOffset
  useEffect(() => {
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
        />
      )}
    />
  );
}
