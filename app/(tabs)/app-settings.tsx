import { View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import Select from '@/components/Select';
import SegmentedControl from '@/components/SegmentedControl';
import { colors } from '@/lib/colors';
import { useSettings, ThemePreference, Toggle } from '@/lib/settings-context';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  openHealthConnectPermissions,
} from '@/lib/health';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { getStepHabits } from '@/lib/api';
import { BASE_URL } from '@/lib/config';
import { registerForPush, unregisterCurrentPushToken } from '@/lib/notifications';

import NavigationBar from '@/components/NavigationBar';

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

  // Выключение — отписываем текущий FCM-токен на бэкенде, чтобы сервер сразу перестал слать пуши
  // (не дожидаясь следующего запуска приложения). Включение — регистрируем токен заново.
  const handleNotificationsChange = async (v: string) => {
    updateSettings({ notifications: v as Toggle });
    if (v === 'off') {
      await unregisterCurrentPushToken();
    } else {
      await registerForPush();
    }
  };

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
      <NavigationBar title="Настройки приложения" onBack={() => router.back()} />

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
          onChange={handleNotificationsChange}
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
