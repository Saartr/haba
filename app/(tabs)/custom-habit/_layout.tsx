import { Stack } from 'expo-router';
import { createContext, useContext, useState } from 'react';

export type CustomHabitState = {
  // Шаг 1
  habitType: 'solo' | 'group';
  name: string;
  description: string;
  // Шаг 2
  checkinType: 'boolean' | 'count' | 'progression';
  unitPreset: string;
  unitLabel: string;
  goalValue: string;
  progressionStart: string;
  // Шаг 3
  periodicity: 'daily' | 'weekdays' | 'n_per_week' | 'n_per_month';
  timesPerDay: number;
  notificationTimes: string[];
  weekdays: number[];
  timesPerWeek: string;
  timesPerMonth: string;
  monthCountType: 'summary' | 'dates';
  monthDates: number[];
  durationType: 'unlimited' | 'period' | 'until_goal';
  periodStart: string;
  periodEnd: string;
};

const defaultState: CustomHabitState = {
  habitType: 'solo',
  name: '',
  description: '',
  checkinType: 'boolean',
  unitPreset: 'custom',
  unitLabel: '',
  goalValue: '',
  progressionStart: '',
  periodicity: 'daily',
  timesPerDay: 1,
  notificationTimes: ['12:00'],
  weekdays: [],
  timesPerWeek: '',
  timesPerMonth: '',
  monthCountType: 'summary',
  monthDates: [],
  durationType: 'unlimited',
  periodStart: '',
  periodEnd: '',
};

type ContextType = {
  state: CustomHabitState;
  set: (patch: Partial<CustomHabitState>) => void;
  reset: () => void;
};

const CustomHabitContext = createContext<ContextType>({
  state: defaultState,
  set: () => {},
  reset: () => {},
});

export function useCustomHabit() {
  return useContext(CustomHabitContext);
}

export default function CustomHabitLayout() {
  const [state, setState] = useState<CustomHabitState>(defaultState);

  function set(patch: Partial<CustomHabitState>) {
    setState(prev => ({ ...prev, ...patch }));
  }

  function reset() {
    setState(defaultState);
  }

  return (
    <CustomHabitContext.Provider value={{ state, set, reset }}>
      <Stack screenOptions={{ headerShown: false, animationDuration: 280 }}>
        <Stack.Screen name="step1" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="step2" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="step3" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </CustomHabitContext.Provider>
  );
}
