import { View, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Text from '@/components/Text';
import Input from '@/components/Input';
import { useColors, colors } from '@/lib/colors';
import { useAuth } from '@/lib/auth-context';
import { useSettings } from '@/lib/settings-context';
import { updateProfile } from '@/lib/api';

import ArrowBackIcon from '@/assets/icons/arrow_back.svg';

export default function ProfileSettingsScreen() {
  const c = useColors();
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
          Настройки профиля
        </Text>
        <View style={{ width: 32 }} />
      </View>

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
