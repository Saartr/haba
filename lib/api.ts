import { getTokens, saveTokens, clearTokens } from './auth';
import { BASE_URL } from './config';

let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: () => void) {
  onSessionExpired = handler;
}

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
    onSessionExpired?.();
    throw new Error('Session expired');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message ?? `HTTP ${res.status}`);
  }

  return res.json();
}

export type AuthResult = {
  accessToken: string;
  refreshToken: string;
  user: UserProfile;
};

// Нативный Telegram SDK отдаёт id_token (OIDC JWT) — сервер его верифицирует.
export async function telegramNativeAuth(idToken: string): Promise<AuthResult> {
  return request('/auth/telegram-native', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
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
  tg_id: string | null;
  vk_id: string | null;
};

export async function getMe(): Promise<UserProfile> {
  return request('/auth/me', {}, true);
}

export async function updateProfile(data: { first_name: string }): Promise<UserProfile> {
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
  id: number;
  habit_id: number;
  user_id: number;
  date: string;
  value: number;
  source: string;
};

export type Streak = { current: number; max: number };

export type HabitDetail = Habit & {
  members: HabitMember[];
  week_logs: HabitLog[];
  streak: Streak;
  // Стрики по каждому участнику (ключ — user id), для модалки детализации
  member_streaks: Record<number, Streak>;
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

export async function getStepHabits(): Promise<{ ids: number[]; startDates: string[] }> {
  const habits = await getHabits();
  const stepHabits = habits.filter(h => h.category === 'steps');
  const ids = stepHabits.map(h => h.id);
  // Дата создания для каждой привычки отдельно
  const startDates = stepHabits.map(h => h.created_at.slice(0, 10));
  return { ids, startDates };
}

export async function getStepHabitIds(): Promise<number[]> {
  return (await getStepHabits()).ids;
}

export async function getHabit(id: number): Promise<HabitDetail> {
  return request(`/habits/${id}`, {}, true);
}

export async function joinHabit(invite_code: string): Promise<Habit> {
  return request('/habits/join', { method: 'POST', body: JSON.stringify({ invite_code }) }, true);
}

export async function getHabitLogs(id: number, from: string, to: string, userId?: number): Promise<HabitLog[]> {
  const q = userId != null ? `&userId=${userId}` : '';
  return request(`/habits/${id}/logs?from=${from}&to=${to}${q}`, {}, true);
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

export async function leaveHabit(habitId: number): Promise<void> {
  return request(`/habits/${habitId}/members/me`, { method: 'DELETE' }, true);
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

export async function deleteAccount(): Promise<void> {
  return request('/auth/me', { method: 'DELETE' }, true);
}

// ── Push ────────────────────────────────────────────────────────────────────

export async function registerPushToken(token: string, platform: string): Promise<void> {
  await request('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) }, true);
}

export async function unregisterPushToken(token: string): Promise<void> {
  await request('/push/register', { method: 'DELETE', body: JSON.stringify({ token }) }, true);
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
