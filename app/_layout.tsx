import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
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
    if (!url || !url.startsWith('haba://auth/callback')) return;
    if (processingRef.current) return;
    const fragment = url.split('#')[1] ?? '';
    const match = fragment.match(/tgAuthResult=([^&]+)/);
    if (!match) return;
    try {
      const decoded = JSON.parse(atob(match[1]));
      if (!decoded.hash) return;
      processingRef.current = true;
      telegramAuth(decoded as TelegramUser)
        .then(result => saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken }).then(() => result))
        .then(result => { setAuthed(true, result.user); })
        .catch(e => { console.error('[TgLogin] auth error:', e.message); })
        .finally(() => { processingRef.current = false; });
    } catch (e) {
      console.error('[TgLogin] parse error:', e);
    }
  }

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then(handleDeepLink);
    return () => sub.remove();
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
