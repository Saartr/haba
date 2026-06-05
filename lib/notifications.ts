import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from './api';

// Push-уведомления через нативный FCM-токен (getDevicePushTokenAsync), не Expo Push.
// iOS отложен (нет Apple Developer Account) — пока только Android.
// Нативный модуль ExpoPushTokenManager доступен только после prebuild+сборки APK,
// поэтому все вызовы обёрнуты в try/catch — в dev без сборки тихо пропускаем.

const ANDROID_CHANNEL_ID = 'default';

function getNotifications() {
  try {
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

// Foreground: показывать баннер даже когда приложение открыто.
// Вызываем лениво чтобы не крашить при загрузке модуля в Expo Go / старом APK.
try {
  const Notifications = getNotifications();
  Notifications?.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
} catch {}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  try {
    const Notifications = getNotifications();
    await Notifications?.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Уведомления',
      importance: (Notifications as any).AndroidImportance?.HIGH ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6047ff',
    });
  } catch {}
}

export async function registerForPush(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const Notifications = getNotifications();
    if (!Notifications) return null;
    await ensureAndroidChannel();
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return null;
    const token = await Notifications.getDevicePushTokenAsync();
    if (token?.data) {
      await registerPushToken(token.data, Platform.OS);
      return token.data;
    }
  } catch (e) {
    console.warn('[push] registerForPush failed:', e);
  }
  return null;
}

export function addTokenRotationListener() {
  try {
    const Notifications = getNotifications();
    if (!Notifications) return { remove: () => {} };
    return Notifications.addPushTokenListener(({ data }) => {
      if (data) registerPushToken(data, Platform.OS).catch(() => {});
    });
  } catch {
    return { remove: () => {} };
  }
}

export async function unregisterCurrentPushToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const Notifications = getNotifications();
    if (!Notifications) return;
    const token = await Notifications.getDevicePushTokenAsync();
    if (token?.data) await unregisterPushToken(token.data);
  } catch {}
}
