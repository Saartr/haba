import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import 'react-native-reanimated';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { telegramAuth, TelegramUser } from '@/lib/api';
import { saveTokens } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function RootLayoutNav() {
  const { authed, checked, setAuthed } = useAuth();
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const processingRef = useRef(false);

  const [fontsLoaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });

  useEffect(() => {
    setReady(true);
  }, []);

  // Обрабатываем Telegram deeplink на уровне root layout — он всегда смонтирован,
  // в отличие от welcome.tsx который может быть не активен при возврате из браузера
  function handleDeepLink(url: string | null) {
    console.log('[TgLogin] handleDeepLink called, url:', url);
    if (!url || !url.startsWith('haba://auth/callback')) {
      console.log('[TgLogin] skip — not a callback url');
      return;
    }
    if (processingRef.current) {
      console.log('[TgLogin] skip — already processing');
      return;
    }
    // Данные могут прийти как query (?tgAuthResult=) через intent:// редирект
    // или как fragment (#tgAuthResult=) через старый флоу
    const queryMatch = url.match(/[?&]tgAuthResult=([^&#]+)/);
    const fragmentMatch = url.match(/#.*tgAuthResult=([^&]+)/);
    const match = queryMatch || fragmentMatch;
    console.log('[TgLogin] queryMatch:', !!queryMatch, 'fragmentMatch:', !!fragmentMatch);
    if (!match) {
      console.log('[TgLogin] skip — no tgAuthResult');
      return;
    }
    try {
      const decoded = JSON.parse(atob(match[1]));
      console.log('[TgLogin] decoded ok, hash present:', !!decoded.hash);
      if (!decoded.hash) return;
      processingRef.current = true;
      console.log('[TgLogin] calling telegramAuth...');
      telegramAuth(decoded as TelegramUser)
        .then(result => saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }).then(() => result))
        .then(result => {
          console.log('[TgLogin] success, user:', result.user?.username);
          setAuthed(true, result.user);
        })
        .catch(e => { console.error('[TgLogin] auth error:', e.message); })
        .finally(() => { processingRef.current = false; });
    } catch (e) {
      console.error('[TgLogin] parse error:', e);
    }
  }

  useEffect(() => {
    console.log('[TgLogin] setting up listeners');

    // Ловим deeplink если приложение уже на переднем плане
    const linkSub = Linking.addEventListener('url', ({ url }) => {
      console.log('[TgLogin] addEventListener fired:', url.slice(0, 80));
      handleDeepLink(url);
    });

    // Ловим deeplink при холодном старте
    Linking.getInitialURL().then(url => {
      console.log('[TgLogin] getInitialURL:', url);
      handleDeepLink(url);
    });

    // Ловим deeplink через AppState: когда приложение возвращается из фона
    // (Oplus/OPPO замораживает процесс, onNewIntent не всегда срабатывает)
    const appStateSub = AppState.addEventListener('change', state => {
      console.log('[TgLogin] AppState change:', state);
      if (state === 'active') {
        Linking.getInitialURL().then(url => {
          console.log('[TgLogin] AppState active, getInitialURL:', url);
          handleDeepLink(url);
        });
      }
    });

    return () => {
      linkSub.remove();
      appStateSub.remove();
    };
  }, []);

  useEffect(() => {
    if (ready && fontsLoaded && checked) {
      SplashScreen.hideAsync();
    }
  }, [ready, fontsLoaded, checked]);

  useEffect(() => {
    if (!ready || !fontsLoaded || !checked) return;
    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';
    const inDev = segments[0] === 'dev';
    if (authed && !inTabs && !inDev) {
      router.replace('/(tabs)');
    } else if (!authed && !inAuth) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, fontsLoaded, checked, authed, segments]);

  if (!ready || !fontsLoaded) return null;

  return (
    <Stack screenOptions={{ animationDuration: 280 }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="dev" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </SettingsProvider>
  );
}
