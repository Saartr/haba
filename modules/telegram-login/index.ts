import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const TelegramLoginModule = requireOptionalNativeModule('TelegramLoginModule');

// Нативный Telegram SDK открывает Telegram-приложение, возвращает id_token (OIDC JWT)
// через App Link. Сервер верифицирует токен (POST /auth/telegram-native).
export function signInWithTelegram(): Promise<string> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('Telegram native login is only supported on Android'));
  }
  if (!TelegramLoginModule) {
    return Promise.reject(new Error('TelegramLoginModule is not available'));
  }
  return TelegramLoginModule.startLogin();
}
