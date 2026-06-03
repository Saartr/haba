import { View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Input from '@/components/Input';
import { colors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { updateProfile } from '@/lib/api';
import NavigationBar from '@/components/NavigationBar';

export default function ProfileSettingsScreen() {

  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { colorScheme } = useSettings();

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];

  const [name, setName] = useState(user?.first_name ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    const previous = user?.first_name ?? '';
    if (trimmed === previous || saving) return;

    updateUser({ first_name: trimmed });
    setSaving(true);
    try {
      await updateProfile({ first_name: trimmed });
    } catch (e: any) {
      updateUser({ first_name: previous || null });
      Alert.alert('Ошибка', e?.message ?? 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      <NavigationBar title="Настройки профиля" onBack={() => router.back()} />

      {/* Content */}
      <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
        <Input
          label="Имя"
          value={name}
          onChangeText={setName}
          placeholder="Введите имя"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          onBlur={save}
          disabled={saving}
        />
      </View>
    </SafeAreaView>
  );
}
