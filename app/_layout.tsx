import '../global.css';

import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import { isAuthenticated } from '@/lib/auth';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    isAuthenticated().then((ok) => {
      setAuthed(ok);
      setReady(true);
      SplashScreen.hideAsync();
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === '(auth)';
    if (authed && inAuth) {
      router.replace('/(tabs)');
    } else if (!authed && !inAuth) {
      router.replace('/(auth)/welcome');
    }
  }, [ready, authed, segments]);

  if (!ready) return null;

  return (
    <Stack>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    </Stack>
  );
}
