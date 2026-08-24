import { View, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import CalendarWeek from '@/components/CalendarWeek';
import CalendarMonthly from '@/components/CalendarMonthly';
import Card from '@/components/Card';
import DropdownPopover from '@/components/DropdownPopover';
import NavigationBar from '@/components/NavigationBar';
import BottomSheet from '@/components/BottomSheet';
import SegmentedControl from '@/components/SegmentedControl';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import EditIcon from '@/assets/icons/Edit.svg';
import DeleteIcon from '@/assets/icons/Delete.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { getHabitLogs, HabitDetail, HabitLog } from '@/lib/api';
import { pluralUnit, genitiveUnit, formatUnit } from '@/lib/units';
import { CHECK_IN_LABELS, SuccessModal, dateToLocalISO, formatDateDots, useDayLogs } from './shared';

export default function SoloHabitScreen({
  habit, onLog, logLoading, onDelete, onComplete, onCompleteNewGoal,
}: {
  habit: HabitDetail;
  onLog: (value: number, date?: string) => void;
  logLoading: boolean;
  onDelete: () => void;
  onComplete: () => void;
  onCompleteNewGoal: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme: scheme } = useSettings();
  const [menuVisible, setMenuVisible] = useState(false);
  const [countModal, setCountModal] = useState(false);
  const [countMode, setCountMode] = useState<'add' | 'replace'>('add');
  const [countInput, setCountInput] = useState('');
  const [countError, setCountError] = useState<string | null>(null);
  const [editingBoolean, setEditingBoolean] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [successLabel, failLabel] = CHECK_IN_LABELS[habit.category ?? ''] ?? ['Выполнил', 'Не выполнил'];
  const isSmoking = habit.category === 'smoking' || habit.category === 'no-smoking';
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;
  const screenBg = scheme === 'dark' ? c.surface.bg : colors.neutral[75];

  const selfId = habit.members.find(m => m.is_self)?.id;
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = habit.week_logs.find(l => l.user_id === selfId && l.date.slice(0, 10) === today);

  // Дата, выбранная тапом по недельному календарю — null значит «сегодня» (live-данные из
  // week_logs). Сбрасывается при уходе с экрана (useState) и при переключении Неделя/Месяц.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const isViewingPast = selectedDate != null;
  const dayLogs = useDayLogs(habit.id, selectedDate);
  const dateLabel = isViewingPast ? formatDateDots(selectedDate!) : 'сегодня';
  const displayValue = isViewingPast ? (dayLogs?.get(selfId ?? -1) ?? 0) : (todayLog?.value ?? 0);
  function handleDateSelect(iso: string) {
    setSelectedDate(iso === today ? null : iso);
  }
  // CalendarWeek держит подсветку выбранного дня во внутреннем стейте — снаружи её не сбросить
  // напрямую. При возврате «к текущей дате» инкрементируем key, чтобы React перемонтировал
  // компонент заново (заодно вернётся и позиция скролла на текущую неделю).
  const [calendarKey, setCalendarKey] = useState(0);
  function resetToToday() {
    setSelectedDate(null);
    setCalendarKey(k => k + 1);
  }

  const isCount = (habit.checkin_type ?? 'boolean') === 'count';
  // count «без цели» — простой счётчик без порога выполнения (goal_value = null).
  const isCountNoGoal = isCount && habit.goal_value == null;

  // Для месячного календаря count-целей нужны все логи (week_logs — только текущая неделя).
  // habit — новый объект после каждого load() в контейнере, поэтому перезапрашиваем при его смене.
  useEffect(() => {
    if (!isCount) return;
    getHabitLogs(habit.id, habit.created_at.slice(0, 10), today, selfId)
      .then(setAllLogs)
      .catch(() => {});
  }, [habit, isCount]);
  // Порог «выполнено» за день: цель (с целью) или 1 (без цели). Зелёные точки — выполненные дни.
  const goalThreshold = habit.goal_value ?? 1;
  const completedDates = allLogs.filter(l => l.value >= goalThreshold).map(l => l.date.slice(0, 10));
  // Красные точки (только с целью): прошедшие дни (от создания до вчера) без выполнения.
  const missedDates = (() => {
    if (isCountNoGoal) return [];
    const done = new Set(completedDates);
    const result: string[] = [];
    const cursor = new Date(habit.created_at.slice(0, 10) + 'T00:00:00');
    const end = new Date(today + 'T00:00:00'); // сегодня не считаем пропущенным
    while (cursor < end) {
      const iso = dateToLocalISO(cursor);
      if (!done.has(iso)) result.push(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
    return result;
  })();

  const isPeriodEnded = habit.duration_type === 'period' && habit.period_end !== null && habit.period_end < today;

  // Показать экран успеха если период завершился
  useEffect(() => {
    if (isPeriodEnded) setShowSuccess(true);
  }, [isPeriodEnded]);

  // Сбросить режим редактирования когда лог появился/обновился
  useEffect(() => {
    if (todayLog != null) setEditingBoolean(false);
  }, [todayLog?.id, todayLog?.value]);

  const checkinType = habit.checkin_type ?? 'boolean';
  const unitLabel = habit.goal_unit && !['boolean', 'count', 'minutes', 'steps'].includes(habit.goal_unit)
    ? habit.goal_unit
    : null;

  function closeCountModal() {
    setCountModal(false);
    setCountMode('add');
    setCountInput('');
    setCountError(null);
  }

  function handleCountSubmit() {
    const input = parseInt(countInput);
    if (countInput === '' || Number.isNaN(input) || input < 1) {
      setCountError('Введите число больше нуля');
      return;
    }
    const value = countMode === 'add' ? (todayLog?.value ?? 0) + input : input;
    setCountError(null);
    closeCountModal();
    onLog(value);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title="Персональная цель"
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

      {/* Шапка: название и описание */}
      <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 8 }}>
        <Text weight="bold" style={{ fontSize: 24, lineHeight: 36, color: c.text.primary, letterSpacing: 0.2 }}>
          {habit.name}
        </Text>
        {habit.description ? (
          <Text weight="semibold" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
            {habit.description}
          </Text>
        ) : null}
      </View>

      {isCount ? (
        <View style={{ marginTop: 24, gap: 16 }}>
          <View style={{ paddingHorizontal: 24 }}>
            <SegmentedControl
              options={[{ label: 'Неделя', value: 'week' }, { label: 'Месяц', value: 'month' }]}
              value={calendarView}
              onChange={v => { setCalendarView(v as 'week' | 'month'); setSelectedDate(null); }}
            />
          </View>
          {calendarView === 'week' ? (
            <CalendarWeek
              key={calendarKey}
              habitId={habit.id}
              habitCreatedAt={habit.created_at}
              currentWeekLogs={habit.week_logs.filter(l => l.user_id === selfId)}
              goalValue={habit.goal_value ?? 1}
              noMissIndicator={isCountNoGoal}
              onDateSelect={handleDateSelect}
            />
          ) : (
            <View style={{ paddingHorizontal: 24 }}>
              <Card style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 0 }}>
                <CalendarMonthly
                  logs={completedDates}
                  missedDates={missedDates}
                  periodStart={habit.created_at.slice(0, 10)}
                />
              </Card>
            </View>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 24 }}>
          <CalendarWeek
            key={calendarKey}
            habitId={habit.id}
            habitCreatedAt={habit.created_at}
            currentWeekLogs={habit.week_logs.filter(l => l.user_id === selfId)}
            goalValue={habit.goal_value ?? 1}
            onDateSelect={handleDateSelect}
          />
        </View>
      )}
      {isCountNoGoal ? (
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              {`Сделано ${dateLabel}`}
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {formatUnit(displayValue, null)}
            </Text>
          </Card>
        </View>
      ) : checkinType === 'count' ? (
        // count «с целью»: карточки всегда про сегодня/выбранную дату (чипы Сегодня/Неделя убраны).
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8, gap: 16 }}
        >
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              {unitLabel ? `${genitiveUnit(unitLabel)} ${dateLabel}` : (isViewingPast ? dateLabel : 'Сегодня')}
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {displayValue}{habit.goal_value != null ? ` / ${habit.goal_value}` : ''}
            </Text>
          </Card>
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak?.current ?? 0}
            </Text>
          </Card>
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Лучший стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak?.max ?? 0}
            </Text>
          </Card>
        </ScrollView>
      ) : (
        <View style={{ padding: 24, gap: 16 }}>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
                Текущий стрик
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
                {habit.streak?.current ?? 0}
              </Text>
            </Card>
            <Card style={{ flex: 1, gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
                Лучший стрик
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
                {habit.streak?.max ?? 0}
              </Text>
            </Card>
          </View>
        </View>
      )}

      {/* Спейсер — отжимает кнопки вниз */}
      <View style={{ flex: 1 }} />

      {/* Bottom — ветка по checkin_type */}
      {isViewingPast ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            label="Вернуться к текущей дате"
            onPress={resetToToday}
          />
        </View>
      ) : isCountNoGoal ? (
        <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Button
              label="Я сделал"
              onPress={() => onLog((todayLog?.value ?? 0) + 1)}
              loading={logLoading}
            />
          </View>
          {(todayLog?.value ?? 0) > 0 && (
            <Button
              variant="icon"
              icon={<EditIcon />}
              onPress={() => {
                setCountMode('replace');
                setCountInput(String(todayLog?.value ?? 0));
                setCountError(null);
                setCountModal(true);
              }}
            />
          )}
        </View>
      ) : checkinType === 'count' ? (
        // Есть запись за сегодня → «Редактировать запись» (правка значения), иначе → «Внести {ед}».
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          {(todayLog?.value ?? 0) > 0 ? (
            <Button
              label="Редактировать запись"
              variant="secondary"
              onPress={() => {
                setCountMode('replace');
                setCountInput(String(todayLog?.value ?? 0));
                setCountError(null);
                setCountModal(true);
              }}
            />
          ) : (
            <Button
              label={`Внести ${pluralUnit(unitLabel)}`}
              onPress={() => {
                setCountMode('add');
                setCountInput('');
                setCountError(null);
                setCountModal(true);
              }}
              loading={logLoading}
            />
          )}
        </View>
      ) : todayLog != null && !editingBoolean ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            label="Редактировать запись"
            variant="secondary"
            onPress={() => setEditingBoolean(true)}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: 24 }}>
          <View style={{ flex: 1 }}>
            <Button
              label={successLabel}
              onPress={() => onLog(1)}
              loading={logLoading}
              // Кастомные Да/Нет — обе кнопки брендовые с иконками ✓/✕ (Figma);
              // готовое «Отказ от курения» остаётся зелёной/красной без иконок.
              color={isSmoking ? colors.green[500] : undefined}
              icon={isSmoking ? undefined : <CheckIcon />}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={failLabel}
              onPress={() => onLog(0)}
              loading={logLoading}
              color={isSmoking ? colors.red[500] : undefined}
              icon={isSmoking ? undefined : <CloseIcon />}
            />
          </View>
        </View>
      )}

      <SuccessModal
        visible={showSuccess}
        onClose={() => { setShowSuccess(false); onComplete(); }}
        onNewGoal={() => { setShowSuccess(false); onCompleteNewGoal(); }}
      />

      {/* Count modal */}
      <BottomSheet
        title={`Внести ${pluralUnit(unitLabel)}`}
        visible={countModal}
        onClose={closeCountModal}
      >
        <View style={{ gap: 16 }}>
          <SegmentedControl
            options={[
              { label: 'Добавить', value: 'add' },
              { label: 'Заменить', value: 'replace' },
            ]}
            value={countMode}
            onChange={v => {
              const mode = v as 'add' | 'replace';
              setCountMode(mode);
              setCountInput(mode === 'replace' ? String(todayLog?.value ?? 0) : '');
              setCountError(null);
            }}
          />
          <Input
            label={countMode === 'add' ? 'Добавление значения' : 'Изменение значения'}
            value={countInput}
            onChangeText={t => { setCountInput(t.replace(/[^0-9]/g, '')); if (countError) setCountError(null); }}
            keyboardType="number-pad"
            maxLength={6}
            error={countError ?? undefined}
          />
          <Button
            label="Сохранить"
            icon={<CheckIcon />}
            onPress={handleCountSubmit}
            loading={logLoading}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
