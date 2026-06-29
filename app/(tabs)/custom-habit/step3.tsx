import { View, ScrollView, StatusBar, Pressable, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import Multiselect from '@/components/Multiselect';
import SegmentedControl from '@/components/SegmentedControl';
import NavigationBar from '@/components/NavigationBar';
import Chip from '@/components/Chip';
import DatePicker from '@/components/DatePicker';
import CloseIcon from '@/assets/icons/Close.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useSnackbar } from '@/lib/snackbar-context';
import { useConfirm } from '@/components/ConfirmModal';
import { createHabit } from '@/lib/api';
import { useCustomHabit } from './_layout';
import { useState, useEffect } from 'react';

const TIMES_PER_DAY_OPTIONS = [
  { label: '1', value: '1' },
  { label: '2', value: '2' },
  { label: '3', value: '3' },
];

const NOTIFICATION_DEFAULTS: Record<string, string[]> = {
  '1': ['12:00'],
  '2': ['9:00', '18:00'],
  '3': ['9:00', '14:00', '19:00'],
};

const WEEKDAY_OPTIONS = [
  { label: 'Пн', value: '1' },
  { label: 'Вт', value: '2' },
  { label: 'Ср', value: '3' },
  { label: 'Чт', value: '4' },
  { label: 'Пт', value: '5' },
  { label: 'Сб', value: '6' },
  { label: 'Вс', value: '7' },
];

const MONTH_DATE_PRESETS = [
  { label: '1-го числа', value: 'first', dates: [1] },
  { label: '1-го и 15-го числа', value: 'first_and_mid', dates: [1, 15] },
  { label: 'Последний день месяца', value: 'last', dates: [32] },
  { label: 'Один или несколько дней', value: 'custom', dates: [] },
];

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

const UNIT_LABELS: Record<string, string> = {
  minute: 'Минута', hour: 'Час', step: 'Шаг', calorie: 'Калория',
  km: 'Километр', m: 'Метр', glass: 'Стакан', litre: 'Литр',
  page: 'Страница', rep: 'Повторение', custom: '',
};

type Periodicity = 'daily' | 'weekdays' | 'n_per_week' | 'n_per_month';
type DurationType = 'unlimited' | 'period' | 'until_goal';
type MonthCountType = 'summary' | 'dates';

const PERIODICITY_TABS: { key: Periodicity; label: string }[] = [
  { key: 'daily', label: 'Каждый день' },
  { key: 'weekdays', label: 'Дни недели' },
  { key: 'n_per_week', label: 'N раз в неделю' },
  { key: 'n_per_month', label: 'N раз в месяц' },
];

const MONTH_SEGMENT_OPTIONS = [
  { label: 'Суммарно', value: 'summary' },
  { label: 'По датам', value: 'dates' },
];

export default function Step3Screen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const confirm = useConfirm();
  const showSnackbar = useSnackbar();
  const { state, set, reset } = useCustomHabit();
  const [loading, setLoading] = useState(false);

  // local errors
  const [timesPerWeekError, setTimesPerWeekError] = useState('');
  const [timesPerMonthError, setTimesPerMonthError] = useState('');
  const [weekdaysError, setWeekdaysError] = useState('');
  const [periodStartError, setPeriodStartError] = useState('');
  const [periodEndError, setPeriodEndError] = useState('');
  const [monthDatesPreset, setMonthDatesPreset] = useState('first');
  const [customMonthDays, setCustomMonthDays] = useState<string[]>([]);

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const isProgression = state.checkinType === 'progression';

  // Прогрессия всегда "До цели"
  useEffect(() => {
    if (isProgression && state.durationType !== 'until_goal') {
      set({ durationType: 'until_goal' });
    }
  }, [isProgression]);

  const durationOptions = isProgression
    ? [{ label: 'До цели', value: 'until_goal' }]
    : [
        { label: 'Бессрочно', value: 'unlimited' },
        { label: 'Период', value: 'period' },
      ];

  async function handleExit() {
    const ok = await confirm({
      title: 'Выйти из создания цели?',
      confirmLabel: 'Выйти',
      destructive: true,
    });
    if (ok) {
      reset();
      router.dismissAll();
    }
  }

  async function handleCreate() {
    let valid = true;

    if (state.periodicity === 'weekdays' && state.weekdays.length === 0) {
      setWeekdaysError('Выберите хотя бы один день');
      valid = false;
    }
    if (state.periodicity === 'n_per_week') {
      if (!state.timesPerWeek || Number(state.timesPerWeek) <= 0) {
        setTimesPerWeekError('Укажите количество раз');
        valid = false;
      }
    }
    if (state.periodicity === 'n_per_month') {
      if (state.monthCountType === 'summary' && (!state.timesPerMonth || Number(state.timesPerMonth) <= 0)) {
        setTimesPerMonthError('Укажите количество раз');
        valid = false;
      }
      if (state.monthCountType === 'dates' && monthDatesPreset === 'custom' && customMonthDays.length === 0) {
        setTimesPerMonthError('Выберите хотя бы один день');
        valid = false;
      }
    }
    if (state.durationType === 'period') {
      if (!state.periodStart) { setPeriodStartError('Выберите дату начала'); valid = false; }
      if (!state.periodEnd) { setPeriodEndError('Выберите дату окончания'); valid = false; }
      if (state.periodStart && state.periodEnd && state.periodEnd < state.periodStart) {
        setPeriodEndError('Дата окончания раньше начала'); valid = false;
      }
    }
    if (!valid) return;

    // Resolve month_dates
    let resolvedMonthDates: number[] = [];
    if (state.periodicity === 'n_per_month' && state.monthCountType === 'dates') {
      const preset = MONTH_DATE_PRESETS.find(p => p.value === monthDatesPreset);
      resolvedMonthDates = monthDatesPreset === 'custom'
        ? customMonthDays.map(Number)
        : (preset?.dates ?? []);
    }

    // Resolve unit label
    const unitLabel = state.unitPreset === 'custom'
      ? state.unitLabel
      : UNIT_LABELS[state.unitPreset] ?? '';

    setLoading(true);
    try {
      const habit = await createHabit({
        name: state.name.trim(),
        description: state.description.trim() || undefined,
        type: state.habitType,
        category: 'custom',
        checkin_type: state.checkinType,
        unit_preset: (state.checkinType === 'count' || state.checkinType === 'progression') ? state.unitPreset : undefined,
        goal_unit: (state.checkinType === 'count' || state.checkinType === 'progression') ? unitLabel : undefined,
        goal_value: state.checkinType === 'count' || state.checkinType === 'progression'
          ? parseInt(state.goalValue)
          : undefined,
        progression_start: state.checkinType === 'progression'
          ? parseInt(state.progressionStart)
          : undefined,
        periodicity: state.periodicity,
        times_per_day: state.periodicity === 'daily' ? state.timesPerDay : undefined,
        notification_times: state.periodicity === 'daily'
          ? NOTIFICATION_DEFAULTS[String(state.timesPerDay)] ?? ['12:00']
          : undefined,
        weekdays: state.periodicity === 'weekdays' ? state.weekdays : undefined,
        times_per_week: state.periodicity === 'n_per_week' ? parseInt(state.timesPerWeek) : undefined,
        times_per_month: state.periodicity === 'n_per_month' && state.monthCountType === 'summary'
          ? parseInt(state.timesPerMonth)
          : undefined,
        month_count_type: state.periodicity === 'n_per_month' ? state.monthCountType : undefined,
        month_dates: state.periodicity === 'n_per_month' && state.monthCountType === 'dates'
          ? resolvedMonthDates
          : undefined,
        duration_type: state.durationType,
        period_start: state.durationType === 'period' ? state.periodStart || undefined : undefined,
        period_end: state.durationType === 'period' ? state.periodEnd || undefined : undefined,
      });

      reset();
      router.dismissAll();
      router.replace(`/(tabs)/habit/${habit.id}` as any);
      showSnackbar('Цель создана', 'success');
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось создать цель');
    } finally {
      setLoading(false);
    }
  }

  const closeButton = (
    <Pressable onPress={handleExit} hitSlop={8}>
      {({ pressed }) => (
        <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 }}>
          <CloseIcon width={24} height={24} color={c.text.primary} />
        </View>
      )}
    </Pressable>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar
          title="Создание цели"
          onBack={() => router.back()}
          right={closeButton}
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <Text weight="bold" style={{ fontSize: 20, color: c.text.primary, letterSpacing: 0.2, lineHeight: 30 }}>
          Шаг 3 из 3
        </Text>
        <Text weight="semibold" style={{ fontSize: 14, color: c.text.primary, letterSpacing: 0.2, lineHeight: 19.6 }}>
          Сколько и как часто ты хочешь отмечать результат по своей цели.
        </Text>

        {/* Периодичность */}
        <View style={{ gap: 8 }}>
          <Text weight="semibold" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
            Периодичность
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PERIODICITY_TABS.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                selected={state.periodicity === key}
                onPress={() => {
                  set({ periodicity: key, weekdays: [], timesPerWeek: '', timesPerMonth: '' });
                  setWeekdaysError('');
                  setTimesPerWeekError('');
                  setTimesPerMonthError('');
                  setMonthDatesPreset('first');
                  setCustomMonthDays([]);
                }}
              />
            ))}
          </View>
        </View>

        {/* Каждый день */}
        {state.periodicity === 'daily' && (
          <>
            <Select
              label="Сколько раз в день"
              options={TIMES_PER_DAY_OPTIONS}
              value={String(state.timesPerDay)}
              onChange={(v) => set({ timesPerDay: Number(v) })}
            />
            <Select
              label="Время выполнения"
              options={[{ label: NOTIFICATION_DEFAULTS[String(state.timesPerDay)]?.join(', ') ?? '12:00', value: 'default' }]}
              value="default"
              onChange={() => {}}
              disabled
            />
          </>
        )}

        {/* Дни недели */}
        {state.periodicity === 'weekdays' && (
          <>
            <Text weight="medium" style={{ fontSize: 13, color: c.text.secondary, lineHeight: 18 }}>
              Отметка о выполнении в определённые дни недели.
            </Text>
            <Multiselect
              label="Какие дни недели"
              placeholder="Выберите дни"
              options={WEEKDAY_OPTIONS}
              value={state.weekdays.map(String)}
              onChange={(vals) => { set({ weekdays: vals.map(Number) }); setWeekdaysError(''); }}
            />
            {weekdaysError ? (
              <Text weight="medium" style={{ fontSize: 13, color: c.semantic.error }}>{weekdaysError}</Text>
            ) : null}
          </>
        )}

        {/* N раз в неделю */}
        {state.periodicity === 'n_per_week' && (
          <>
            <Text weight="medium" style={{ fontSize: 13, color: c.text.secondary, lineHeight: 18 }}>
              Выполнение цели сколько-то раз в неделю без привязки к конкретным дням, выполнение считается суммарно по отметкам в конце недели.
            </Text>
            <Input
              label="Цель"
              value={state.timesPerWeek}
              onChangeText={(t) => { set({ timesPerWeek: t }); setTimesPerWeekError(''); }}
              placeholder="Сколько раз в неделю"
              keyboardType="numeric"
              error={timesPerWeekError}
            />
          </>
        )}

        {/* N раз в месяц */}
        {state.periodicity === 'n_per_month' && (
          <>
            <Text weight="medium" style={{ fontSize: 13, color: c.text.secondary, lineHeight: 18 }}>
              Выполнение цели сколько-то раз в месяц.
            </Text>
            <SegmentedControl
              label="Как считать в месяц"
              options={MONTH_SEGMENT_OPTIONS}
              value={state.monthCountType}
              onChange={(v) => {
                set({ monthCountType: v as MonthCountType });
                setTimesPerMonthError('');
                setMonthDatesPreset('first');
                setCustomMonthDays([]);
              }}
            />

            {state.monthCountType === 'summary' && (
              <Input
                label="Цель"
                value={state.timesPerMonth}
                onChangeText={(t) => { set({ timesPerMonth: t }); setTimesPerMonthError(''); }}
                placeholder="Сколько раз в месяц"
                keyboardType="numeric"
                error={timesPerMonthError}
              />
            )}

            {state.monthCountType === 'dates' && (
              <>
                <Select
                  label="Привязка к датам"
                  options={MONTH_DATE_PRESETS.map(p => ({ label: p.label, value: p.value }))}
                  value={monthDatesPreset}
                  onChange={(v) => {
                    setMonthDatesPreset(v);
                    setCustomMonthDays([]);
                    setTimesPerMonthError('');
                  }}
                />
                {monthDatesPreset === 'custom' && (
                  <>
                    <Multiselect
                      label="Дни месяца"
                      placeholder="Выберите дни"
                      options={DAY_OPTIONS}
                      value={customMonthDays}
                      onChange={(vals) => { setCustomMonthDays(vals); setTimesPerMonthError(''); }}
                    />
                    {timesPerMonthError ? (
                      <Text weight="medium" style={{ fontSize: 13, color: c.semantic.error }}>{timesPerMonthError}</Text>
                    ) : null}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Длительность */}
        <SegmentedControl
          label="Периодичность"
          options={durationOptions}
          value={state.durationType}
          onChange={(v) => {
            const today = new Date();
            const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            set({ durationType: v as DurationType, periodStart: v === 'period' ? iso : '', periodEnd: '' });
            setPeriodStartError('');
            setPeriodEndError('');
          }}
        />

        {state.durationType === 'period' && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <DatePicker
                label="Дата начала"
                value={state.periodStart || null}
                onChange={(iso) => { set({ periodStart: iso }); setPeriodStartError(''); setPeriodEndError(''); }}
                error={periodStartError}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DatePicker
                label="Дата окончания"
                value={state.periodEnd || null}
                onChange={(iso) => { set({ periodEnd: iso }); setPeriodEndError(''); }}
                error={periodEndError}
              />
            </View>
          </View>
        )}

        {state.durationType === 'until_goal' && (
          <Text weight="medium" style={{ fontSize: 13, color: c.text.secondary, lineHeight: 18 }}>
            Для типа прогрессия, цель завершится, как только будет достигнут установленный результат.
          </Text>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button
          label="Создать"
          onPress={handleCreate}
          loading={loading}
          icon={<CheckIcon width={24} height={24} color={c.icon.onPrimary} />}
        />
      </View>
    </SafeAreaView>
  );
}
