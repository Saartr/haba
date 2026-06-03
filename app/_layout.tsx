import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Linking, Alert } from 'react-native';
import 'react-native-reanimated';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { ConfirmProvider } from '@/components/ConfirmModal';
import { SnackbarProvider } from '@/lib/snackbar-context';
import { joinHabit, getStepHabits } from '@/lib/api';
import { savePendingInvite, getPendingInvite, clearPendingInvite } from '@/lib/auth';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { hasStepsPermission } from '@/lib/health';
import { Platform } from 'react-native';

const BASE_URL = 'https://bot.mihmih.pro/api/v1';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

function RootLayoutNav() {
  const { authed, checked, user } = useAuth();
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const joiningRef = useRef(false);

  // listener регистрируется один раз — держим актуальный authed в ref
  const authedRef = useRef(authed);
  authedRef.current = authed;

  const [fontsLoaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });

  useEffect(() => {
    setReady(true);
  }, []);

  // Deeplink-инвайт в групповую привычку: haba://join/<code>.
  // Обрабатываем на уровне root layout — он всегда смонтирован.
  function handleDeepLink(url: string | null) {
    if (!url) return;
    if (url.startsWith('haba://join/')) {
      handleJoinDeepLink(url);
    }
  }

  function handleJoinDeepLink(url: string) {
    const code = url.replace('haba://join/', '').split(/[?#]/)[0];
    console.log('[Join] code:', code, 'authed:', authedRef.current);
    if (!code) return;
    if (joiningRef.current) return;

    // Неавторизован — сохраняем код, отправляем на логин; вступим после входа
    if (!authedRef.current) {
      savePendingInvite(code);
      router.replace('/(auth)/welcome');
      return;
    }

    joiningRef.current = true;
    joinHabit(code)
      .then(habit => {
        router.replace(`/(tabs)/habit/${habit.id}`);
      })
      .catch(e => {
        console.error('[Join] error:', e.message);
        Alert.alert('Не удалось вступить', e.message ?? 'Попробуйте позже');
        router.replace('/(tabs)');
      })
      .finally(() => { joiningRef.current = false; });
  }

  useEffect(() => {
    // Инвайт-deeplink на переднем плане и при холодном старте
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    Linking.getInitialURL().then(handleDeepLink);
    return () => {
      linkSub.remove();
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

  // Планируем/отменяем фоновый WorkManager-синк.
  // Ждём user !== null — значит refreshUser() завершился и токены стабильны.
  useEffect(() => {
    if (!checked) return;
    if (!authed) {
      cancelSync();
      return;
    }
    if (Platform.OS !== 'android') return;
    if (!user) return; // ждём пока профиль загрузится (избегаем гонки с refreshTokens)
    (async () => {
      try {
        const granted = await hasStepsPermission();
        if (!granted) return;
        const { ids, startDate } = await getStepHabits();
        scheduleSync(BASE_URL, ids, startDate);
      } catch (e) {
        console.warn('[health-sync] schedule error:', e);
      }
    })();
  }, [authed, checked, user]);

  // После входа: если был отложенный invite (юзер пришёл по ссылке неавторизованным) —
  // вступаем в группу и открываем её экран.
  useEffect(() => {
    if (!ready || !checked || !authed || joiningRef.current) return;
    (async () => {
      const code = await getPendingInvite();
      if (!code) return;
      joiningRef.current = true;
      try {
        const habit = await joinHabit(code);
        router.replace(`/(tabs)/habit/${habit.id}`);
      } catch (e: any) {
        console.error('[Join] pending invite error:', e.message);
        Alert.alert('Не удалось вступить', e.message ?? 'Попробуйте позже');
      } finally {
        await clearPendingInvite();
        joiningRef.current = false;
      }
    })();
  }, [ready, checked, authed]);

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
        <ConfirmProvider>
          <SnackbarProvider>
            <RootLayoutNav />
          </SnackbarProvider>
        </ConfirmProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
