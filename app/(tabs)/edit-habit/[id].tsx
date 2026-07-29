import { View, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TextArea from '@/components/TextArea';
import Select from '@/components/Select';
import SegmentedControl from '@/components/SegmentedControl';
import NavigationBar from '@/components/NavigationBar';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { getHabit, updateHabit } from '@/lib/api';
import { useSnackbar } from '@/lib/snackbar-context';
import { useKeyboardPadding } from '@/lib/use-keyboard-height';

const GROUP_GOAL_OPTIONS = [
  { label: '5 000', value: '5000' },
  { label: '7 000', value: '7000' },
  { label: '10 000', value: '10000' },
];

const NOTIFY_OPTIONS = [
  { label: 'Да', value: 'yes' },
  { label: 'Нет', value: 'no' },
];

const UNIT_PRESETS = [
  { label: 'Минута', value: 'minute' },
  { label: 'Час', value: 'hour' },
  { label: 'Шаг', value: 'step' },
  { label: 'Калория', value: 'calorie' },
  { label: 'Километр', value: 'km' },
  { label: 'Метр', value: 'm' },
  { label: 'Стакан', value: 'glass' },
  { label: 'Литр', value: 'litre' },
  { label: 'Страница', value: 'page' },
  { label: 'Повторение', value: 'rep' },
  { label: 'Свой вариант', value: 'custom' },
];

const UNIT_LABELS: Record<string, string> = {
  minute: 'Минута', hour: 'Час', step: 'Шаг', calorie: 'Калория',
  km: 'Километр', m: 'Метр', glass: 'Стакан', litre: 'Литр',
  page: 'Страница', rep: 'Повторение', custom: '',
};

export default function EditHabitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = parseInt(id);
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const showSnackbar = useSnackbar();

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [groupGoal, setGroupGoal] = useState('7000');
  const [notify, setNotify] = useState('yes');
  const [habitType, setHabitType] = useState<'solo' | 'group'>('solo');
  const [category, setCategory] = useState('');
  const [checkinType, setCheckinType] = useState('boolean');
  const [unitPreset, setUnitPreset] = useState('custom');
  const [unitLabel, setUnitLabel] = useState('');
  const [unitLabelError, setUnitLabelError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const kbPadding = useKeyboardPadding();

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  useEffect(() => {
    getHabit(habitId)
      .then(habit => {
        setName(habit.name);
        setDescription(habit.description ?? '');
        setHabitType(habit.type);
        setCategory(habit.category);
        setCheckinType(habit.checkin_type ?? 'boolean');
        if (habit.unit_preset) {
          setUnitPreset(habit.unit_preset);
          if (habit.unit_preset === 'custom') setUnitLabel(habit.goal_unit ?? '');
        }
        if (habit.goal_value != null) {
          setGroupGoal(String(habit.goal_value));
        }
        setNotify(habit.notifications ? 'yes' : 'no');
        setReady(true);
      })
      .catch(() => router.back());
  }, [habitId]);

  const hasUnit = checkinType === 'count' || checkinType === 'progression';

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Обязательное поле');
      return;
    }
    if (hasUnit && unitPreset === 'custom' && !unitLabel.trim()) {
      setUnitLabelError('Обязательное поле');
      return;
    }
    setLoading(true);
    try {
      await updateHabit(habitId, {
        name: name.trim(),
        description: description.trim() || undefined,
        // «Цель за день» с пресетами шагов относится только к category=steps — для остальных
        // типов (кастомные count/boolean) поле не показывается и goal_value не трогаем,
        // чтобы не затереть реальную (или отсутствующую) цель пресетом 5000/7000/10000.
        goal_value: category === 'steps' && habitType === 'group' ? parseInt(groupGoal) : undefined,
        notifications: notify === 'yes',
        unit_preset: hasUnit ? unitPreset : undefined,
        goal_unit: hasUnit ? (unitPreset === 'custom' ? unitLabel.trim() : UNIT_LABELS[unitPreset] ?? '') : undefined,
      });
      showSnackbar('Изменения сохранены', 'success');
      router.back();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось сохранить');
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default, paddingBottom: kbPadding }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar title="Редактирование цели" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 104, gap: 16 }} style={{ flex: 1, marginBottom: -80 }}>
        <Input
          label="Название"
          value={name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
          placeholder="Как назовёшь, так и поплывет"
          maxLength={64}
          error={nameError}
        />

        <TextArea
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="Зачем это всё (опционально)"
          maxLength={90}
        />

        {habitType === 'group' && category === 'steps' && (
          <Select
            label="Цель за день"
            options={GROUP_GOAL_OPTIONS}
            value={groupGoal}
            onChange={setGroupGoal}
          />
        )}

        {hasUnit && (
          <>
            <Select
              label="Единица измерения"
              options={UNIT_PRESETS}
              value={unitPreset}
              onChange={(v) => { setUnitPreset(v); setUnitLabel(''); setUnitLabelError(''); }}
            />
            {unitPreset === 'custom' && (
              <Input
                label="Название единицы"
                value={unitLabel}
                onChangeText={(t) => { setUnitLabel(t); if (unitLabelError) setUnitLabelError(''); }}
                placeholder="стаканы, км, страницы..."
                maxLength={20}
                error={unitLabelError}
              />
            )}
          </>
        )}

        <SegmentedControl
          label="Уведомления"
          options={NOTIFY_OPTIONS}
          value={notify}
          onChange={setNotify}
        />
      </ScrollView>

      <View pointerEvents="box-none" style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button
          label="Сохранить"
          onPress={handleSave}
          loading={loading}
          icon={<CheckIcon />}
        />
      </View>
    </SafeAreaView>
  );
}
