import { View, ScrollView, StatusBar, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Button from '@/components/Button';
import SegmentedControl from '@/components/SegmentedControl';
import Select from '@/components/Select';
import NavigationBar from '@/components/NavigationBar';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { createHabit } from '@/lib/api';
import { useSnackbar } from '@/lib/snackbar-context';
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
];

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

  const [type, setType] = useState<'solo' | 'group'>('solo');
  const [category, setCategory] = useState('smoking');
  const [duration, setDuration] = useState('permanent');
  const [checkin, setCheckin] = useState('boolean');
  const [notify, setNotify] = useState('yes');
  const [groupGoal, setGroupGoal] = useState('7000');
  const [loading, setLoading] = useState(false);

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' : 'dark-content';

  async function handleCreate() {
    if (type === 'solo' && !category) {
      Alert.alert('Ошибка', 'Выберите категорию цели');
      return;
    }

    setLoading(true);
    try {
      const categoryLabel = CATEGORY_OPTIONS.find(o => o.value === category)?.label ?? category;

      const goalUnit = type === 'solo'
        ? checkin === 'boolean' ? 'boolean' : checkin === 'count' ? 'count' : 'minutes'
        : 'steps';

      const habit = await createHabit({
        name: type === 'solo' ? categoryLabel : 'Шаги',
        category: type === 'solo' ? category : 'steps',
        type,
        goal_value: type === 'group' ? parseInt(groupGoal) : undefined,
        goal_unit: goalUnit,
        notifications: notify === 'yes',
      });

      router.replace(`/(tabs)/habit/${habit.id}`);
      showSnackbar('Цель создана', 'success');
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
              disabled
            />
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

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 16 }}>
        <Button
          label="Создать"
          onPress={handleCreate}
          loading={loading}
          icon={<CheckIcon width={20} height={20} color={c.icon.onPrimary} />}
        />
      </View>
    </SafeAreaView>
  );
}
