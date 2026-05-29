import { View, useWindowDimensions, Modal, Linking, Platform } from 'react-native';
import { useState } from 'react';
import { WebView } from 'react-native-webview';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import TapaWelcome from '@/assets/images/tapa_welcome.svg';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';
import { telegramAuth, TelegramUser, vkAuth } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';
import { signInWithVK } from '@/modules/vk-id';

const BOT_ID = '8671249381';
const TELEGRAM_AUTH_URL = `https://oauth.telegram.org/auth?bot_id=${BOT_ID}&origin=${encodeURIComponent('https://bot.mihmih.pro')}&return_to=${encodeURIComponent('https://bot.mihmih.pro/api/v1/auth/telegram-callback')}&request_access=write`;

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [webViewVisible, setWebViewVisible] = useState(false);

  function handleWebViewNavigationStateChange(navState: { url: string }) {
    const { url } = navState;
    if (!url.startsWith('haba://auth/callback')) return;

    setWebViewVisible(false);

    // Данные могут прийти как query (?tgAuthResult=) или fragment (#tgAuthResult=)
    const queryMatch = url.match(/[?&]tgAuthResult=([^&#]+)/);
    const fragmentMatch = url.match(/#.*tgAuthResult=([^&]+)/);
    const match = queryMatch || fragmentMatch;
    if (!match) return;

    try {
      const decoded = JSON.parse(atob(match[1]));
      if (!decoded.hash) return;
      setProcessing(true);
      telegramAuth(decoded as TelegramUser)
        .then(result => saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }).then(() => result))
        .then(result => { setAuthed(true, result.user); })
        .catch((e: any) => { setError(e.message ?? 'Ошибка авторизации'); })
        .finally(() => setProcessing(false));
    } catch {
      setError('Ошибка авторизации');
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
      <TapaWelcome width={width} height={width} />

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
          onPress={() => { setError(null); setWebViewVisible(true); }}
          loading={processing}
          icon={<TelegramIcon width={20} height={20} color={c.text.onPrimary} />}
        />
        {Platform.OS === 'android' && (
          <Button
            label="Войти через VK"
            onPress={handleVkLogin}
            loading={processing}
            variant="secondary"
          />
        )}
      </View>

      <Modal visible={webViewVisible} animationType="slide" onRequestClose={() => setWebViewVisible(false)}>
        <WebView
          source={{ uri: TELEGRAM_AUTH_URL }}
          onNavigationStateChange={handleWebViewNavigationStateChange}
          onShouldStartLoadWithRequest={request => {
            if (request.url.startsWith('haba://')) {
              handleWebViewNavigationStateChange({ url: request.url });
              return false;
            }
            return true;
          }}
        />
      </Modal>
    </SafeAreaView>
  );
}
