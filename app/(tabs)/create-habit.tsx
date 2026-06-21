import { View, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TextArea from '@/components/TextArea';
import SegmentedControl from '@/components/SegmentedControl';
import Select from '@/components/Select';
import Multiselect from '@/components/Multiselect';
import NavigationBar from '@/components/NavigationBar';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { createHabit, getStepHabits } from '@/lib/api';
import { useSnackbar } from '@/lib/snackbar-context';
import { scheduleSync } from '@/modules/health-sync';
import { hasStepsPermission } from '@/lib/health';
import { Platform } from 'react-native';
import { BASE_URL } from '@/lib/config';
import { useState } from 'react';

const TYPE_OPTIONS = [
  { label: 'Персональная', value: 'solo' },
  { label: 'Групповая', value: 'group' },
];

const NOTIFY_OPTIONS = [
  { label: 'Да', value: 'yes' },
  { label: 'Нет', value: 'no' },
];

const CATEGORY_OPTIONS = [
  { label: 'Курение', value: 'smoking' },
  { label: 'Подтягивания', value: 'pullups' },
];

const NUMBER_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ label: String(i + 1), value: String(i + 1) }));

const INTENSITY_OPTIONS = [
  { label: 'Низкая (2 тренировки/нед.)', value: 'low' },
  { label: 'Средняя (3 тренировки/нед.)', value: 'medium' },
  { label: 'Высокая (4 тренировки/нед.)', value: 'high' },
];

const WEEKDAY_OPTIONS = [
  { label: 'Понедельник', value: '1' },
  { label: 'Вторник', value: '2' },
  { label: 'Среда', value: '3' },
  { label: 'Четверг', value: '4' },
  { label: 'Пятница', value: '5' },
  { label: 'Суббота', value: '6' },
  { label: 'Воскресенье', value: '7' },
];

const SESSIONS_PER_WEEK: Record<string, number> = { low: 2, medium: 3, high: 4 };

const DURATION_OPTIONS = [
  { label: 'Постоянная', value: 'permanent' },
];

const CHECKIN_OPTIONS = [
  { label: 'Да / Нет', value: 'boolean' },
  { label: 'Количество', value: 'count' },
  { label: 'Время', value: 'time' },
];

const GROUP_GOAL_OPTIONS = [
  { label: '5 000', value: '5000' },
  { label: '7 000', value: '7000' },
  { label: '10 000', value: '10000' },
];


export default function CreateHabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const showSnackbar = useSnackbar();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'solo' | 'group'>('solo');
  const [category, setCategory] = useState('smoking');
  const [duration, setDuration] = useState('permanent');
  const [checkin, setCheckin] = useState('boolean');
  const [notify, setNotify] = useState('yes');
  const [groupGoal, setGroupGoal] = useState('7000');
  const [loading, setLoading] = useState(false);

  const [currentForm, setCurrentForm] = useState('');
  const [targetReps, setTargetReps] = useState('');
  const [intensity, setIntensity] = useState<'low' | 'medium' | 'high'>('medium');
  const [trainingDays, setTrainingDays] = useState<string[]>([]);

  function handleIntensityChange(v: string) {
    const next = v as 'low' | 'medium' | 'high';
    setIntensity(next);
    if (trainingDays.length !== SESSIONS_PER_WEEK[next]) setTrainingDays([]);
  }

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' : 'dark-content';

  async function handleCreate() {
    if (!name.trim()) {
      setNameError('Обязательное поле');
      return;
    }

    const isPullups = type === 'solo' && category === 'pullups';
    if (isPullups && (!currentForm || !targetReps || trainingDays.length !== SESSIONS_PER_WEEK[intensity])) {
      Alert.alert('Ошибка', 'Заполните текущую форму, конечную цель и дни недели');
      return;
    }

    setLoading(true);
    try {
      const goalUnit = type === 'solo'
        ? checkin === 'boolean' ? 'boolean' : checkin === 'count' ? 'count' : 'minutes'
        : 'steps';

      const habit = await createHabit({
        name: name.trim(),
        description: description.trim() || undefined,
        category: type === 'solo' ? category : 'steps',
        type,
        goal_value: type === 'group' ? parseInt(groupGoal) : undefined,
        goal_unit: isPullups ? undefined : goalUnit,
        notifications: notify === 'yes',
        ...(isPullups ? {
          current_form: parseInt(currentForm),
          target_reps: parseInt(targetReps),
          intensity,
          training_days: trainingDays.map(Number),
        } : {}),
      });

      router.replace(`/(tabs)/habit/${habit.id}`);
      showSnackbar('Цель создана', 'success');

      // Перепланируем WorkManager если создана step-привычка и есть разрешение HC
      if (Platform.OS === 'android' && habit.category === 'steps') {
        hasStepsPermission().then(granted => {
          if (!granted) return;
          getStepHabits().then(({ ids, startDates }) => scheduleSync(BASE_URL, ids, startDates));
        }).catch(() => {});
      }
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось создать цель');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar title="Новая цель" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} style={{ flex: 1 }}>
        {/* Название */}
        <Input
          label="Название"
          value={name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
          placeholder="Как назовёшь, так и поплывет"
          maxLength={24}
          error={nameError}
        />

        {/* Описание */}
        <TextArea
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="Зачем это всё (опционально)"
          maxLength={90}
        />

        {/* Тип */}
        <SegmentedControl
          label="Тип"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => setType(v as 'solo' | 'group')}
        />

        {type === 'solo' ? (
          <>
            {/* Категория */}
            <Select
              label="Категория"
              placeholder="Выберите категорию"
              options={CATEGORY_OPTIONS}
              value={category}
              onChange={setCategory}
            />

            {category === 'pullups' ? (
              <>
                {/* Текущая форма / Конечная цель */}
                <Select
                  label="Текущая форма"
                  placeholder="Повторений в подходе сейчас"
                  options={NUMBER_OPTIONS}
                  value={currentForm}
                  onChange={setCurrentForm}
                />
                <Select
                  label="Конечная цель"
                  placeholder="Повторений в подходе в финале"
                  options={NUMBER_OPTIONS}
                  value={targetReps}
                  onChange={setTargetReps}
                />

                {/* Интенсивность */}
                <Select
                  label="Интенсивность"
                  options={INTENSITY_OPTIONS}
                  value={intensity}
                  onChange={handleIntensityChange}
                />

                {/* Дни недели */}
                <Multiselect
                  label="Дни недели"
                  placeholder="Выберите дни тренировок"
                  options={WEEKDAY_OPTIONS}
                  value={trainingDays}
                  onChange={setTrainingDays}
                  exactCount={SESSIONS_PER_WEEK[intensity]}
                />

                {/* Уведомления */}
                <SegmentedControl
                  label="Уведомления"
                  options={NOTIFY_OPTIONS}
                  value={notify}
                  onChange={setNotify}
                />
              </>
            ) : (
              <>
                {/* Длительность */}
                <Select
                  label="Длительность"
                  options={DURATION_OPTIONS}
                  value={duration}
                  onChange={setDuration}
                />

                {/* Чекин */}
                <SegmentedControl
                  label="Чекин"
                  options={CHECKIN_OPTIONS}
                  value={checkin}
                  onChange={setCheckin}
                  disabled
                />

                {/* Уведомления */}
                <SegmentedControl
                  label="Уведомления"
                  options={NOTIFY_OPTIONS}
                  value={notify}
                  onChange={setNotify}
                />
              </>
            )}
          </>
        ) : (
          <>
            {/* Групповая — старые поля */}
            <Select
              label="Категория"
              options={[{ label: 'Шаги', value: 'steps' }]}
              value="steps"
              onChange={() => {}}
              disabled
            />
            <Select
              label="Цель за день"
              options={GROUP_GOAL_OPTIONS}
              value={groupGoal}
              onChange={setGroupGoal}
            />
            <SegmentedControl
              label="Уведомления"
              options={NOTIFY_OPTIONS}
              value={notify}
              onChange={setNotify}
            />
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button
          label="Создать"
          onPress={handleCreate}
          loading={loading}
          icon={<CheckIcon />}
        />
      </View>
    </SafeAreaView>
  );
}
