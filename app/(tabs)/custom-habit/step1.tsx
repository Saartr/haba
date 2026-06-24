import { View, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Button from '@/components/Button';
import Input from '@/components/Input';
import TextArea from '@/components/TextArea';
import SegmentedControl from '@/components/SegmentedControl';
import NavigationBar from '@/components/NavigationBar';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useCustomHabit } from './_layout';
import { useState } from 'react';

const TYPE_OPTIONS = [
  { label: 'Персональная', value: 'solo' },
  { label: 'Групповая', value: 'group' },
];

export default function Step1Screen() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colorScheme } = useSettings();
  const { state, set, reset } = useCustomHabit();

  const [nameError, setNameError] = useState('');

  const panelColor = colorScheme === 'dark' ? colors.neutral[900] : colors.neutral[0];
  const statusBarStyle = colorScheme === 'dark' ? 'light-content' as const : 'dark-content' as const;

  function handleBack() {
    reset();
    router.back();
  }

  function handleNext() {
    if (!state.name.trim()) {
      setNameError('Обязательное поле');
      return;
    }
    router.push('/(tabs)/custom-habit/step2' as any);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }} edges={['bottom']}>
      <StatusBar backgroundColor={panelColor} barStyle={statusBarStyle} />

      <View style={{ backgroundColor: panelColor, paddingTop: insets.top }}>
        <NavigationBar title="Создание цели" onBack={handleBack} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }} style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
        <Text weight="semibold" style={{ fontSize: 13, color: c.text.secondary, letterSpacing: 0.4, textTransform: 'uppercase' }}>
          Шаг 1 из 3
        </Text>
        <Text weight="bold" style={{ fontSize: 20, color: c.text.primary, letterSpacing: 0.2, marginTop: -8 }}>
          Основные настройки цели. Будешь достигать цели сам или в компании друзей?
        </Text>

        <SegmentedControl
          label="Тип цели"
          options={TYPE_OPTIONS}
          value={state.habitType}
          onChange={(v) => set({ habitType: v as 'solo' | 'group' })}
        />

        <Input
          label="Название"
          value={state.name}
          onChangeText={(t) => { set({ name: t }); if (nameError) setNameError(''); }}
          placeholder="Как назовёшь, так и поплывет"
          maxLength={40}
          error={nameError}
        />

        <TextArea
          label="Описание"
          value={state.description}
          onChangeText={(t) => set({ description: t })}
          placeholder="Зачем это всё (опционально)"
          maxLength={120}
        />
      </ScrollView>

      <View style={{ paddingHorizontal: 24, paddingBottom: 24 }}>
        <Button label="Далее" onPress={handleNext} />
      </View>
    </SafeAreaView>
  );
}
