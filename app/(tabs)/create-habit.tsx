import { View, ScrollView, Pressable, StatusBar, useColorScheme, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import SegmentedControl from '@/components/SegmentedControl';
import Select from '@/components/Select';
import ArrowBackIcon from '@/assets/icons/arrow_back.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors, colors } from '@/lib/colors';
import { createHabit } from '@/lib/api';
import { useState } from 'react';

const GOAL_OPTIONS = [
  { label: '5 000', value: '5000' },
  { label: '7 000', value: '7000' },
  { label: '10 000', value: '10000' },
];

const TYPE_OPTIONS = [
  { label: 'Одиночная', value: 'solo' },
  { label: 'Групповая', value: 'group' },
];

const NOTIFY_OPTIONS = [
  { label: 'Да', value: 'yes' },
  { label: 'Нет', value: 'no' },
];

export default function CreateHabitScreen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();

  const [goal, setGoal] = useState('7000');
  const [notify, setNotify] = useState('yes');
  const [loading, setLoading] = useState(false);

  const panelColor = scheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = scheme === 'dark' ? 'light-content' : 'dark-content';

  async function handleCreate() {
    setLoading(true);
    try {
      const habit = await createHabit({
        name: 'Шаги',
        category: 'steps',
        type: 'group',
        goal_value: parseInt(goal),
        goal_unit: 'steps',
        notifications: notify === 'yes',
      });
      router.replace(`/(tabs)/habit/${habit.id}`);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message ?? 'Не удалось создать привычку');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      {/* Navigation bar */}
      <View
        style={{
          backgroundColor: panelColor,
          height: 56 + insets.top,
          paddingTop: insets.top,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, position: 'absolute', left: 24, top: insets.top + 16 })}
        >
          <ArrowBackIcon width={24} height={24} color={c.text.primary} />
        </Pressable>
        <Text weight="semibold" style={{ fontSize: 16, color: c.text.primary, letterSpacing: 0.2, marginTop: insets.top }}>
          Новая привычка
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }} style={{ flex: 1 }}>
        <SegmentedControl
          label="Тип"
          options={TYPE_OPTIONS}
          value="group"
          onChange={() => {}}
          disabled
        />
        <Select
          label="Категория"
          options={[{ label: 'Шаги', value: 'steps' }]}
          value="steps"
          onChange={() => {}}
          disabled
        />
        <Select
          label="Цель за день"
          options={GOAL_OPTIONS}
          value={goal}
          onChange={setGoal}
        />
        <SegmentedControl
          label="Уведомления"
          options={NOTIFY_OPTIONS}
          value={notify}
          onChange={setNotify}
        />
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
