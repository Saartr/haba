import {
  View,
  ScrollView,
  Pressable,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Share,
  Dimensions,
} from 'react-native';
import { Clipboard } from 'react-native';
import Calendar from '@/components/Calendar';
import CalendarMonthly from '@/components/CalendarMonthly';
import Card from '@/components/Card';
import Chip from '@/components/Chip';
import DropdownPopover from '@/components/DropdownPopover';
import NavigationBar from '@/components/NavigationBar';
import EditIcon from '@/assets/icons/Edit.svg';
import DeleteIcon from '@/assets/icons/Delete.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import { useConfirm } from '@/components/ConfirmModal';
import { useSnackbar } from '@/lib/snackbar-context';
import BottomSheet from '@/components/BottomSheet';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import ShareIcon from '@/assets/icons/Share.svg';
import LinkIcon from '@/assets/icons/Link.svg';
import BlockIcon from '@/assets/icons/Block.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import FootprintIcon from '@/assets/icons/Footprint.svg';
import SupervisorAccountIcon from '@/assets/icons/SupervisorAccount.svg';
import LogoutIcon from '@/assets/icons/Logout.svg';
import DeleteForeverIcon from '@/assets/icons/DeleteForever.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import {
  getHabit,
  logHabit,
  getHabitLogs,
  syncHabitSteps,
  leaveHabit,
  transferHabit,
  excludeMember,
  closeHabit,
  getStepHabits,
  HabitDetail,
  HabitLog,
  HabitMember,
} from '@/lib/api';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { BASE_URL } from '@/lib/config';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  getTodaySteps,
  getStepsByDays,
} from '@/lib/health';
import SegmentedControl from '@/components/SegmentedControl';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getNotificationsModule } from '@/lib/notifications';

// ─── helpers ──────────────────────────────────────────────────────────────────


const CHECK_IN_LABELS: Record<string, [string, string]> = {
  smoking:    ['Не курил', 'Курил'],
  'no-smoking': ['Не курил', 'Курил'],
};

import { pluralUnit, genitiveUnit } from '@/lib/units';


function SoloHabitScreen({
  habit, onLog, logLoading, onDelete,
}: {
  habit: HabitDetail;
  onLog: (value: number, date?: string) => void;
  logLoading: boolean;
  onDelete: () => void;
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
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [editingBoolean, setEditingBoolean] = useState(false);
  const [successLabel, failLabel] = CHECK_IN_LABELS[habit.category ?? ''] ?? ['Выполнил', 'Не выполнил'];
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const selfId = habit.members.find(m => m.is_self)?.id;
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = habit.week_logs.find(l => l.user_id === selfId && l.date.slice(0, 10) === today);
  const loggedToday = todayLog != null && todayLog.value > 0;

  // Сбросить режим редактирования когда лог появился/обновился
  useEffect(() => {
    if (todayLog != null) setEditingBoolean(false);
  }, [todayLog?.id, todayLog?.value]);

  const checkinType = habit.checkin_type ?? 'boolean';
  const unitLabel = habit.goal_unit && !['boolean', 'count', 'minutes', 'steps'].includes(habit.goal_unit)
    ? habit.goal_unit
    : null;

  const weekValue = habit.week_logs
    .filter(l => l.user_id === selfId)
    .reduce((sum, l) => sum + l.value, 0);
  const periodValue = period === 'week' ? weekValue : (todayLog?.value ?? 0);
  const periodGoal = habit.goal_value != null
    ? (period === 'week' ? habit.goal_value * 7 : habit.goal_value)
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }} edges={['bottom']}>
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

      <View style={{ marginTop: 24 }}>
        <Calendar
          habitId={habit.id}
          habitCreatedAt={habit.created_at}
          currentWeekLogs={habit.week_logs.filter(l => l.user_id === selfId)}
          goalValue={habit.goal_value ?? 1}
        />
      </View>
      {checkinType === 'count' ? (
        <>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 16 }}>
            <Chip label="Сегодня" selected={period === 'today'} onPress={() => setPeriod('today')} />
            <Chip label="Неделя" selected={period === 'week'} onPress={() => setPeriod('week')} />
          </View>
          <Text weight="semibold" style={{ fontSize: 16, lineHeight: 26, color: c.text.primary, paddingHorizontal: 24, paddingTop: 16, letterSpacing: 0.2 }}>
            Персональный результат
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8, gap: 16 }}
          >
            <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                {unitLabel
                  ? (period === 'week' ? `${genitiveUnit(unitLabel)} за неделю` : `${genitiveUnit(unitLabel)} сегодня`)
                  : (period === 'week' ? 'За неделю' : 'Сегодня')}
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                {periodValue}{periodGoal != null ? ` / ${periodGoal}` : ''}
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
                Максимальный
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                {habit.streak?.max ?? 0}
              </Text>
            </Card>
          </ScrollView>
        </>
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
      {checkinType === 'count' ? (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
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
              color={colors.green[500]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label={failLabel}
              onPress={() => onLog(0)}
              loading={logLoading}
              color={colors.red[500]}
            />
          </View>
        </View>
      )}

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

// ─── progression helpers ──────────────────────────────────────────────────────

function isRestDay(iso: string, periodicity: string, weekdays: number[] | null): boolean {
  if (periodicity !== 'weekdays' || !weekdays || weekdays.length === 0) return false;
  const dow = new Date(iso + 'T00:00:00').getDay(); // 0=Вс..6=Сб
  const isoDay = dow === 0 ? 7 : dow; // 1=Пн..7=Вс
  return !weekdays.includes(isoDay);
}

const MONTHS_RU_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function formatDateRu(iso: string, todayIso: string): string {
  if (iso === todayIso) return 'Сегодня';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_RU_GEN[m - 1]}`;
}

function formatDateDots(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function ProgressionHabitScreen({
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
  const [countModal, setCountModal] = useState(false);
  const [countMode, setCountMode] = useState<'add' | 'replace'>('add');
  const [countInput, setCountInput] = useState('');
  const [countError, setCountError] = useState<string | null>(null);
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);

  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const unitLabel = habit.goal_unit ?? null;

  useEffect(() => {
    const from = habit.created_at.slice(0, 10);
    const to = today;
    getHabitLogs(habit.id, from, to)
      .then(setAllLogs)
      .catch(() => {});
  }, [reloadTrigger]);

  const selectedLog = allLogs.find(l => l.date.slice(0, 10) === selectedDate);
  const isSelectedFuture = selectedDate > today;
  const isRest = isRestDay(selectedDate, habit.periodicity, habit.weekdays);
  const bestValue = allLogs.length > 0 ? Math.max(...allLogs.map(l => l.value)) : 0;
  const goalReached = habit.goal_value != null && bestValue >= habit.goal_value;

  function openCountModal() {
    setCountMode(selectedLog ? 'replace' : 'add');
    setCountInput(selectedLog ? String(selectedLog.value) : '');
    setCountError(null);
    setCountModal(true);
  }

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
    const value = countMode === 'add' ? (selectedLog?.value ?? 0) + input : input;
    setCountError(null);
    closeCountModal();
    onLog(value, selectedDate);
  }

  const logDates = allLogs.map(l => l.date.slice(0, 10));
  const ctaLabel = selectedDate === today
    ? 'Внести сегодня'
    : `Внести за ${formatDateRu(selectedDate, today).toLowerCase()}`;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }} edges={['bottom']}>
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

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Шапка */}
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

        {/* Календарь в карточке */}
        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          <Card style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 0 }}>
            <CalendarMonthly
              logs={logDates}
              periodStart={habit.created_at.slice(0, 10)}
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
            />
          </Card>
        </View>

        {/* Две карточки: результат за выбранную дату + лучший результат/цель */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 16 }}
        >
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              {isRest ? 'День отдыха' : (selectedDate === today ? 'Сегодня' : formatDateDots(selectedDate))}
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {isRest ? '—' : (selectedLog
                ? `${selectedLog.value}${unitLabel ? ' ' + pluralUnit(unitLabel) : ''}`
                : '0')}
            </Text>
          </Card>
          <Card style={{ gap: 4, alignSelf: 'flex-start' }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              {goalReached ? 'Цель достигнута!' : 'Лучший результат'}
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: goalReached ? c.brand.primary : c.text.primary, letterSpacing: 0.2 }}>
              {bestValue > 0 ? bestValue : '—'}
              {habit.goal_value != null ? ` / ${habit.goal_value}` : ''}
              {unitLabel ? ` ${pluralUnit(unitLabel)}` : ''}
            </Text>
          </Card>
        </ScrollView>
      </ScrollView>

      {/* CTA */}
      {!goalReached && !isRest && (
        <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
          <Button
            label={selectedLog ? 'Редактировать запись' : ctaLabel}
            variant={selectedLog ? 'secondary' : undefined}
            onPress={openCountModal}
            loading={logLoading}
            disabled={isSelectedFuture}
          />
        </View>
      )}

      {/* Count modal */}
      <BottomSheet
        title="Внести результат"
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
              setCountInput(mode === 'replace' ? String(selectedLog?.value ?? 0) : '');
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

function isTodayTrainingDay(trainingDays: number[] | null): boolean {
  if (!trainingDays) return false;
  const dow = new Date().getDay(); // 0=Вс..6=Сб
  const isoDay = dow === 0 ? 7 : dow; // 1=Пн..7=Вс
  return trainingDays.includes(isoDay);
}

function pluralWord(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const INTENSITY_LABEL: Record<string, string> = { low: 'низкой', medium: 'средней', high: 'высокой' };

function PullupsHabitScreen({
  habit, onLog, logLoading, onDelete,
}: {
  habit: HabitDetail;
  onLog: (value: number, date?: string) => void;
  logLoading: boolean;
  onDelete: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme: scheme } = useSettings();
  const [menuVisible, setMenuVisible] = useState(false);
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const plan = habit.pullups_plan ?? [];
  const goalAchieved = habit.pullups_session_index >= plan.length;
  const isTrainingDay = !goalAchieved && isTodayTrainingDay(habit.training_days);
  const session = isTrainingDay ? plan[habit.pullups_session_index] : null;

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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }} edges={['bottom']}>
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

      <View style={{ marginTop: 24 }}>
        <Calendar
          habitId={habit.id}
          habitCreatedAt={habit.created_at}
          currentWeekLogs={habit.week_logs.filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)}
          goalValue={1}
          trainingDays={habit.training_days}
          totalWeeks={totalWeeks}
        />
      </View>

      {!goalAchieved && (
        <View style={{ padding: 24, gap: 16 }}>
          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary }}>
              Цель на сегодня
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary }}>
              {isTrainingDay && session
                ? `${session.sets} ${pluralWord(session.sets, 'подход', 'подхода', 'подходов')} по ${session.reps} ${pluralWord(session.reps, 'повторение', 'повторения', 'повторений')}`
                : 'Отдых'}
            </Text>
          </Card>
        </View>
      )}

      {/* Спейсер — отжимает кнопки/CTA вниз */}
      <View style={{ flex: 1 }} />

      {isTrainingDay ? (
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

// ─── sub-components ───────────────────────────────────────────────────────────


// Заголовок раздела («Персональный результат», «Все участники») — 16px semibold
function SectionTitle({ children }: { children: string }) {
  const c = useColors();
  return (
    <Text weight="semibold" style={{ fontSize: 16, lineHeight: 26, color: c.text.primary, paddingHorizontal: 24, letterSpacing: 0.2 }}>
      {children}
    </Text>
  );
}

// Аватар участника: фото или инициал имени
function MemberAvatar({ member }: { member: HabitMember }) {
  const name = member.first_name ?? member.username ?? '?';
  const initial = name[0].toUpperCase();
  if (member.avatar_url) {
    return (
      <Image source={{ uri: member.avatar_url }}
        style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.neutral[500] }} />
    );
  }
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2,
      borderColor: colors.neutral[500], backgroundColor: colors.neutral[50],
      alignItems: 'center', justifyContent: 'center' }}>
      <Text weight="bold" style={{ fontSize: 20, color: colors.neutral[500], lineHeight: 30 }}>
        {initial}
      </Text>
    </View>
  );
}

function MemberRow({
  member, goalValue, value, isCreator, onExclude, onOpen,
}: {
  member: HabitMember;
  goalValue: number | null;
  value: number | null;
  isCreator: boolean;
  onExclude: (id: number) => void;
  onOpen: (member: HabitMember) => void;
}) {
  const c = useColors();
  const { colorScheme } = useSettings();
  const rippleColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
  const name = member.first_name ?? member.username ?? '?';
  const displayName = member.is_self ? `${name} (Я)` : name;

  const stepsLabel = goalValue != null
    ? `${(value ?? 0).toLocaleString('ru-RU')} / ${goalValue.toLocaleString('ru-RU')}`
    : value != null ? String(value) : '—';

  return (
    <Pressable
      onPress={() => onOpen(member)}
      style={({ pressed }) => ({
        paddingVertical: 4,
        borderRadius: 16,
        backgroundColor: pressed ? rippleColor : 'transparent',
      })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <MemberAvatar member={member} />
            <View>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                {displayName}
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                {stepsLabel}
              </Text>
            </View>
          </View>
          {isCreator && !member.is_self && (
            <Pressable onPress={() => onExclude(member.id)} hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
              <BlockIcon width={24} height={24} color={c.text.secondary} />
            </Pressable>
          )}
        </View>
      </Pressable>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

function formatSyncedAt(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${min}`;
}

export default function HabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const showSnackbar = useSnackbar();
  const { colorScheme: scheme, settings } = useSettings();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = parseInt(id);

  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // Сбрасываем стейт при смене habitId — чтобы не показывать данные предыдущей цели
  useEffect(() => {
    setHabit(null);
    setLoading(true);
  }, [habitId]);
  const [logLoading, setLogLoading] = useState(false);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [stepsModal, setStepsModal] = useState(false);
  const [gfInfoModal, setGfInfoModal] = useState(false);
  const [stepsMode, setStepsMode] = useState<'add' | 'replace'>('add');
  const [stepsInput, setStepsInput] = useState('');
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [detailMember, setDetailMember] = useState<HabitMember | null>(null);

  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' : 'dark-content';

  const load = useCallback(async () => {
    try {
      const data = await getHabit(habitId);
      setHabit(data);
      setReloadTrigger(t => t + 1);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  // useFocusEffect, не useEffect — чтобы данные подтягивались при возврате
  // с экрана редактирования (название/описание/настройки цели), а не только при маунте.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Обновляем экран при получении foreground-уведомления по этой цели
  // (новый участник вступил или кто-то внёс данные).
  useEffect(() => {
    const N = getNotificationsModule();
    if (!N) return;
    const sub = N.addNotificationReceivedListener((notification: any) => {
      const data = notification.request.content.data;
      if (data?.habitId && String(data.habitId) === String(habitId)) {
        load();
      }
    });
    return () => sub.remove();
  }, [habitId, load]);

  // Автосинк шагов из Health Connect при загрузке:
  // читаем шаги с даты создания привычки до сегодня и досинкаем все дни с данными.
  useEffect(() => {
    if (!habit || habit.category !== 'steps' || Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        const granted = await hasStepsPermission();
        if (!granted || cancelled) return;

        const createdAt = new Date(habit.created_at);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / msPerDay) + 1;
        // Не более 90 дней — разумный предел чтобы не читать HC за всю историю
        const daysToSync = Math.min(daysSinceCreation, 90);

        const stepsByDay = await getStepsByDays(daysToSync);
        if (cancelled || Object.keys(stepsByDay).length === 0) return;

        const createdDateStr = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
        let synced = false;
        for (const [date, steps] of Object.entries(stepsByDay)) {
          if (cancelled) break;
          // Не синкаем дни раньше даты создания привычки
          if (date < createdDateStr) continue;
          await syncHabitSteps(habitId, steps, 'health_connect', date);
          synced = true;
        }

        if (!cancelled && synced) load();
      } catch (e) {
        console.warn('[health] auto-sync failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [habit?.id, habit?.category, habitId, load]);

  const me = habit?.members.find(m => m.is_self);
  const today = new Date().toISOString().slice(0, 10);
  const myTodayLog = habit?.week_logs.find(l => l.user_id === me?.id && l.date.slice(0, 10) === today);

  function todayValueFor(memberId: number) {
    return habit?.week_logs.find(l => l.user_id === memberId && l.date.slice(0, 10) === today)?.value ?? null;
  }

  // Сумма шагов участника за текущую неделю (пн–вс)
  function weekValueFor(memberId: number) {
    return habit?.week_logs
      .filter(l => l.user_id === memberId)
      .reduce((sum, l) => sum + l.value, 0) ?? 0;
  }

  // Значение участника для выбранного периода: сегодня / накопительно за неделю
  function memberValueFor(memberId: number): number | null {
    return period === 'week' ? weekValueFor(memberId) : todayValueFor(memberId);
  }

  // Знаменатель цели для периода: дневная цель N / N×7 за неделю
  const periodGoal = habit?.goal_value != null
    ? (period === 'week' ? habit.goal_value * 7 : habit.goal_value)
    : null;
  // Персональное число шагов за период
  const personalSteps = period === 'week'
    ? weekValueFor(me?.id ?? -1)
    : (myTodayLog?.value ?? 0);

  // Карточки в модалке детализации: в тёмной теме фон cardGrey (иначе сливаются со шторкой)
  // и без тени; в светлой — дефолтный фон и тень Card
  // Карточки в модалке детализации: фон cardGrey (светлая → neutral[100], тёмная → neutral[700]),
  // тень выключена в обеих темах.
  const detailCardStyle = { gap: 4, backgroundColor: c.surface.cardGrey, shadowOpacity: 0, elevation: 0 };

  async function handleCloseGroup() {
    setMenuVisible(false);
    const ok = await confirm({
      title: 'Закрыть группу?',
      description: 'Это действие необратимо — вся информация о цели будет стёрта.',
      confirmLabel: 'Закрыть',
      confirmIcon: () => <DeleteForeverIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try {
      await closeHabit(habitId);
      if (Platform.OS === 'android' && habit?.category === 'steps') {
        getStepHabits().then(({ ids, startDates }) => ids.length > 0 ? scheduleSync(BASE_URL, ids, startDates) : cancelSync()).catch(() => {});
      }
      router.back();
      showSnackbar('Цель удалена', 'success');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  async function handleTransfer(memberId: number) {
    setTransferModal(false);
    const member = habit?.members.find(m => m.id === memberId);
    const name = member?.first_name ?? member?.username ?? 'участника';
    const ok = await confirm({
      title: 'Передать права?',
      description: `${name} станет создателем этой цели. Вы останетесь участником.`,
      confirmLabel: 'Передать',
      confirmIcon: () => <SupervisorAccountIcon width={24} height={24} color={c.icon.onPrimary} />,
    });
    if (!ok) return;
    try {
      await transferHabit(habitId, memberId);
      load();
      showSnackbar('Права переданы', 'success');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  async function handleLeave() {
    setMenuVisible(false);
    const ok = await confirm({
      title: 'Выйти из цели?',
      description: 'Вы перестанете участвовать в этой групповой цели.',
      confirmLabel: 'Выйти',
      confirmIcon: () => <LogoutIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try { await leaveHabit(habitId); router.back(); showSnackbar('Вы вышли из цели', 'success'); } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  async function handleExclude(memberId: number) {
    const ok = await confirm({
      title: 'Исключить',
      description: 'После исключения вся информация об участнике будет удалена из группы',
      confirmLabel: 'Подтвердить',
      destructive: true,
    });
    if (!ok) return;
    try {
      await excludeMember(habitId, memberId);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  async function handleConnectTracker() {
    if (Platform.OS !== 'android') {
      Alert.alert('Скоро', 'Подключение трекера на iOS пока недоступно');
      return;
    }
    setTrackerLoading(true);
    try {
      const available = await isHealthConnectAvailable();
      if (!available) {
        Alert.alert(
          'Health Connect не найден',
          'Установите приложение Health Connect из Play Store, затем попробуйте снова.',
          [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Открыть Play Store',
              onPress: () =>
                Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
                  Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
                ),
            },
          ],
        );
        return;
      }
      const granted = await requestStepsPermission();
      if (!granted) {
        Alert.alert('Доступ не получен', 'Без доступа к шагам синк не сработает.');
        return;
      }
      const steps = await getTodaySteps();
      if (steps > 0) await syncHabitSteps(habitId, steps, 'health_connect');
      setStepsModal(false);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e?.message ?? 'Не удалось подключить трекер');
    } finally {
      setTrackerLoading(false);
    }
  }

  function closeStepsModal() {
    setStepsModal(false);
    setStepsMode('add');
    setStepsInput('');
    setStepsError(null);
  }

  async function handleStepsSubmit() {
    const input = parseInt(stepsInput);
    if (stepsInput === '' || Number.isNaN(input)) {
      setStepsError('Введите число');
      return;
    }
    if (stepsMode === 'add' && input < 1) {
      setStepsError('Введите число больше нуля');
      return;
    }
    if (stepsMode === 'replace' && input < 0) {
      setStepsError('Введите число');
      return;
    }
    const value = stepsMode === 'add' ? (myTodayLog?.value ?? 0) + input : input;
    if (value > 100000) {
      setStepsError('Значение не должно превышать 100 000');
      return;
    }
    setStepsError(null);
    setLogLoading(true);
    closeStepsModal();
    try {
      await logHabit(habitId, value);
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  const inviteLink = habit ? `https://bot.mihmih.pro/join/${habit.invite_code}` : '';

  function handleCopyInvite() {
    if (!habit) return;
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareInvite() {
    if (!habit) return;
    setInviteModal(false);
    try {
      await Share.share({ message: inviteLink });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  async function handleSoloLog(value: number, date?: string) {
    setLogLoading(true);
    try {
      const log = await logHabit(habitId, value, date);
      if (log.pullups_recalculated) {
        showSnackbar('Тренировка пропущена — план пересчитан', 'error');
      }
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  if (loading || !habit) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.brand.primary} />
      </SafeAreaView>
    );
  }

  async function handleDeleteSolo() {
    const ok = await confirm({
      title: 'Удалить цель?',
      description: 'Это действие необратимо — вся информация о цели будет стёрта.',
      confirmLabel: 'Удалить',
      confirmIcon: () => <DeleteForeverIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try {
      await closeHabit(habitId);
      if (Platform.OS === 'android' && habit?.category === 'steps') {
        getStepHabits().then(({ ids, startDates }) => ids.length > 0 ? scheduleSync(BASE_URL, ids, startDates) : cancelSync()).catch(() => {});
      }
      router.back();
      showSnackbar('Цель удалена', 'success');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  if (habit.type === 'solo' && habit.category === 'pullups') {
    return (
      <PullupsHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
      />
    );
  }

  if (habit.type === 'solo' && habit.checkin_type === 'progression') {
    return (
      <ProgressionHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
        reloadTrigger={reloadTrigger}
      />
    );
  }

  if (habit.type === 'solo') {
    return (
      <SoloHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Nav bar */}
      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title="Групповая цель"
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
          ...(habit.is_creator ? [{
            label: 'Редактировать',
            icon: () => <EditIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => { setMenuVisible(false); router.push(`/(tabs)/edit-habit/${habit.id}` as any); },
          }] : []),
          {
            label: 'Пригласить в группу',
            icon: () => <ShareIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => setInviteModal(true),
          },
          ...(habit.is_creator && habit.members.length > 1 ? [{
            label: 'Передать права',
            icon: () => <SupervisorAccountIcon width={24} height={24} color={c.text.secondary} />,
            onPress: () => { setMenuVisible(false); setTransferModal(true); },
          }] : []),
          ...(!habit.is_creator && habit.members.length > 1 ? [{
            label: 'Выйти из цели',
            icon: () => <LogoutIcon width={24} height={24} color={c.text.secondary} />,
            onPress: handleLeave,
          }] : []),
          ...(habit.is_creator ? [{
            label: 'Удалить',
            icon: () => <DeleteForeverIcon width={24} height={24} color={colors.red[500]} />,
            onPress: handleCloseGroup,
            destructive: true,
          }] : []),
        ]}
      />

      <ScrollView contentContainerStyle={{ paddingVertical: 24, gap: 16 }}>
        {/* Шапка: название и описание */}
        <View style={{ paddingHorizontal: 24, gap: 8 }}>
          <Text weight="bold" style={{ fontSize: 24, lineHeight: 36, color: c.text.primary, letterSpacing: 0.2 }}>
            {habit.name}
          </Text>
          {habit.description ? (
            <Text weight="semibold" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
              {habit.description}
            </Text>
          ) : null}
        </View>

        <Calendar
          habitId={habit.id}
          habitCreatedAt={habit.created_at}
          currentWeekLogs={habit.week_logs.filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)}
          goalValue={habit.goal_value ?? 1}
        />

        {/* Период */}
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 24 }}>
          <Chip label="Сегодня" selected={period === 'today'} onPress={() => setPeriod('today')} />
          <Chip label="Неделя" selected={period === 'week'} onPress={() => setPeriod('week')} />
        </View>

        {/* Персональный результат */}
        <SectionTitle>Персональный результат</SectionTitle>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: -16 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
        >
          {habit.category === 'steps' && (
            <Card style={{ gap: 4 }}>
              <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                {period === 'week' ? 'Шагов за неделю' : 'Шагов сегодня'}
              </Text>
              <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                {personalSteps.toLocaleString('ru-RU')}
                {periodGoal != null ? ` / ${periodGoal.toLocaleString('ru-RU')}` : ''}
              </Text>
            </Card>
          )}

          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak.current}
            </Text>
          </Card>

          <Card style={{ gap: 4 }}>
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              Максимальный
            </Text>
            <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
              {habit.streak.max}
            </Text>
          </Card>
        </ScrollView>

        {/* Все участники */}
        <SectionTitle>Все участники</SectionTitle>
        <View style={{ paddingHorizontal: 24 }}>
          <Card style={{ gap: 16 }}>
            {habit.members.map(m => (
              <MemberRow
                key={m.id}
                member={m}
                goalValue={periodGoal}
                value={memberValueFor(m.id)}
                isCreator={habit.is_creator}
                onExclude={handleExclude}
                onOpen={setDetailMember}
              />
            ))}
          </Card>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button
          label="Внести шаги"
          onPress={() => {
            const manualOverrideToday = myTodayLog?.source === 'manual';
            if (settings.googleFit === 'on' && !manualOverrideToday) {
              setGfInfoModal(true);
            } else {
              setStepsMode('add');
              setStepsInput('');
              setStepsModal(true);
            }
          }}
          loading={logLoading}
          icon={<FootprintIcon />}
        />
      </View>

      {/* Invite modal */}
      <BottomSheet title="Пригласить в группу" visible={inviteModal} onClose={() => { setInviteModal(false); setCopied(false); }}>
        <View style={{ gap: 16 }}>
          <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2 }}>
            Любой человек может вступить в групповую цель по этой ссылке
          </Text>
          <Text
            weight="bold"
            numberOfLines={1}
            style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.link, letterSpacing: 0.2 }}
          >
            {inviteLink}
          </Text>
          <Button
            label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'}
            icon={copied ? <CheckIcon /> : <LinkIcon />}
            color={copied ? colors.green[500] : undefined}
            onPress={handleCopyInvite}
          />
          <Button
            label="Пригласить"
            icon={<ShareIcon />}
            onPress={handleShareInvite}
          />
        </View>
      </BottomSheet>

      {/* Transfer modal — выбор нового создателя */}
      <BottomSheet title="Передать права" visible={transferModal} onClose={() => setTransferModal(false)}>
        <View style={{ gap: 4, marginHorizontal: -24 }}>
          {habit.members.map(member => {
            const name = member.first_name ?? member.username ?? '?';
            const initial = name[0].toUpperCase();
            const isSelf = member.is_self;
            return (
              <Pressable
                key={member.id}
                onPress={() => !isSelf && handleTransfer(member.id)}
                android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  paddingVertical: 12,
                  paddingHorizontal: 24,
                  backgroundColor: isSelf ? c.surface.cardGrey : 'transparent',
                }}
              >
                {member.avatar_url ? (
                  <Image source={{ uri: member.avatar_url }}
                    style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: colors.neutral[500] }} />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 2,
                    borderColor: colors.neutral[500], backgroundColor: colors.neutral[50],
                    alignItems: 'center', justifyContent: 'center' }}>
                    <Text weight="bold" style={{ fontSize: 20, color: colors.neutral[500], lineHeight: 30 }}>
                      {initial}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text weight="semibold" style={{ fontSize: 16, color: isSelf ? c.text.secondary : c.text.primary, letterSpacing: 0.2 }}>
                    {isSelf ? `${name} (Вы, создатель)` : name}
                  </Text>
                </View>
                {isSelf && <CheckIcon width={24} height={24} color={c.text.secondary} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>

      {/* GF Info modal — показывается первым когда Google Fit подключён */}
      <BottomSheet
        title="Внести шаги"
        visible={gfInfoModal}
        onClose={() => setGfInfoModal(false)}
      >
        <View style={{ gap: 16 }}>
          <Text weight="medium" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2 }}>
            {'У тебя подключён Google Fit — шаги подтянутся сами, без твоего участия. Если выберешь ручной ввод, то автосинхронизация на сегодня отключится. Завтра снова включится.'}
          </Text>
          {habit.last_synced_at != null && (
            <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
              {'Последнее обновление: ' + formatSyncedAt(habit.last_synced_at)}
            </Text>
          )}
          <Button
            variant="secondary"
            label="Ввести вручную"
            onPress={() => {
              setGfInfoModal(false);
              setStepsMode('add');
              setStepsInput('');
              setStepsError(null);
              setStepsModal(true);
            }}
          />
        </View>
      </BottomSheet>

      {/* Steps modal — форма с Segmented (Добавить / Заменить) */}
      <BottomSheet
        title="Внести шаги"
        visible={stepsModal}
        onClose={closeStepsModal}
      >
        <View style={{ gap: 16 }}>
          {settings.googleFit === 'on' && myTodayLog?.source === 'manual' && (
            <Text weight="medium" style={{ fontSize: 16, lineHeight: 16 * 1.6, color: c.text.secondary, letterSpacing: 0.2 }}>
              Автосинхронизация с Google Fit на сегодня отключена. Завтра снова включится.
            </Text>
          )}
          <SegmentedControl
            options={[
              { label: 'Добавить', value: 'add' },
              { label: 'Заменить', value: 'replace' },
            ]}
            value={stepsMode}
            onChange={v => {
              const mode = v as 'add' | 'replace';
              setStepsMode(mode);
              setStepsInput(mode === 'replace' ? String(myTodayLog?.value ?? 0) : '');
              setStepsError(null);
            }}
          />
          <Input
            label={stepsMode === 'add' ? 'Добавление значения' : 'Изменение значения'}
            value={stepsInput}
            onChangeText={t => { setStepsInput(t.replace(/[^0-9]/g, '')); if (stepsError) setStepsError(null); }}
            keyboardType="number-pad"
            maxLength={6}
            error={stepsError ?? undefined}
          />
          <Button
            label="Сохранить"
            icon={<CheckIcon />}
            onPress={handleStepsSubmit}
            loading={logLoading}
          />
          {settings.googleFit !== 'on' && (
            <Button
              variant="secondary"
              label="Подключить Google Fit"
              onPress={handleConnectTracker}
              loading={trackerLoading}
            />
          )}
        </View>
      </BottomSheet>

      {/* Детализация участника — «Показать данные» */}
      <BottomSheet
        title="Показать данные"
        visible={detailMember != null}
        onClose={() => setDetailMember(null)}
      >
        {detailMember && (
          <View style={{ gap: 16 }}>
            {/* Аватар + имя */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MemberAvatar member={detailMember} />
              <Text weight="bold" style={{ fontSize: 20, lineHeight: 30, color: c.text.primary, letterSpacing: 0.2 }}>
                {detailMember.is_self
                  ? `${detailMember.first_name ?? detailMember.username ?? '?'} (Я)`
                  : (detailMember.first_name ?? detailMember.username ?? '?')}
              </Text>
            </View>

            {/* Календарь участника */}
            <Calendar
              habitId={habit.id}
              habitCreatedAt={habit.created_at}
              currentWeekLogs={habit.week_logs.filter(l => l.user_id === detailMember.id)}
              goalValue={habit.goal_value ?? 1}
              userId={detailMember.id}
              pageWidth={Dimensions.get('window').width - 48}
              horizontalPadding={0}
            />

            {/* 3 карточки: шаги / стрик / максимальный */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: -16 }}
              contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
            >
              {habit.category === 'steps' && (
                <Card style={detailCardStyle}>
                  <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                    {period === 'week' ? 'Шагов за неделю' : 'Шагов сегодня'}
                  </Text>
                  <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                    {(memberValueFor(detailMember.id) ?? 0).toLocaleString('ru-RU')}
                    {periodGoal != null ? ` / ${periodGoal.toLocaleString('ru-RU')}` : ''}
                  </Text>
                </Card>
              )}
              <Card style={detailCardStyle}>
                <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                  Стрик
                </Text>
                <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                  {habit.member_streaks?.[detailMember.id]?.current ?? 0}
                </Text>
              </Card>
              <Card style={detailCardStyle}>
                <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                  Максимальный
                </Text>
                <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                  {habit.member_streaks?.[detailMember.id]?.max ?? 0}
                </Text>
              </Card>
            </ScrollView>
          </View>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}
