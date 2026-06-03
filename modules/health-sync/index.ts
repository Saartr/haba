import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

type HealthSyncModule = {
  saveWorkerToken(refreshToken: string): void;
  scheduleSync(baseUrl: string, habitIds: number[], startDates: string[]): void;
  cancelSync(): void;
};

function getModule(): HealthSyncModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    return requireNativeModule('HealthSync');
  } catch {
    return null;
  }
}

export function saveWorkerToken(refreshToken: string): void {
  getModule()?.saveWorkerToken(refreshToken);
}

export function scheduleSync(baseUrl: string, habitIds: number[], startDates: string[]): void {
  if (habitIds.length === 0) {
    cancelSync();
    return;
  }
  getModule()?.scheduleSync(baseUrl, habitIds, startDates);
}

export function cancelSync(): void {
  getModule()?.cancelSync();
}
