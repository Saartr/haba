import { View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Text from '@/components/Text';
import Select from '@/components/Select';
import SegmentedControl from '@/components/SegmentedControl';
import { useColors, colors } from '@/lib/colors';
import { useSettings, ThemePreference, Toggle } from '@/lib/settings-context';

import ArrowBackIcon from '@/assets/icons/arrow_back.svg';

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
          label="Доступ к Google Fit"
          options={TOGGLE_OPTIONS}
          value={settings.googleFit}
          onChange={v => updateSettings({ googleFit: v as Toggle })}
        />
      </View>
    </SafeAreaView>
  );
}
