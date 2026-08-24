import { View, Pressable, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import CalendarWeek from '@/components/CalendarWeek';
import CalendarMonthly from '@/components/CalendarMonthly';
import Card from '@/components/Card';
import DropdownPopover from '@/components/DropdownPopover';
import NavigationBar from '@/components/NavigationBar';
import SegmentedControl from '@/components/SegmentedControl';
import Text from '@/components/Text';
import Button from '@/components/Button';
import EditIcon from '@/assets/icons/Edit.svg';
import DeleteIcon from '@/assets/icons/Delete.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { getHabitLogs, HabitDetail, HabitLog } from '@/lib/api';
import { pluralWord, isTodayTrainingDay } from '@/lib/habit-status';
import { INTENSITY_LABEL, dateToLocalISO, isTrainingDayDate, formatDateRu } from './shared';

export default function PullupsHabitScreen({
  habit, onLog, logLoading, onDelete, reloadTrigger,
}: {
  habit: HabitDetail;
  onLog: (value: number, date?: string) => void;
  logLoading: boolean;
  onDelete: () => void;
  reloadTrigger: number;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme: scheme } = useSettings();
  const [menuVisible, setMenuVisible] = useState(false);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [editingBoolean, setEditingBoolean] = useState(false);
  const today = dateToLocalISO(new Date());
  // Дата, выбранная тапом по календарю — null значит «сегодня». План на эту дату
  // показывается карточкой в контенте (как в SoloHabitScreen), без шторки.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  function handleDateSelect(iso: string) {
    setSelectedDate(iso === today ? null : iso);
  }
  // Возврат к сегодня: снимаем выбор и перемонтируем недельный календарь (key), чтобы
  // он заодно прокрутился обратно на текущую неделю — как в Solo/Group.
  const [calendarKey, setCalendarKey] = useState(0);
  function resetToToday() {
    setSelectedDate(null);
    setCalendarKey(k => k + 1);
  }
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  // Приветственная wiggle-анимация недельного календаря — только при самом первом появлении
  // экрана, не при каждом возврате на "Неделя" через переключатель.
  const weekAnimShownRef = useRef(false);
  useEffect(() => {
    if (calendarView === 'week') weekAnimShownRef.current = true;
  }, [calendarView]);
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;
  const screenBg = scheme === 'dark' ? c.surface.bg : colors.neutral[75];

  useEffect(() => {
    const from = habit.created_at.slice(0, 10);
    getHabitLogs(habit.id, from, today)
      .then(setAllLogs)
      .catch(() => {});
  }, [reloadTrigger]);

  // Запись за сегодня берём из habit.week_logs, а не из allLogs: week_logs приходит вместе
  // с самой целью и доступен уже на первом рендере, тогда как allLogs догружается запросом.
  // Иначе кнопки внизу успевают мигнуть «Выполнил/Не выполнил» до ответа сервера.
  const selfId = habit.members.find(m => m.is_self)?.id;
  const todayLog = habit.week_logs.find(l => l.user_id === selfId && l.date.slice(0, 10) === today);

  // Сбросить режим редактирования когда за сегодня появилась/обновилась запись —
  // тот же паттерн, что и в SoloHabitScreen для boolean-чекина.
  useEffect(() => {
    if (todayLog != null) setEditingBoolean(false);
  }, [todayLog?.id, todayLog?.value]);

  // Точка в календаре — только за реально выполненные тренировки (value >= 1),
  // "Не выполнил" тоже создаёт запись (value=0), но не должен выглядеть как отметка о выполнении.
  const completedDates = allLogs.filter(l => l.value >= 1).map(l => l.date.slice(0, 10));
  const completedSet = new Set(completedDates);

  const plan = habit.pullups_plan ?? [];
  const goalAchieved = habit.pullups_session_index >= plan.length;
  const isTrainingDay = !goalAchieved && isTodayTrainingDay(habit.training_days);
  const session = isTrainingDay ? plan[habit.pullups_session_index] : null;

  // 0-based номер тренировки в plan для произвольной даты — считаем тренировочные дни
  // от даты создания цели до выбранной даты включительно. Нужно для тапа по календарю:
  // показать план (подходы/повторения) не только на сегодня, а на любой день в периоде.
  function sessionIndexForDate(iso: string): number {
    if (!habit.training_days || habit.training_days.length === 0) return -1;
    if (!isTrainingDayDate(iso, habit.training_days)) return -1;
    const cursor = new Date(habit.created_at.slice(0, 10) + 'T00:00:00');
    const target = new Date(iso + 'T00:00:00');
    let index = -1;
    let guard = 0;
    while (cursor <= target && guard < 3650) {
      if (isTrainingDayDate(dateToLocalISO(cursor), habit.training_days)) index++;
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return index;
  }

  // План на выбранную дату. Без выбора — сегодняшняя сессия (session выше), с выбором —
  // считаем номер тренировки для этой даты и берём её из плана; не тренировочный день → null.
  const selectedIsTrainingDay = selectedDate != null && isTrainingDayDate(selectedDate, habit.training_days);
  const selectedSessionIndex = selectedDate != null && selectedIsTrainingDay ? sessionIndexForDate(selectedDate) : -1;
  const selectedSession = selectedSessionIndex >= 0 && selectedSessionIndex < plan.length
    ? plan[selectedSessionIndex]
    : null;
  const displaySession = selectedDate != null ? selectedSession : (isTrainingDay ? session : null);

  // Красная точка — тренировочный день без выполненной отметки: явное "Не выполнил" (value=0)
  // в любой момент, или прошедший (до сегодня) тренировочный день, по которому вообще нет записи.
  const missedDates = (() => {
    const explicitMiss = new Set(allLogs.filter(l => l.value === 0).map(l => l.date.slice(0, 10)));
    const result: string[] = [];
    const cursor = new Date(habit.created_at.slice(0, 10) + 'T00:00:00');
    const end = new Date(today + 'T00:00:00');
    while (cursor <= end) {
      const iso = dateToLocalISO(cursor);
      if (isTrainingDayDate(iso, habit.training_days) && !completedSet.has(iso)) {
        if (iso < today || explicitMiss.has(iso)) result.push(iso);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  })();

  // Дата последней тренировки по плану — весь план (plan.length сессий), спроецированный
  // вперёд от даты создания цели по training_days. Даёт periodEnd для календаря: дни после
  // неё вне плана, показываются как "вне периода" — так же, как дни до старта (periodStart).
  const planEndDate = (() => {
    if (!habit.training_days || habit.training_days.length === 0 || plan.length === 0) return undefined;
    const cursor = new Date(habit.created_at.slice(0, 10) + 'T00:00:00');
    let count = 0;
    let last = dateToLocalISO(cursor);
    let guard = 0;
    while (count < plan.length && guard < 3650) {
      const iso = dateToLocalISO(cursor);
      if (isTrainingDayDate(iso, habit.training_days)) {
        count++;
        last = iso;
      }
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return last;
  })();

  // Серая точка — будущие тренировки по плану, от завтра до planEndDate включительно.
  const plannedDates = (() => {
    if (!planEndDate) return [];
    const result: string[] = [];
    const cursor = new Date(today + 'T00:00:00');
    cursor.setDate(cursor.getDate() + 1);
    const end = new Date(planEndDate + 'T00:00:00');
    while (cursor <= end) {
      const iso = dateToLocalISO(cursor);
      if (isTrainingDayDate(iso, habit.training_days)) result.push(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  })();

  const sessionsPerWeek = habit.training_days?.length ?? 0;
  const totalWeeks = sessionsPerWeek > 0 ? Math.round(plan.length / sessionsPerWeek) : 0;
  const currentForm = habit.current_form ?? 0;
  const targetReps = habit.target_reps ?? 0;
  const intensityLabel = habit.intensity ? INTENSITY_LABEL[habit.intensity] : '';
  const planDescription = `Длительность плана - ${totalWeeks} ${pluralWord(totalWeeks, 'неделя', 'недели', 'недель')}. `
    + `Старт - ${currentForm} ${pluralWord(currentForm, 'раз', 'раза', 'раз')} за подход. `
    + `Конечная цель - ${targetReps} ${pluralWord(targetReps, 'раз', 'раза', 'раз')} за подход. `
    + `${sessionsPerWeek} ${pluralWord(sessionsPerWeek, 'тренировка', 'тренировки', 'тренировок')} в неделю со ${intensityLabel} интенсивностью.`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title={habit.type === 'group' ? 'Групповая цель' : 'Персональная цель'}
          onBack={() => router.back()}
          right={
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
              {({ pressed }) => (
                <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
                  <MoreVerticalIcon width={24} height={24} color={c.text.primary} />
                </View>
              )}
            </Pressable>
          }
        />
      </View>

      <DropdownPopover
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        items={[
          {
            label: 'Редактировать',
            icon: () => <EditIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => { setMenuVisible(false); router.push(`/(tabs)/edit-habit/${habit.id}` as any); },
          },
          {
            label: 'Удалить',
            icon: () => <DeleteIcon width={24} height={24} color={colors.red[500]} />,
            onPress: onDelete,
            destructive: true,
          },
        ]}
      />

      {/* Шапка: заголовок + описание (если есть) + информация о тренировках */}
      <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 8 }}>
        <Text weight="bold" style={{ fontSize: 24, lineHeight: 36, color: c.text.primary, letterSpacing: 0.2 }}>
          {habit.name}
        </Text>
        {habit.description ? (
          <Text weight="semibold" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
            {habit.description}
          </Text>
        ) : null}
        {goalAchieved ? (
          <Text weight="bold" style={{ fontSize: 20, lineHeight: 20 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
            Цель достигнута! {targetReps} {pluralWord(targetReps, 'раз', 'раза', 'раз')} за подход
          </Text>
        ) : (
          <Text weight="semibold" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
            {planDescription}
          </Text>
        )}
      </View>

      <View style={{ paddingTop: 24, gap: 16 }}>
        <View style={{ paddingHorizontal: 24 }}>
          <SegmentedControl
            options={[
              { label: 'Неделя', value: 'week' },
              { label: 'Месяц', value: 'month' },
            ]}
            value={calendarView}
            onChange={v => { setCalendarView(v as 'week' | 'month'); setSelectedDate(null); }}
          />
        </View>
        {calendarView === 'week' ? (
          // Без paddingHorizontal-обёртки — CalendarWeek сам управляет шириной FlatList
          // (пейджинг по полной ширине экрана) и применяет отступ 24 внутри каждой страницы.
          <CalendarWeek
            key={calendarKey}
            habitId={habit.id}
            habitCreatedAt={habit.created_at}
            currentWeekLogs={habit.week_logs.filter(l => l.user_id === selfId)}
            goalValue={1}
            trainingDays={habit.training_days}
            totalWeeks={totalWeeks}
            welcomeAnimation={!weekAnimShownRef.current}
            onDateSelect={handleDateSelect}
            allowAnySelect
            selectedDate={selectedDate}
          />
        ) : (
          <View style={{ paddingHorizontal: 24 }}>
            <Card style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 0 }}>
              <CalendarMonthly
                key={calendarKey}
                logs={completedDates}
                missedDates={missedDates}
                plannedDates={plannedDates}
                periodStart={habit.created_at.slice(0, 10)}
                periodEnd={planEndDate}
                selectedDate={selectedDate ?? undefined}
                onDateSelect={handleDateSelect}
                allowFutureSelect
              />
            </Card>
          </View>
        )}
      </View>

      {!goalAchieved && (
        <View style={{ padding: 24, gap: 16 }}>
          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
              {selectedDate != null ? `План на ${formatDateRu(selectedDate, today).toLowerCase()}` : 'Цель на сегодня'}
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
              {displaySession
                ? `${displaySession.sets} ${pluralWord(displaySession.sets, 'подход', 'подхода', 'подходов')} по ${displaySession.reps} ${pluralWord(displaySession.reps, 'повторение', 'повторения', 'повторений')}`
                : 'Отдых'}
            </Text>
          </Card>
        </View>
      )}

      {/* Спейсер — отжимает кнопки/CTA вниз */}
      <View style={{ flex: 1 }} />

      {selectedDate != null ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            label="Вернуться к текущей дате"
            onPress={resetToToday}
          />
        </View>
      ) : isTrainingDay && todayLog != null && !editingBoolean ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            label="Редактировать запись"
            variant="secondary"
            onPress={() => setEditingBoolean(true)}
          />
        </View>
      ) : isTrainingDay ? (
        <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Выполнил"
              icon={<CheckIcon />}
              onPress={() => onLog(1)}
              loading={logLoading}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Не выполнил"
              icon={<CloseIcon />}
              onPress={() => onLog(0)}
              loading={logLoading}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
