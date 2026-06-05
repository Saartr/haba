import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from './api';

// Push-уведомления через нативный FCM-токен (getDevicePushTokenAsync), не Expo Push.
// iOS отложен (нет Apple Developer Account) — пока только Android.

const ANDROID_CHANNEL_ID = 'default'; // должен совпадать с channel_id в backend/src/push/fcm.js

// Foreground: показывать баннер даже когда приложение открыто.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Уведомления',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6047ff',
  });
}

// Запрос прав + получение FCM-токена + регистрация на бэкенде.
// Возвращает токен или null (нет прав / не Android).
export async function registerForPush(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  await ensureAndroidChannel();

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  try {
    const token = await Notifications.getDevicePushTokenAsync(); // { type:'android', data: FCM-token }
    if (token?.data) {
      await registerPushToken(token.data, Platform.OS);
      return token.data;
    }
  } catch (e) {
    console.warn('[push] registerForPush failed:', e);
  }
  return null;
}

// Токен FCM может ротироваться — переотправляем новый на бэкенд.
export function addTokenRotationListener() {
  return Notifications.addPushTokenListener(({ data }) => {
    if (data) registerPushToken(data, Platform.OS).catch(() => {});
  });
}

// Отписка устройства при логауте (чтобы пуши не шли вышедшему юзеру).
export async function unregisterCurrentPushToken(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const token = await Notifications.getDevicePushTokenAsync();
    if (token?.data) await unregisterPushToken(token.data);
  } catch {
    // устройство могло отозвать токен — не критично
  }
}
