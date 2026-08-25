import {
  View,
  ScrollView,
  Pressable,
  Image,
  StatusBar,
  Alert,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { Clipboard } from 'react-native';
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
import { useConfirm } from '@/components/ConfirmModal';
import { useSnackbar } from '@/lib/snackbar-context';
import EditIcon from '@/assets/icons/Edit.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import CloseIcon from '@/assets/icons/Close.svg';
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import ShareIcon from '@/assets/icons/Share.svg';
import LinkIcon from '@/assets/icons/Link.svg';
import FootprintIcon from '@/assets/icons/Footprint.svg';
import SupervisorAccountIcon from '@/assets/icons/SupervisorAccount.svg';
import LogoutIcon from '@/assets/icons/Logout.svg';
import DeleteForeverIcon from '@/assets/icons/DeleteForever.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import {
  logHabit,
  getHabitLogs,
  syncHabitSteps,
  leaveHabit,
  transferHabit,
  excludeMember,
  closeHabit,
  getStepHabits,
  HabitDetail,
} from '@/lib/api';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { BASE_URL } from '@/lib/config';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  getTodaySteps,
} from '@/lib/health';
import { pluralUnit, genitiveUnit } from '@/lib/units';
import { SectionTitle, MemberRow, formatDateDots, formatSyncedAt, dateToLocalISO, useDayLogs } from './shared';

export default function GroupHabitScreen({
  habit, onReload,
}: {
  habit: HabitDetail;
  onReload: () => void;
}) {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const confirm = useConfirm();
  const showSnackbar = useSnackbar();
  const { colorScheme: scheme, settings } = useSettings();
  const habitId = habit.id;

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
  const [groupCountModal, setGroupCountModal] = useState(false);
  const [groupCountMode, setGroupCountMode] = useState<'add' | 'replace'>('add');
  const [groupCountInput, setGroupCountInput] = useState('');
  const [groupCountError, setGroupCountError] = useState<string | null>(null);
  const [calendarView, setCalendarView] = useState<'week' | 'month'>('week');
  // Дата, выбранная тапом по календарю — общая для недельного и месячного вида. null значит
  // «сегодня» (живые данные из week_logs). Сбрасывается при уходе с экрана (просто useState,
  // не персистится) и при переключении Неделя/Месяц. Значения за выбранный день показываются
  // прямо в контенте (карточки + список участников), без отдельной шторки.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // CalendarWeek держит подсветку выбранного дня во внутреннем стейте — снаружи её не сбросить
  // напрямую. При возврате «к текущей дате» инкрементируем key, чтобы React перемонтировал
  // компонент заново (заодно вернётся и позиция скролла на текущую неделю).
  const [calendarKey, setCalendarKey] = useState(0);
  function resetToToday() {
    setSelectedDate(null);
    setCalendarKey(k => k + 1);
  }
  const [editingBoolean, setEditingBoolean] = useState(false);
  const [monthLogDates, setMonthLogDates] = useState<string[]>([]);

  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;
  const screenBg = scheme === 'dark' ? c.surface.bg : colors.neutral[75];

  const me = habit.members.find(m => m.is_self);
  const today = dateToLocalISO(new Date());
  const myTodayLog = habit.week_logs.find(l => l.user_id === me?.id && l.date.slice(0, 10) === today);

  // count «без цели» — простой счётчик без порога выполнения (goal_value = null):
  // одна секция «Все участники» (итоги за всё время) + «Я сделал» вместо «Изменить/+1».
  const isCountNoGoal = habit.checkin_type === 'count' && habit.goal_value == null;
  // Кастомная групповая Да/Нет (не «Шаги»): Неделя/Месяц, «Выполнил/Не выполнил» у участников,
  // кнопки «Выполнил/Не выполнил» / «Редактировать запись».
  const isBoolCustom = habit.checkin_type === 'boolean' && habit.category !== 'steps';

  // Сбросить режим редактирования, когда своя отметка появилась/обновилась.
  useEffect(() => {
    if (myTodayLog != null) setEditingBoolean(false);
  }, [myTodayLog?.id, myTodayLog?.value]);

  // Мой месячный календарь для кастомной Да/Нет: зелёные выполненные + красные пропущенные дни.
  const [boolMonthLogs, setBoolMonthLogs] = useState<{ date: string; value: number }[]>([]);
  useEffect(() => {
    if (!isBoolCustom || calendarView !== 'month') return;
    const sid = habit.members.find(m => m.is_self)?.id;
    if (!sid) return;
    getHabitLogs(habit.id, habit.created_at.slice(0, 10), today, sid)
      .then(logs => setBoolMonthLogs(logs.map(l => ({ date: l.date.slice(0, 10), value: l.value }))))
      .catch(() => {});
  }, [habit, calendarView, isBoolCustom]);
  const boolCompletedDates = boolMonthLogs.filter(l => l.value >= 1).map(l => l.date);
  const boolMissedDates = (() => {
    if (!isBoolCustom) return [];
    const done = new Set(boolCompletedDates);
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

  function todayValueFor(memberId: number) {
    return habit.week_logs.find(l => l.user_id === memberId && l.date.slice(0, 10) === today)?.value ?? null;
  }

  // Значения всегда за сегодня (переключатель Сегодня/Неделя убран).
  const periodGoal = habit.goal_value;
  const personalSteps = myTodayLog?.value ?? 0;

  // Просмотр даты из прошлого (тап по недельному календарю) — подгружаем значения всех
  // участников за эту дату отдельным запросом (week_logs покрывает только текущую неделю).
  const isViewingPast = selectedDate != null;
  const dayLogs = useDayLogs(habit.id, selectedDate);
  const dateLabel = isViewingPast ? formatDateDots(selectedDate!) : 'сегодня';
  function displayValueFor(memberId: number): number {
    return isViewingPast ? (dayLogs?.get(memberId) ?? 0) : (todayValueFor(memberId) ?? 0);
  }
  const displayPersonalValue = isViewingPast ? (dayLogs?.get(me?.id ?? -1) ?? 0) : personalSteps;
  function handleDateSelect(iso: string) {
    setSelectedDate(iso === today ? null : iso);
  }

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
      if (Platform.OS === 'android' && habit.category === 'steps') {
        getStepHabits().then(({ ids, startDates }) => ids.length > 0 ? scheduleSync(BASE_URL, ids, startDates) : cancelSync()).catch(() => {});
      }
      router.back();
      showSnackbar('Цель удалена', 'success');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  async function handleTransfer(memberId: number) {
    setTransferModal(false);
    const member = habit.members.find(m => m.id === memberId);
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
      onReload();
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
      onReload();
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
      onReload();
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

  function closeGroupCountModal() {
    setGroupCountModal(false);
    setGroupCountMode('add');
    setGroupCountInput('');
    setGroupCountError(null);
  }

  async function handleGroupCountSubmit() {
    const input = parseInt(groupCountInput);
    if (groupCountInput === '' || Number.isNaN(input) || input <= 0) {
      setGroupCountError('Введите число');
      return;
    }
    const prev = myTodayLog?.value ?? 0;
    const value = groupCountMode === 'add' ? prev + input : input;
    setGroupCountError(null);
    setLogLoading(true);
    closeGroupCountModal();
    try {
      await logHabit(habitId, value);
      onReload();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  // Даты с записями текущего юзера — для месячного вида группового count-календаря.
  // Зависимость от habit (новый объект после каждого onReload) заменяет старый reloadTrigger.
  useEffect(() => {
    if (calendarView !== 'month' || habit.checkin_type !== 'count') return;
    const selfId = habit.members.find(m => m.is_self)?.id;
    if (!selfId) return;
    getHabitLogs(habit.id, habit.created_at.slice(0, 10), today, selfId)
      .then(logs => setMonthLogDates(logs.filter(l => l.value > 0).map(l => l.date.slice(0, 10))))
      .catch(() => {});
  }, [habit, calendarView]);

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
      onReload();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  const inviteLink = `https://bot.mihmih.pro/join/${habit.invite_code}`;

  function handleCopyInvite() {
    Clipboard.setString(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShareInvite() {
    setInviteModal(false);
    try {
      await Share.share({ message: inviteLink });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Nav bar */}
      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title="Групповая цель"
          onBack={() => router.back()}
          right={
            <Pressable onPress={() => setMenuVisible(true)} hitSlop={8}>
              {({ pressed }) => (
                <View collapsable={false} style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
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

        {habit.checkin_type === 'count' ? (
          <>
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
                currentWeekLogs={habit.week_logs.filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)}
                goalValue={1}
                noMissIndicator
                onDateSelect={handleDateSelect}
              />
            ) : (
              <View style={{ paddingHorizontal: 24 }}>
                <Card style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 0 }}>
                  <CalendarMonthly
                    key={calendarKey}
                    logs={monthLogDates}
                    periodStart={habit.created_at.slice(0, 10)}
                    selectedDate={selectedDate ?? undefined}
                    onDateSelect={handleDateSelect}
                  />
                </Card>
              </View>
            )}

            {isCountNoGoal ? (
              /* Без цели — одна секция «Все участники»: по умолчанию итоги за всё время
                 (entry_totals), а при выборе даты в календаре — значения за этот день. */
              <>
                <SectionTitle>{isViewingPast ? `Значения за ${dateLabel}` : 'Все участники'}</SectionTitle>
                <View style={{ paddingHorizontal: 24 }}>
                  <Card style={{ gap: 16 }}>
                    {habit.members.map(m => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        goalValue={null}
                        value={isViewingPast ? (dayLogs?.get(m.id) ?? 0) : (habit.entry_totals?.[m.id] ?? 0)}
                        unit={null}
                        isCreator={habit.is_creator}
                        onExclude={handleExclude}
                      />
                    ))}
                  </Card>
                </View>
              </>
            ) : (
              <>
                {/* Личная статистика: сегодняшнее значение / цель, стрик, лучший стрик */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginVertical: -16 }}
                  contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
                >
                  <Card style={{ gap: 4 }}>
                    <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                      {genitiveUnit(habit.goal_unit) || 'Количество'} {dateLabel}
                    </Text>
                    <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                      {displayPersonalValue.toLocaleString('ru-RU')}
                      {periodGoal != null ? ` / ${periodGoal.toLocaleString('ru-RU')}` : ''}
                    </Text>
                  </Card>

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
                      Лучший стрик
                    </Text>
                    <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                      {habit.streak.max}
                    </Text>
                  </Card>
                </ScrollView>

                {/* Все участники — значение каждого за сегодня/выбранную дату */}
                <SectionTitle>{`Все участники ${dateLabel}`}</SectionTitle>
                <View style={{ paddingHorizontal: 24 }}>
                  <Card style={{ gap: 16 }}>
                    {habit.members.map(m => (
                      <MemberRow
                        key={m.id}
                        member={m}
                        goalValue={habit.goal_value}
                        value={displayValueFor(m.id)}
                        isCreator={habit.is_creator}
                        onExclude={handleExclude}
                      />
                    ))}
                  </Card>
                </View>
              </>
            )}
          </>
        ) : (
          <>
            {isBoolCustom ? (
              <View style={{ gap: 16 }}>
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
                    currentWeekLogs={habit.week_logs.filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)}
                    goalValue={1}
                    onDateSelect={handleDateSelect}
                  />
                ) : (
                  <View style={{ paddingHorizontal: 24 }}>
                    <Card style={{ paddingHorizontal: 16, paddingVertical: 16, gap: 0 }}>
                      <CalendarMonthly
                        key={calendarKey}
                        logs={boolCompletedDates}
                        missedDates={boolMissedDates}
                        periodStart={habit.created_at.slice(0, 10)}
                        selectedDate={selectedDate ?? undefined}
                        onDateSelect={handleDateSelect}
                      />
                    </Card>
                  </View>
                )}
              </View>
            ) : (
              <CalendarWeek
                key={calendarKey}
                habitId={habit.id}
                habitCreatedAt={habit.created_at}
                currentWeekLogs={habit.week_logs.filter(l => l.user_id === habit.members.find(m => m.is_self)?.id)}
                goalValue={habit.goal_value ?? 1}
                onDateSelect={handleDateSelect}
              />
            )}

            {/* Персональный результат — заголовок только для «Шагов» (кастомная Да/Нет без него) */}
            {!isBoolCustom && <SectionTitle>Персональный результат</SectionTitle>}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: -16 }}
              contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 16, gap: 16 }}
            >
              {habit.category === 'steps' && (
                <Card style={{ gap: 4 }}>
                  <Text weight="medium" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
                    Шагов {dateLabel}
                  </Text>
                  <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                    {displayPersonalValue.toLocaleString('ru-RU')}
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
                  Лучший стрик
                </Text>
                <Text weight="bold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2 }}>
                  {habit.streak.max}
                </Text>
              </Card>
            </ScrollView>

            {/* Все участники */}
            <SectionTitle>{`Все участники ${dateLabel}`}</SectionTitle>
            <View style={{ paddingHorizontal: 24 }}>
              <Card style={{ gap: 16 }}>
                {habit.members.map(m => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    goalValue={periodGoal}
                    value={displayValueFor(m.id)}
                    boolean={isBoolCustom}
                    isCreator={habit.is_creator}
                    onExclude={handleExclude}
                  />
                ))}
              </Card>
            </View>
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        {isViewingPast ? (
          <Button
            label="Вернуться к текущей дате"
            onPress={resetToToday}
          />
        ) : habit.category === 'steps' ? (
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
        ) : isCountNoGoal ? (
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Я сделал"
                onPress={async () => {
                  setLogLoading(true);
                  try {
                    await logHabit(habitId, (myTodayLog?.value ?? 0) + 1);
                    onReload();
                  } catch (e: any) {
                    Alert.alert('Ошибка', e.message);
                  } finally {
                    setLogLoading(false);
                  }
                }}
                loading={logLoading}
              />
            </View>
            {(myTodayLog?.value ?? 0) > 0 && (
              <Button
                variant="icon"
                icon={<EditIcon />}
                onPress={() => {
                  setGroupCountMode('replace');
                  setGroupCountInput(String(myTodayLog?.value ?? 0));
                  setGroupCountError(null);
                  setGroupCountModal(true);
                }}
              />
            )}
          </View>
        ) : habit.checkin_type === 'count' ? (
          <Button
            label={myTodayLog != null ? 'Редактировать запись' : `Внести ${pluralUnit(habit.goal_unit ?? '')}`}
            variant={myTodayLog != null ? 'secondary' : 'main'}
            onPress={() => {
              const editing = myTodayLog != null;
              setGroupCountMode(editing ? 'replace' : 'add');
              setGroupCountInput(editing ? String(myTodayLog?.value ?? 0) : '');
              setGroupCountError(null);
              setGroupCountModal(true);
            }}
            loading={logLoading}
          />
        ) : habit.checkin_type === 'boolean' ? (
          // Кастомная Да/Нет: есть отметка за сегодня → «Редактировать запись»,
          // иначе две брендовые кнопки «Выполнил»/«Не выполнил».
          myTodayLog != null && !editingBoolean ? (
            <Button
              label="Редактировать запись"
              variant="secondary"
              onPress={() => setEditingBoolean(true)}
            />
          ) : (
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Выполнил"
                  icon={<CheckIcon />}
                  loading={logLoading}
                  onPress={async () => {
                    setLogLoading(true);
                    try { await logHabit(habitId, 1); onReload(); }
                    catch (e: any) { Alert.alert('Ошибка', e.message); }
                    finally { setLogLoading(false); }
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Не выполнил"
                  icon={<CloseIcon />}
                  loading={logLoading}
                  onPress={async () => {
                    setLogLoading(true);
                    try { await logHabit(habitId, 0); onReload(); }
                    catch (e: any) { Alert.alert('Ошибка', e.message); }
                    finally { setLogLoading(false); }
                  }}
                />
              </View>
            </View>
          )
        ) : null}
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

      {/* GF Info modal + Steps modal — только для category=steps */}
      {habit.category === 'steps' && (
        <>
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
        </>
      )}

      {/* Count modal — для групповых custom-целей с type=count */}
      {habit.checkin_type === 'count' && (
        <BottomSheet
          title={`Внести ${pluralUnit(habit.goal_unit ?? '')}`}
          visible={groupCountModal}
          onClose={closeGroupCountModal}
        >
          <View style={{ gap: 16 }}>
            <SegmentedControl
              options={[
                { label: 'Добавить', value: 'add' },
                { label: 'Заменить', value: 'replace' },
              ]}
              value={groupCountMode}
              onChange={v => {
                const mode = v as 'add' | 'replace';
                setGroupCountMode(mode);
                setGroupCountInput(mode === 'replace' ? String(myTodayLog?.value ?? 0) : '');
                setGroupCountError(null);
              }}
            />
            <Input
              label={groupCountMode === 'add' ? 'Добавление значения' : 'Изменение значения'}
              value={groupCountInput}
              onChangeText={t => { setGroupCountInput(t.replace(/[^0-9]/g, '')); if (groupCountError) setGroupCountError(null); }}
              keyboardType="number-pad"
              maxLength={6}
              error={groupCountError ?? undefined}
            />
            <Button
              label="Сохранить"
              icon={<CheckIcon />}
              onPress={handleGroupCountSubmit}
              loading={logLoading}
            />
          </View>
        </BottomSheet>
      )}

    </SafeAreaView>
  );
}
