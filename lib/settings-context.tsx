import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Toggle = 'on' | 'off';

export type Settings = {
  theme: ThemePreference;
  notifications: Toggle;
  googleFit: Toggle;
};

type SettingsContextType = {
  settings: Settings;
  colorScheme: 'light' | 'dark';
  updateSettings: (updates: Partial<Settings>) => void;
};

const STORE_KEY = 'app_settings';

const defaults: Settings = {
  theme: 'system',
  notifications: 'on',
  googleFit: 'off',
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaults,
  colorScheme: 'light',
  updateSettings: () => {},
});

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<Settings>(defaults);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then(raw => {
      if (raw) {
        try { setSettings({ ...defaults, ...JSON.parse(raw) }); } catch {}
      }
    });
  }, []);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const colorScheme: 'light' | 'dark' =
    settings.theme === 'system' ? (systemScheme ?? 'light') : settings.theme;

  return (
    <SettingsContext.Provider value={{ settings, colorScheme, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
