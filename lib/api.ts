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

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
};

export async function telegramAuth(data: TelegramUser): Promise<AuthResult> {
  return request('/auth/telegram', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function vkAuth(data: { accessToken: string; userId: string; firstName?: string; lastName?: string; photo200?: string; email?: string; phone?: string }): Promise<AuthResult> {
  return request('/auth/vk', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export type UserProfile = {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
};

export async function getMe(): Promise<UserProfile> {
  return request('/auth/me', {}, true);
}

export async function updateProfile(data: { first_name?: string }): Promise<UserProfile> {
  return request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }, true);
}

// ── Habits ────────────────────────────────────────────────────────────────────

export type Habit = {
  id: number;
  creator_id: number;
  name: string;
  category: string;
  type: 'solo' | 'group';
  goal_value: number | null;
  goal_unit: string | null;
  notifications: boolean;
  invite_code: string;
  closed_at: string | null;
  created_at: string;
  is_creator: boolean;
};

export type HabitMember = {
  id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  is_self: boolean;
  is_creator: boolean;
};

export type HabitLog = {
  user_id: number;
  date: string;
  value: number;
};

export type HabitDetail = Habit & {
  members: HabitMember[];
  week_logs: HabitLog[];
  streak: { current: number; max: number };
};

export async function createHabit(data: {
  name: string;
  category?: string;
  type?: 'solo' | 'group';
  goal_value?: number;
  goal_unit?: string;
  notifications?: boolean;
}): Promise<Habit> {
  return request('/habits', { method: 'POST', body: JSON.stringify(data) }, true);
}

export async function getHabits(): Promise<Habit[]> {
  return request('/habits', {}, true);
}

export async function getHabit(id: number): Promise<HabitDetail> {
  return request(`/habits/${id}`, {}, true);
}

export async function joinHabit(invite_code: string): Promise<Habit> {
  return request('/habits/join', { method: 'POST', body: JSON.stringify({ invite_code }) }, true);
}

export async function logHabit(id: number, value: number, date?: string): Promise<HabitLog> {
  return request(`/habits/${id}/logs`, { method: 'POST', body: JSON.stringify({ value, date }) }, true);
}

export async function syncHabitSteps(
  id: number,
  value: number,
  source: 'health_connect' | 'healthkit',
  date?: string,
): Promise<HabitLog> {
  return request(
    `/habits/${id}/logs/sync`,
    { method: 'POST', body: JSON.stringify({ value, source, date }) },
    true,
  );
}

export async function excludeMember(habitId: number, userId: number): Promise<void> {
  return request(`/habits/${habitId}/members/${userId}`, { method: 'DELETE' }, true);
}

export async function transferHabit(habitId: number, userId: number): Promise<void> {
  return request(`/habits/${habitId}/transfer`, { method: 'POST', body: JSON.stringify({ user_id: userId }) }, true);
}

export async function closeHabit(habitId: number): Promise<void> {
  return request(`/habits/${habitId}`, { method: 'DELETE' }, true);
}

// ── Internal ──────────────────────────────────────────────────────────────────

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
