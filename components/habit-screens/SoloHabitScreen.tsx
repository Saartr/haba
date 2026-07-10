import { View, ScrollView, Pressable, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import CalendarWeek from '@/components/CalendarWeek';
import Card from '@/components/Card';
import Chip from '@/components/Chip';
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
import { HabitDetail } from '@/lib/api';
import { pluralUnit, genitiveUnit } from '@/lib/units';
import { CHECK_IN_LABELS, SuccessModal } from './shared';

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
  const [period, setPeriod] = useState<'today' | 'week'>('today');
  const [editingBoolean, setEditingBoolean] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successLabel, failLabel] = CHECK_IN_LABELS[habit.category ?? ''] ?? ['Выполнил', 'Не выполнил'];
  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const selfId = habit.members.find(m => m.is_self)?.id;
  const today = new Date().toISOString().slice(0, 10);
  const todayLog = habit.week_logs.find(l => l.user_id === selfId && l.date.slice(0, 10) === today);

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
        <CalendarWeek
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
