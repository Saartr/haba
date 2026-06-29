import { View, ScrollView, StatusBar, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Select from '@/components/Select';
import NavigationBar from '@/components/NavigationBar';
import Chip from '@/components/Chip';
import CloseIcon from '@/assets/icons/Close.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useConfirm } from '@/components/ConfirmModal';
import { useCustomHabit } from './_layout';
import { useState } from 'react';

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

const CHECKIN_DESCRIPTIONS: Record<string, string> = {
  boolean: 'Простая отметка: выполнено или не выполнено.',
  count: 'Подсчёт в любых единицах (например: 10 страниц или 2 часа).',
  progression: 'Отследить прогресс от текущего состояния до выбранной цели. Цель завершится как только будет достигнут поставленный результат.',
};

export default function Step2Screen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const confirm = useConfirm();
  const { state, set, reset } = useCustomHabit();

  const [goalError, setGoalError] = useState('');
  const [unitLabelError, setUnitLabelError] = useState('');
  const [startError, setStartError] = useState('');

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  const checkinTypes = state.habitType === 'group'
    ? [{ key: 'boolean', label: 'Да/Нет' }, { key: 'count', label: 'Количество' }]
    : [{ key: 'boolean', label: 'Да/Нет' }, { key: 'count', label: 'Количество' }, { key: 'progression', label: 'Прогрессия' }];

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

  function handleNext() {
    let valid = true;

    if (state.checkinType === 'count') {
      if (state.unitPreset === 'custom' && !state.unitLabel.trim()) {
        setUnitLabelError('Обязательное поле');
        valid = false;
      }
      if (!state.goalValue || isNaN(Number(state.goalValue)) || Number(state.goalValue) <= 0) {
        setGoalError('Укажите цель больше 0');
        valid = false;
      }
    }

    if (state.checkinType === 'progression') {
      if (state.unitPreset === 'custom' && !state.unitLabel.trim()) {
        setUnitLabelError('Обязательное поле');
        valid = false;
      }
      if (!state.progressionStart || isNaN(Number(state.progressionStart)) || Number(state.progressionStart) <= 0) {
        setStartError('Укажите начальное значение');
        valid = false;
      }
      if (!state.goalValue || isNaN(Number(state.goalValue)) || Number(state.goalValue) <= 0) {
        setGoalError('Укажите цель больше 0');
        valid = false;
      }
    }

    if (!valid) return;
    router.push('/(tabs)/custom-habit/step3' as any);
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
          Шаг 2 из 3
        </Text>
        <Text weight="semibold" style={{ fontSize: 14, color: c.text.primary, letterSpacing: 0.2, lineHeight: 19.6 }}>
          В каком формате будет происходить отметка об успехе или фиаско.
        </Text>

        {/* Тип чекина */}
        <View style={{ gap: 8 }}>
          <Text weight="semibold" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
            Тип цели
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {checkinTypes.map(({ key, label }) => (
              <Chip
                key={key}
                label={label}
                selected={state.checkinType === key}
                onPress={() => {
                  set({ checkinType: key as any });
                  setGoalError('');
                  setUnitLabelError('');
                  setStartError('');
                }}
              />
            ))}
          </View>
          <Text weight="medium" style={{ fontSize: 13, color: c.text.secondary, lineHeight: 18, letterSpacing: 0.1, marginTop: 4 }}>
            {CHECKIN_DESCRIPTIONS[state.checkinType]}
          </Text>
        </View>

        {/* Количество */}
        {state.checkinType === 'count' && (
          <>
            <Select
              label="Единица измерения"
              options={UNIT_PRESETS}
              value={state.unitPreset}
              onChange={(v) => {
                set({ unitPreset: v, unitLabel: '' });
                setUnitLabelError('');
              }}
            />
            {state.unitPreset === 'custom' && (
              <Input
                label="Название единицы"
                value={state.unitLabel}
                onChangeText={(t) => { set({ unitLabel: t }); setUnitLabelError(''); }}
                placeholder="стаканы, км, страницы..."
                maxLength={20}
                error={unitLabelError}
              />
            )}
            <Input
              label="Цель"
              value={state.goalValue}
              onChangeText={(t) => { set({ goalValue: t }); setGoalError(''); }}
              placeholder="Сколько нужно сделать"
              keyboardType="numeric"
              error={goalError}
            />
          </>
        )}

        {/* Прогрессия */}
        {state.checkinType === 'progression' && (
          <>
            <Select
              label="Единица измерения"
              options={UNIT_PRESETS}
              value={state.unitPreset}
              onChange={(v) => {
                set({ unitPreset: v, unitLabel: '' });
                setUnitLabelError('');
              }}
            />
            {state.unitPreset === 'custom' && (
              <Input
                label="Название единицы"
                value={state.unitLabel}
                onChangeText={(t) => { set({ unitLabel: t }); setUnitLabelError(''); }}
                placeholder="граммы, км, страницы..."
                maxLength={20}
                error={unitLabelError}
              />
            )}
            <Input
              label="Начало"
              value={state.progressionStart}
              onChangeText={(t) => { set({ progressionStart: t }); setStartError(''); }}
              placeholder="Сколько получается сделать"
              keyboardType="numeric"
              error={startError}
            />
            <Input
              label="Цель"
              value={state.goalValue}
              onChangeText={(t) => { set({ goalValue: t }); setGoalError(''); }}
              placeholder="Сколько нужно сделать"
              keyboardType="numeric"
              error={goalError}
            />
          </>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button label="Далее" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}
