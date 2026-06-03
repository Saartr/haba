import { View, useWindowDimensions, Platform } from 'react-native';
import { useState } from 'react';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import VKIcon from '@/assets/icons/VK.svg';
import TapaWelcome from '@/assets/images/tapa_welcome.svg';
import Button from '@/components/Button';
import { useColors, colors } from '@/lib/colors';
import { vkAuth, telegramNativeAuth } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { signInWithVK } from '@/modules/vk-id';
import { signInWithTelegram } from '@/modules/telegram-login';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleTelegramLogin() {
    setError(null);
    setProcessing(true);
    try {
      const idToken = await signInWithTelegram();
      const result = await telegramNativeAuth(idToken);
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setAuthed(true, result.user);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка авторизации через Telegram');
    } finally {
      setProcessing(false);
    }
  }

  async function handleVkLogin() {
    setError(null);
    setProcessing(true);
    try {
      const vkResult = await signInWithVK();
      const result = await vkAuth({
        accessToken: vkResult.accessToken,
        userId: vkResult.userId,
        firstName: vkResult.firstName,
        lastName: vkResult.lastName,
        photo200: vkResult.photo200,
        email: vkResult.email,
        phone: vkResult.phone,
      });
      await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      setAuthed(true, result.user);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка авторизации через VK');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
      <TapaWelcome width={width} height={Math.round(width * 332 / 393)} />

      <View className="px-6 mt-4">
        <Text weight="bold" className="text-h2 mb-2" style={{ color: c.text.primary }}>
          О, привет!
        </Text>
        <Text className="text-body-16" style={{ color: c.text.secondary }}>
          Меня зовут Тапа, давай вместе начнем лежать в направлении твоих целей.
        </Text>
        {error && (
          <Text className="text-body-14 mt-3" style={{ color: c.semantic.error }}>
            {error}
          </Text>
        )}
      </View>

      <View className="flex-1" />

      <View className="px-6 pb-8 gap-3">
        <Button
          label="Войти через Telegram"
          onPress={handleTelegramLogin}
          loading={processing}
          variant="secondary"
          icon={<TelegramIcon />}
        />
        {Platform.OS === 'android' && (
          <Button
            label="Войти через VK ID"
            onPress={handleVkLogin}
            loading={processing}
            icon={<VKIcon />}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
