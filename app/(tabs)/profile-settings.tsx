import { View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import Input from '@/components/Input';
import Text from '@/components/Text';
import Button from '@/components/Button';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { updateProfile, linkTelegram, linkVk } from '@/lib/api';
import { signInWithTelegram } from '@/modules/telegram-login';
import { signInWithVK } from '@/modules/vk-id';
import NavigationBar from '@/components/NavigationBar';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import VKIcon from '@/assets/icons/VK.svg';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();
  const { colorScheme } = useSettings();
  const c = useColors();

  const screenBg = colorScheme === 'dark' ? colors.neutral[950] : colors.neutral[50];

  const [name, setName] = useState(user?.first_name ?? '');
  const [saving, setSaving] = useState(false);
  const [linkingTg, setLinkingTg] = useState(false);
  const [linkingVk, setLinkingVk] = useState(false);

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

  const handleLinkTelegram = async () => {
    setLinkingTg(true);
    try {
      const idToken = await signInWithTelegram();
      const updated = await linkTelegram(idToken);
      updateUser(updated);
    } catch (e: any) {
      if (e?.message !== 'CANCELLED') {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось привязать Telegram');
      }
    } finally {
      setLinkingTg(false);
    }
  };

  const handleLinkVk = async () => {
    setLinkingVk(true);
    try {
      const result = await signInWithVK();
      const updated = await linkVk(result);
      updateUser(updated);
    } catch (e: any) {
      if (e?.message !== 'CANCELLED') {
        Alert.alert('Ошибка', e?.message ?? 'Не удалось привязать VK');
      }
    } finally {
      setLinkingVk(false);
    }
  };

  const hasTg = !!user?.tg_id;
  const hasVk = !!user?.vk_id;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }} edges={['top']}>
      <NavigationBar title="Настройки профиля" onBack={() => router.back()} />

      <View style={{ paddingHorizontal: 24, paddingTop: 24, gap: 32 }}>
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

        {/* Связанные аккаунты */}
        <View style={{ gap: 12 }}>
          <Text weight="semibold" style={{ fontSize: 14, color: c.text.secondary, letterSpacing: 0.2 }}>
            Связанные аккаунты
          </Text>

          <View style={{ gap: 12 }}>
            {hasTg ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: c.surface.input, borderRadius: 16,
                paddingHorizontal: 20, paddingVertical: 14,
              }}>
                <TelegramIcon width={24} height={24} color={colors.purple[500]} />
                <Text weight="semibold" style={{ fontSize: 15, color: c.text.primary }}>
                  Telegram привязан
                </Text>
              </View>
            ) : (
              <Button
                label="Привязать Telegram"
                icon={<TelegramIcon />}
                onPress={handleLinkTelegram}
                loading={linkingTg}
              />
            )}

            {hasVk ? (
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: c.surface.input, borderRadius: 16,
                paddingHorizontal: 20, paddingVertical: 14,
              }}>
                <VKIcon width={24} height={24} color={colors.purple[500]} />
                <Text weight="semibold" style={{ fontSize: 15, color: c.text.primary }}>
                  VK привязан
                </Text>
              </View>
            ) : (
              <Button
                label="Привязать VK"
                icon={<VKIcon />}
                onPress={handleLinkVk}
                loading={linkingVk}
              />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
