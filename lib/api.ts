import { getTokens, saveTokens, clearTokens } from './auth';

const BASE_URL = 'https://bot.mihmih.pro/api/v1';

async function request<T>(
  path: string,
  options: RequestInit = {},
  withAuth = false,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (withAuth) {
    const tokens = await getTokens();
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (res.status === 401 && withAuth) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
      const retry = await fetch(`${BASE_URL}${path}`, { ...options, headers });
      if (!retry.ok) throw new Error('Unauthorized');
      return retry.json();
    }
    await clearTokens();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export async function sendCode(username: string): Promise<void> {
  await request('/auth/send-code', {
    method: 'POST',
    body: JSON.stringify({ username }),
  });
}

export async function verifyCode(
  username: string,
  code: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  return request('/auth/verify-code', {
    method: 'POST',
    body: JSON.stringify({ username, code }),
  });
}

async function refreshTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const tokens = await getTokens();
    if (!tokens?.refreshToken) return null;
    const data = await request<{ accessToken: string; refreshToken: string }>(
      '/auth/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      },
    );
    await saveTokens(data);
    return data;
  } catch {
    return null;
  }
}
