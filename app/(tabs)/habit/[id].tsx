import { Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useConfirm } from '@/components/ConfirmModal';
import { useSnackbar } from '@/lib/snackbar-context';
import DeleteForeverIcon from '@/assets/icons/DeleteForever.svg';
import { useColors, colors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { getHabit, logHabit, closeHabit, getStepHabits, syncHabitSteps, HabitDetail } from '@/lib/api';
import { scheduleSync, cancelSync } from '@/modules/health-sync';
import { BASE_URL } from '@/lib/config';
import { hasStepsPermission, getStepsByDays } from '@/lib/health';
import { getNotificationsModule } from '@/lib/notifications';
import SoloHabitScreen from '@/components/habit-screens/SoloHabitScreen';
import ProgressionHabitScreen from '@/components/habit-screens/ProgressionHabitScreen';
import PullupsHabitScreen from '@/components/habit-screens/PullupsHabitScreen';
import GroupHabitScreen from '@/components/habit-screens/GroupHabitScreen';

// Контейнер экрана цели: загрузка данных, общие эффекты (пуш-обновление, автосинк шагов)
// и диспетчеризация на 4 варианта экрана (components/habit-screens/*). Вся вёрстка и
// специфичные обработчики живут в самих экранах.
export default function HabitScreen() {
  const c = useColors();
  const { colorScheme } = useSettings();
  const router = useRouter();
  const confirm = useConfirm();
  const showSnackbar = useSnackbar();
  const { id } = useLocalSearchParams<{ id: string }>();
  const habitId = parseInt(id);

  const [habit, setHabit] = useState<HabitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadTrigger, setReloadTrigger] = useState(0);
  const [logLoading, setLogLoading] = useState(false);

  // Сбрасываем стейт при смене habitId — чтобы не показывать данные предыдущей цели
  useEffect(() => {
    setHabit(null);
    setLoading(true);
  }, [habitId]);

  const load = useCallback(async () => {
    try {
      const data = await getHabit(habitId);
      setHabit(data);
      setReloadTrigger(t => t + 1);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  // useFocusEffect, не useEffect — чтобы данные подтягивались при возврате
  // с экрана редактирования (название/описание/настройки цели), а не только при маунте.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Обновляем экран при получении foreground-уведомления по этой цели
  // (новый участник вступил или кто-то внёс данные).
  useEffect(() => {
    const N = getNotificationsModule();
    if (!N) return;
    const sub = N.addNotificationReceivedListener((notification: any) => {
      const data = notification.request.content.data;
      if (data?.habitId && String(data.habitId) === String(habitId)) {
        load();
      }
    });
    return () => sub.remove();
  }, [habitId, load]);

  // Автосинк шагов из Health Connect при загрузке:
  // читаем шаги с даты создания привычки до сегодня и досинкаем все дни с данными.
  useEffect(() => {
    if (!habit || habit.category !== 'steps' || Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        const granted = await hasStepsPermission();
        if (!granted || cancelled) return;

        const createdAt = new Date(habit.created_at);
        const msPerDay = 24 * 60 * 60 * 1000;
        const daysSinceCreation = Math.floor((Date.now() - createdAt.getTime()) / msPerDay) + 1;
        // Не более 90 дней — разумный предел чтобы не читать HC за всю историю
        const daysToSync = Math.min(daysSinceCreation, 90);

        const stepsByDay = await getStepsByDays(daysToSync);
        if (cancelled || Object.keys(stepsByDay).length === 0) return;

        const createdDateStr = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-${String(createdAt.getDate()).padStart(2, '0')}`;
        let synced = false;
        for (const [date, steps] of Object.entries(stepsByDay)) {
          if (cancelled) break;
          // Не синкаем дни раньше даты создания привычки
          if (date < createdDateStr) continue;
          await syncHabitSteps(habitId, steps, 'health_connect', date);
          synced = true;
        }

        if (!cancelled && synced) load();
      } catch (e) {
        console.warn('[health] auto-sync failed:', e);
      }
    })();
    return () => { cancelled = true; };
  }, [habit?.id, habit?.category, habitId, load]);

  async function handleSoloLog(value: number, date?: string) {
    setLogLoading(true);
    try {
      const log = await logHabit(habitId, value, date);
      if (log.pullups_recalculated) {
        showSnackbar('Тренировка пропущена — план пересчитан', 'error');
      }
      load();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message);
    } finally {
      setLogLoading(false);
    }
  }

  async function handleComplete() {
    try { await closeHabit(habitId); } catch {}
    router.replace('/(tabs)/' as any);
  }

  function handleCompleteNewGoal() {
    closeHabit(habitId).catch(() => {});
    router.replace('/(tabs)/create-habit' as any);
  }

  async function handleDeleteSolo() {
    const ok = await confirm({
      title: 'Удалить цель?',
      description: 'Это действие необратимо — вся информация о цели будет стёрта.',
      confirmLabel: 'Удалить',
      confirmIcon: () => <DeleteForeverIcon width={24} height={24} color={c.icon.onPrimary} />,
      destructive: true,
    });
    if (!ok) return;
    try {
      await closeHabit(habitId);
      if (Platform.OS === 'android' && habit?.category === 'steps') {
        getStepHabits().then(({ ids, startDates }) => ids.length > 0 ? scheduleSync(BASE_URL, ids, startDates) : cancelSync()).catch(() => {});
      }
      router.back();
      showSnackbar('Цель удалена', 'success');
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  }

  if (loading || !habit) {
    const screenBg = colorScheme === 'dark' ? c.surface.bg : colors.neutral[75];
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: screenBg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.brand.primary} />
      </SafeAreaView>
    );
  }

  if (habit.type === 'solo' && habit.category === 'pullups') {
    return (
      <PullupsHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
        reloadTrigger={reloadTrigger}
      />
    );
  }

  if (habit.type === 'solo' && habit.checkin_type === 'progression') {
    return (
      <ProgressionHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
        reloadTrigger={reloadTrigger}
        onComplete={handleComplete}
        onCompleteNewGoal={handleCompleteNewGoal}
      />
    );
  }

  if (habit.type === 'solo') {
    return (
      <SoloHabitScreen
        habit={habit}
        onLog={handleSoloLog}
        logLoading={logLoading}
        onDelete={handleDeleteSolo}
        onComplete={handleComplete}
        onCompleteNewGoal={handleCompleteNewGoal}
      />
    );
  }

  return <GroupHabitScreen habit={habit} onReload={load} />;
}
