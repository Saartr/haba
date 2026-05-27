import { View, useWindowDimensions, Linking } from 'react-native';
import { useState, useEffect, useRef } from 'react';
import Text from '@/components/Text';
import { SafeAreaView } from 'react-native-safe-area-context';
import TelegramIcon from '@/assets/icons/Telegram.svg';
import TapaWelcome from '@/assets/images/tapa_welcome.svg';
import Button from '@/components/Button';
import { useColors } from '@/lib/colors';
import { telegramAuth, TelegramUser } from '@/lib/api';
import { saveTokens } from '@/lib/auth';
import { useAuth } from '@/lib/auth-context';

const TELEGRAM_LOGIN_URL = 'https://bot.mihmih.pro/api/v1/auth/telegram-login';

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const c = useColors();
  const { setAuthed } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listenerRef = useRef<ReturnType<typeof Linking.addEventListener> | null>(null);

  function handleDeepLink(url: string) {
    if (!url.startsWith('haba://auth/callback')) return;
    const fragment = url.split('#')[1] ?? '';
    const match = fragment.match(/tgAuthResult=([^&]+)/);
    if (!match) return;
    try {
      const decoded = JSON.parse(atob(match[1]));
      if (!decoded.hash) return;
      setProcessing(true);
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
    } catch {
      setError('Ошибка авторизации');
    }
  }

  useEffect(() => {
    // Ловим deeplink если приложение уже открыто
    listenerRef.current = Linking.addEventListener('url', ({ url }) => {
      console.log('[TgLogin] deeplink:', url);
      handleDeepLink(url);
    });

    // Ловим deeplink если приложение было закрыто
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('[TgLogin] initialURL:', url);
        handleDeepLink(url);
      }
    });

    return () => {
      listenerRef.current?.remove();
    };
  }, []);

  function openTelegram() {
    setError(null);
    Linking.openURL(TELEGRAM_LOGIN_URL).catch(() => {
      setError('Не удалось открыть браузер');
    });
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
          onPress={openTelegram}
          loading={processing}
          icon={<TelegramIcon width={20} height={20} color={c.text.onPrimary} />}
        />
      </View>
    </SafeAreaView>
  );
}
