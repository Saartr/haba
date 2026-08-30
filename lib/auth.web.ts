// Веб-версия хранения токенов. На вебе нет ни expo-secure-store, ни
// health-sync воркера, который в приложении ротирует refresh-токен в фоне,
// поэтому здесь простой localStorage и никакой синхронизации.
//
// Осознанный компромисс: localStorage доступен из JS, то есть XSS на нашем
// домене означает угон токена. Для этого access-токен живёт 15 минут, а
// refresh ротируется при каждом использовании (см. backend/src/api/auth.js).

const ACCESS_KEY = 'haba_access_token';
const REFRESH_KEY = 'haba_refresh_token';
const PENDING_INVITE_KEY = 'haba_pending_invite';

// В SSR/статической пререндерилке Expo Router window нет — не падаем на импорте.
function storage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

export async function saveTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  const s = storage();
  if (!s) return;
  s.setItem(ACCESS_KEY, tokens.accessToken);
  s.setItem(REFRESH_KEY, tokens.refreshToken);
}

export async function getTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const s = storage();
  if (!s) return null;
  const accessToken = s.getItem(ACCESS_KEY);
  const refreshToken = s.getItem(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  const s = storage();
  if (!s) return;
  s.removeItem(ACCESS_KEY);
  s.removeItem(REFRESH_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getTokens()) !== null;
}

export async function savePendingInvite(code: string): Promise<void> {
  storage()?.setItem(PENDING_INVITE_KEY, code);
}

export async function getPendingInvite(): Promise<string | null> {
  return storage()?.getItem(PENDING_INVITE_KEY) ?? null;
}

export async function clearPendingInvite(): Promise<void> {
  storage()?.removeItem(PENDING_INVITE_KEY);
}
