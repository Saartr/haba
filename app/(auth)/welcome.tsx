import { View, useWindowDimensions, Modal, Linking } from 'react-native';
import { useState } from 'react';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import TapaWelcome from '@/assets/images/tapa_welcome.svg';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';
import { WebView } from 'react-native-webview';
import { telegramAuth, TelegramUser } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

const TELEGRAM_LOGIN_URL = 'https://bot.mihmih.pro/api/v1/auth/telegram-login';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [showWebView, setShowWebView] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCallback(url: string) {
    const fragment = url.split('#')[1] ?? '';
    const match = fragment.match(/tgAuthResult=([^&]+)/);
    if (!match) return false;
    try {
      const decoded = JSON.parse(atob(match[1]));
      if (!decoded.hash) return false;
      setProcessing(true);
      setShowWebView(false);
      telegramAuth(decoded as TelegramUser)
        .then(result => saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }).then(() => result))
        .then(result => {
          setProcessing(false);
          setAuthed(true, result.user);
        })
        .catch((e: any) => {
          setProcessing(false);
          setError(e.message ?? 'Ошибка авторизации');
        });
      return true;
    } catch {
      return false;
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

      <View className="px-6 pb-8">
        <Button
          label="Войти через Telegram"
          onPress={() => { setError(null); setWebViewKey(k => k + 1); setShowWebView(true); }}
          loading={processing}
          icon={<TelegramIcon width={20} height={20} color={c.text.onPrimary} />}
        />
      </View>

      <Modal
        visible={showWebView}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowWebView(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.default }}>
          <View className="px-4 pb-3 pt-2 flex-row items-center justify-between">
            <Text weight="semibold" className="text-body-16" style={{ color: c.text.primary }}>
              Войти через Telegram
            </Text>
            <Button
              label="Отмена"
              variant="text"
              onPress={() => setShowWebView(false)}
            />
          </View>

          <WebView
            key={webViewKey}
            source={{ uri: TELEGRAM_LOGIN_URL }}
            style={{ flex: 1, backgroundColor: c.surface.default }}
            javaScriptEnabled
            domStorageEnabled
            onShouldStartLoadWithRequest={(request) => {
              if (request.url.startsWith('tg://') || request.url.startsWith('tg:')) {
                Linking.openURL(request.url);
                return false;
              }
              if (request.url.includes('/telegram-callback')) {
                const handled = handleCallback(request.url);
                if (handled) setShowWebView(false);
                return false;
              }
              return true;
            }}
            onNavigationStateChange={(state) => {
              if (state.url?.includes('/telegram-callback')) {
                const handled = handleCallback(state.url);
                if (handled) setShowWebView(false);
              }
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
