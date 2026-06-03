import * as SecureStore from 'expo-secure-store';
import { saveWorkerToken } from '@/modules/health-sync';

const ACCESS_KEY = 'haba_access_token';
const REFRESH_KEY = 'haba_refresh_token';
const PENDING_INVITE_KEY = 'haba_pending_invite';

export async function saveTokens(tokens: {
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
  saveWorkerToken(tokens.refreshToken);
}

export async function getTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY);
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

// Invite-код, по которому юзер перешёл будучи неавторизованным.
// Сохраняем до логина, после входа — вступаем в группу и очищаем.
export async function savePendingInvite(code: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, code);
}

export async function getPendingInvite(): Promise<string | null> {
  return SecureStore.getItemAsync(PENDING_INVITE_KEY);
}

export async function clearPendingInvite(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_INVITE_KEY);
}
