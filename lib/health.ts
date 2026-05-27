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
