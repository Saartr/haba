import { Platform } from 'react-native';
import {
  initialize,
  requestPermission,
  getGrantedPermissions,
  aggregateRecord,
  openHealthConnectSettings,
} from 'react-native-health-connect';

let initialized = false;

async function ensureInitialized(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (initialized) return true;
  try {
    const ok = await initialize();
    initialized = !!ok;
    return initialized;
  } catch (e) {
    console.warn('[health] initialize failed:', e);
    return false;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  return ensureInitialized();
}

export async function hasStepsPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  try {
    const granted = await getGrantedPermissions();
    return granted.some(
      (p) => p.recordType === 'Steps' && p.accessType === 'read',
    );
  } catch (e) {
    console.warn('[health] getGrantedPermissions failed:', e);
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  if (!(await ensureInitialized())) return false;
  try {
    const result = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return result.some(
      (p) => p.recordType === 'Steps' && p.accessType === 'read',
    );
  } catch (e) {
    console.warn('[health] requestPermission failed:', e);
    return false;
  }
}

// Открывает экран разрешений Health Connect (обходит race condition в requestPermission)
export function openHealthConnectPermissions(): void {
  openHealthConnectSettings();
}

// Возвращает шаги за каждый из последних N дней: { '2026-06-01': 8432, ... }
// Дни без данных в результат не включаются.
export async function getStepsByDays(days: number): Promise<Record<string, number>> {
  if (!(await ensureInitialized())) return {};
  const result: Record<string, number> = {};
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    // Локальная дата (не UTC — toISOString() даёт UTC и сдвигает дату для UTC+N)
    const dateStr = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

    try {
      const res = await aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: day.toISOString(),
          endTime: dayEnd.toISOString(),
        },
      });
      const total = (res as { COUNT_TOTAL?: number })?.COUNT_TOTAL ?? 0;
      if (total > 0) result[dateStr] = Math.floor(total);
    } catch {
      // пропускаем день если не смогли прочитать
    }
  }

  return result;
}

export async function getTodaySteps(): Promise<number> {
  if (!(await ensureInitialized())) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  try {
    const result = await aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    const total = (result as { COUNT_TOTAL?: number })?.COUNT_TOTAL ?? 0;
    return Math.max(0, Math.floor(total));
  } catch (e) {
    console.warn('[health] aggregateRecord failed:', e);
    return 0;
  }
}
