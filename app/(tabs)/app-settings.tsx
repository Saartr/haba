import { View, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Text from '@/components/Text';
import Select from '@/components/Select';
import SegmentedControl from '@/components/SegmentedControl';
import { useColors, colors } from '@/lib/colors';
import { useSettings, ThemePreference, Toggle } from '@/lib/settings-context';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  openHealthConnectPermissions,
} from '@/lib/health';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { getStepHabits } from '@/lib/api';

const BASE_URL = 'https://bot.mihmih.pro/api/v1';

import ArrowBackIcon from '@/assets/icons/ArrowBack.svg';

const LANGUAGE_OPTIONS = [
  { label: 'Русский', value: 'ru' },
];

const THEME_OPTIONS = [
  { label: 'Системная', value: 'system' },
  { label: 'Светлая', value: 'light' },
  { label: 'Темная', value: 'dark' },
];

const TOGGLE_OPTIONS = [
  { label: 'Включить', value: 'on' },
  { label: 'Выключить', value: 'off' },
];

export default function AppSettingsScreen() {
  const c = useColors();
  const router = useRouter();
  const { settings, colorScheme, updateSettings } = useSettings();

  const [hcAvailable, setHcAvailable] = useState(false);

  // Перечитываем реальное состояние разрешения при каждом возврате на экран
  // (пользователь мог отозвать разрешение в системных настройках HC)
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        const available = await isHealthConnectAvailable();
        setHcAvailable(available);
        if (available) {
          const granted = await hasStepsPermission();
          updateSettings({ googleFit: granted ? 'on' : 'off' });
        }
      } catch (e) {
        console.warn('[health] focus check error:', e);
      }
    })();
  // updateSettings стабилен (useCallback в SettingsProvider), добавляем в deps для линтера
  }, [updateSettings]));

  const handleGoogleFitChange = async (v: string) => {
    try {
      if (v === 'on') {
        const granted = await requestStepsPermission();
        updateSettings({ googleFit: granted ? 'on' : 'off' });
        if (granted) {
          const { ids, startDates } = await getStepHabits();
          scheduleSync(BASE_URL, ids, startDates);
        }
      } else {
        openHealthConnectPermissions();
        cancelSync();
        // Тоггл не меняем здесь — useFocusEffect обновит реальное состояние при возврате
      }
    } catch (e) {
      console.warn('[health] toggle error:', e);
    }
  };

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      {/* Navigation bar */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          {({ pressed }) => (
            <View style={{ padding: 4, opacity: pressed ? 0.6 : 1 }}>
              <ArrowBackIcon width={24} height={24} color={c.text.primary} />
            </View>
          )}
        </Pressable>
        <Text weight="bold" style={{
          flex: 1, textAlign: 'center',
          fontSize: 16, color: c.text.primary, letterSpacing: 0.2,
        }}>
          Настройки приложения
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Content */}
      <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 16 }}>
        <Select
          label="Язык"
          options={LANGUAGE_OPTIONS}
          value="ru"
          onChange={() => {}}
        />
        <SegmentedControl
          label="Тема"
          options={THEME_OPTIONS}
          value={settings.theme}
          onChange={v => updateSettings({ theme: v as ThemePreference })}
        />
        <SegmentedControl
          label="Уведомления"
          options={TOGGLE_OPTIONS}
          value={settings.notifications}
          onChange={v => updateSettings({ notifications: v as Toggle })}
        />
        <SegmentedControl
          label="Доступ к Health Connect"
          options={TOGGLE_OPTIONS}
          value={settings.googleFit}
          onChange={handleGoogleFitChange}
          disabled={!hcAvailable}
        />
      </View>
    </SafeAreaView>
  );
}
