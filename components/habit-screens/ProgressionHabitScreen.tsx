import { View, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
import MoreVerticalIcon from '@/assets/icons/MoreVertical.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { getHabitLogs, HabitDetail, HabitLog } from '@/lib/api';
import { pluralUnit } from '@/lib/units';
import { SuccessModal, isRestDay, formatDateRu, formatDateDots } from './shared';

export default function ProgressionHabitScreen({
  habit, onLog, logLoading, onDelete, reloadTrigger, onComplete, onCompleteNewGoal,
}: {
  habit: HabitDetail;
  onLog: (value: number, date?: string) => void;
  logLoading: boolean;
  onDelete: () => void;
  reloadTrigger: number;
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
  const [allLogs, setAllLogs] = useState<HabitLog[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
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

  // Показать экран успеха при достижении цели
  useEffect(() => {
    if (goalReached) setShowSuccess(true);
  }, [goalReached]);

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

      <SuccessModal
        visible={showSuccess}
        onClose={() => { setShowSuccess(false); onComplete(); }}
        onNewGoal={() => { setShowSuccess(false); onCompleteNewGoal(); }}
      />

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
