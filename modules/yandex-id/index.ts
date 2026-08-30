import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

const YandexIdModule = requireOptionalNativeModule('YandexIdModule');

// Нативный Яндекс ID SDK: показывает системный диалог выбора аккаунта (или браузер, если
// приложений Яндекса нет) и возвращает OAuth-токен. Сервер меняет его на профиль через
// login.yandex.ru/info (POST /auth/yandex).
export function signInWithYandex(): Promise<string> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('Yandex ID is only supported on Android'));
  }
  if (!YandexIdModule) {
    return Promise.reject(new Error('YandexIdModule is not available'));
  }
  return YandexIdModule.signIn();
}

/** Есть только в веб-версии (index.web.ts), где вход идёт редиректом и
 *  промежуточные значения PKCE лежат в sessionStorage. В приложении вход
 *  завершает нативный SDK, ничего сохранять между шагами не нужно —
 *  заглушка держит одинаковый интерфейс модуля на обеих платформах. */
export function takeStoredAuthRequest(): { codeVerifier: string | null; state: string | null } {
  return { codeVerifier: null, state: null };
}
