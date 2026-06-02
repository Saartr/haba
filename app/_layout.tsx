import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AppState, Linking, Alert } from 'react-native';
import 'react-native-reanimated';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { SettingsProvider } from '@/lib/settings-context';
import { ConfirmProvider } from '@/components/ConfirmModal';
import { telegramAuth, TelegramUser, joinHabit } from '@/lib/api';
import { saveTokens, savePendingInvite, getPendingInvite, clearPendingInvite } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

// tgAuthResult приходит из URL: percent-encoded + возможно base64url (без padding, с -/_).
// atob ожидает обычный base64 — нормализуем перед декодом.
function decodeBase64Json(raw: string): string {
  let s = decodeURIComponent(raw).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return atob(s);
}

function RootLayoutNav() {
  const { authed, checked, setAuthed } = useAuth();
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const processingRef = useRef(false);
  const joiningRef = useRef(false);

  // listener регистрируется один раз — держим актуальный authed в ref
  const authedRef = useRef(authed);
  authedRef.current = authed;

  const [fontsLoaded] = useFonts({ Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold });

  useEffect(() => {
    setReady(true);
  }, []);

  // Обрабатываем Telegram deeplink на уровне root layout — он всегда смонтирован,
  // в отличие от welcome.tsx который может быть не активен при возврате из браузера
  function handleDeepLink(url: string | null) {
    console.log('[DeepLink] handleDeepLink called, url:', url);
    if (!url) return;

    // Инвайт в групповую привычку: haba://join/<code>
    if (url.startsWith('haba://join/')) {
      handleJoinDeepLink(url);
      return;
    }

    if (!url.startsWith('haba://auth/callback')) {
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
      const decoded = JSON.parse(decodeBase64Json(match[1]));
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
          <RootLayoutNav />
        </ConfirmProvider>
      </AuthProvider>
    </SettingsProvider>
  );
}
