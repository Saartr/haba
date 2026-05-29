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

function resolveScheme(theme: ThemePreference, sys: 'light' | 'dark'): 'light' | 'dark' {
  return theme === 'system' ? sys : theme;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const systemScheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [settings, setSettings] = useState<Settings>(defaults);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>(systemScheme);

  useEffect(() => {
    SecureStore.getItemAsync(STORE_KEY).then(raw => {
      if (raw) {
        try {
          const loaded: Settings = { ...defaults, ...JSON.parse(raw) };
          setSettings(loaded);
          setColorScheme(resolveScheme(loaded.theme, systemScheme));
        } catch {}
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Синхронизируем с системной темой если выбрано 'system'
  useEffect(() => {
    if (settings.theme === 'system') {
      setColorScheme(systemScheme);
    }
  }, [systemScheme, settings.theme]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...updates };
      SecureStore.setItemAsync(STORE_KEY, JSON.stringify(next));
      return next;
    });
    if ('theme' in updates) {
      setColorScheme(resolveScheme(updates.theme!, systemScheme));
    }
  }, [systemScheme]);

  return (
    <SettingsContext.Provider value={{ settings, colorScheme, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
