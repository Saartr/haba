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

const GROUP_GOAL_OPTIONS = [
  { label: '5 000', value: '5000' },
  { label: '7 000', value: '7000' },
  { label: '10 000', value: '10000' },
];

const NOTIFY_OPTIONS = [
  { label: 'Да', value: 'yes' },
  { label: 'Нет', value: 'no' },
];

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
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  useEffect(() => {
    getHabit(habitId)
      .then(habit => {
        setName(habit.name);
        setDescription(habit.description ?? '');
        setHabitType(habit.type);
        if (habit.goal_value != null) {
          setGroupGoal(String(habit.goal_value));
        }
        setNotify(habit.notifications ? 'yes' : 'no');
        setReady(true);
      })
      .catch(() => router.back());
  }, [habitId]);

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Обязательное поле');
      return;
    }
    setLoading(true);
    try {
      await updateHabit(habitId, {
        name: name.trim(),
        description: description.trim() || undefined,
        goal_value: habitType === 'group' ? parseInt(groupGoal) : undefined,
        notifications: notify === 'yes',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar title="Редактирование цели" onBack={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} style={{ flex: 1 }}>
        <Input
          label="Название"
          value={name}
          onChangeText={(t) => { setName(t); if (nameError) setNameError(''); }}
          placeholder="Как назовёшь, так и поплывет"
          maxLength={24}
          error={nameError}
        />

        <TextArea
          label="Описание"
          value={description}
          onChangeText={setDescription}
          placeholder="Зачем это всё (опционально)"
          maxLength={90}
        />

        {habitType === 'group' && (
          <Select
            label="Цель за день"
            options={GROUP_GOAL_OPTIONS}
            value={groupGoal}
            onChange={setGroupGoal}
          />
        )}

        <SegmentedControl
          label="Уведомления"
          options={NOTIFY_OPTIONS}
          value={notify}
          onChange={setNotify}
        />
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
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
