import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface VkAuthResult {
  accessToken: string;
  userId: string;
  expiresIn: number;
  firstName: string;
  lastName: string;
  photo200: string;
  email: string;
  phone: string;
}

const VkIdModule = requireOptionalNativeModule('VkIdModule');

export function signInWithVK(): Promise<VkAuthResult> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('VK ID is only supported on Android'));
  }
  if (!VkIdModule) {
    return Promise.reject(new Error('VkIdModule is not available'));
  }
  return VkIdModule.signIn();
}

/** Есть только в iOS-версии модуля (index.ios.ts), где вход идёт через системную
 *  веб-сессию и возвращает код авторизации. Заглушка держит одинаковый интерфейс. */
export function signInWithVKCode(): Promise<{ code: string; codeVerifier: string; deviceId: string }> {
  return Promise.reject(new Error('signInWithVKCode доступен только на iOS'));
}

/** Помечает state, чтобы страница-callback поняла: возвращать код надо в приложение.
 *  Значение должно совпадать с index.ios.ts. */
export const NATIVE_STATE_PREFIX = 'app.';
