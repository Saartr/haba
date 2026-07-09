import { View, Pressable, Image, FlatList, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';
import Text from '@/components/Text';
import HabitTag from '@/components/HabitTag';
import ProgressBar from '@/components/ProgressBar';
import Toolbar from '@/components/Toolbar';
import BottomSheet from '@/components/BottomSheet';
import Input from '@/components/Input';
import Button from '@/components/Button';
import MascotSvg from '@/assets/images/chill.svg';
import GroupIcon from '@/assets/icons/Group.svg';
import PersonIcon from '@/assets/icons/Person.svg';
import UserIcon from '@/assets/icons/User.svg';
import SettingsIcon from '@/assets/icons/Settings.svg';
import GroupPlusIcon from '@/assets/icons/GroupPlus.svg';
import PlusIcon from '@/assets/icons/Plus.svg';
import CheckIcon from '@/assets/icons/Check.svg';
import { useColors } from '@/lib/colors';
import { useSettings } from '@/lib/settings-context';
import { useAuth } from '@/lib/auth-context';
import { useSnackbar } from '@/lib/snackbar-context';
import { getHabits, getHabit, joinHabit, Habit } from '@/lib/api';
import { genitiveUnit } from '@/lib/units';

type HabitExtra = { streak: number; streakMax: number; today_value: number };

// Пользователь может вставить полную ссылку (https://.../join/<code>, haba://join/<code>)
// или просто код — берём последний сегмент пути без query/hash.
function extractInviteCode(input: string): string {
  const noQuery = input.trim().split(/[?#]/)[0].replace(/\/+$/, '');
  return noQuery.split('/').pop() ?? '';
}

function pluralDays(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} дней`;
  if (last === 1) return `${n} день`;
  if (last >= 2 && last <= 4) return `${n} дня`;
  return `${n} дней`;
}

function pluralWord(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

function isTodayTrainingDay(trainingDays: number[] | null): boolean {
  if (!trainingDays) return false;
  const dow = new Date().getDay();
  const isoDay = dow === 0 ? 7 : dow;
  return trainingDays.includes(isoDay);
}

function pullupsTodayLabel(habit: Habit): string {
  if (!isTodayTrainingDay(habit.training_days)) return 'Отдых';
  const session = (habit.pullups_plan ?? [])[habit.pullups_session_index];
  if (!session) return 'Отдых';
  return `${session.sets} ${pluralWord(session.sets, 'подход', 'подхода', 'подходов')} `
    + `по ${session.reps} ${pluralWord(session.reps, 'повторение', 'повторения', 'повторений')}`;
}

type HabitStatus = {
  subtitle: string;
  value: string;
  done: boolean;
  status: 'done' | 'failed' | 'skip';
  showStreakRow: boolean;
};

// Общая логика статуса цели на сегодня — используется и карточкой в списке,
// и агрегатом «X/Y целей выполнено» в шапке экрана.
function computeHabitStatus(habit: Habit, extra: HabitExtra | null): HabitStatus {
  const isCount = habit.checkin_type === 'count';
  const isBoolean = habit.checkin_type === 'boolean';
  const isProgression = habit.checkin_type === 'progression';
  const isPullups = habit.category === 'pullups';
  const todayVal = extra?.today_value ?? 0;
  const streak = extra?.streak ?? 0;

  const subtitle = habit.category === 'smoking' ? 'Без сигарет'
    : isPullups ? 'Цель на сегодня'
    : isBoolean ? 'Текущий стрик'
    : isProgression ? 'Текущий результат'
    : isCount ? `${genitiveUnit(habit.goal_unit) || 'Количество'} сегодня`
    : 'Шагов за сегодня';

  const value = habit.category === 'smoking'
    ? pluralDays(streak)
    : isPullups
    ? pullupsTodayLabel(habit)
    : isBoolean
    ? String(streak)
    : isProgression
    ? `${todayVal}/${habit.goal_value ?? 0}`
    : isCount
      ? `${todayVal}${habit.goal_value ? ` / ${habit.goal_value}` : ''}`
      : `${todayVal}/${habit.goal_value ?? 0}`;

  const isRestDay = isPullups && !isTodayTrainingDay(habit.training_days);

  const done = habit.category === 'smoking'
    ? streak > 0
    : isPullups
    ? isRestDay || todayVal >= 1
    : isBoolean
    ? todayVal >= 1
    : isProgression
    ? habit.goal_value != null && todayVal >= habit.goal_value
    // count без цели (безлимитная групповая) — всегда выполнено, даже при 0 за день
    : isCount && habit.goal_value == null
    ? true
    : todayVal >= (habit.goal_value ?? 1) && (habit.goal_value ?? 0) > 0;

  const status: 'done' | 'failed' | 'skip' = isRestDay ? 'skip' : done ? 'done' : 'failed';

  // Стрик не показываем для «Прогрессии» (одна разовая цель, не повторяющаяся ежедневная
  // активность — метрика не имеет смысла) и «Подтягиваний» (свой план тренировок/дней отдыха).
  const showStreakRow = !isProgression && !isPullups;

  return { subtitle, value, done, status, showStreakRow };
}

function HabitCard({ habit, extra, onPress }: {
  habit: Habit;
  extra: HabitExtra | null;
  onPress: () => void;
}) {
  const c = useColors();
  const streakMax = extra?.streakMax ?? 0;
  const { subtitle, value, status, showStreakRow } = computeHabitStatus(habit, extra);
  const TypeIcon = habit.type === 'group' ? GroupIcon : PersonIcon;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={{ backgroundColor: c.surface.bg, borderRadius: 24, padding: 16, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TypeIcon width={20} height={20} color={c.text.secondary} />
          <Text weight="bold" numberOfLines={1} style={{ flex: 1, fontSize: 14, lineHeight: 14 * 1.4, color: c.text.primary, letterSpacing: 0.2 }}>
            {habit.name}
          </Text>
          <HabitTag type={status} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight="medium" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
            {subtitle}
          </Text>
          <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
            {value}
          </Text>
        </View>

        {showStreakRow && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight="medium" style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
              Максимальный стрик
            </Text>
            <Text weight="bold" style={{ fontSize: 16, lineHeight: 16 * 1.5, color: c.text.primary, letterSpacing: 0.2 }}>
              {pluralDays(streakMax)}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

export default function HabitsScreen() {
  const c = useColors();
  const router = useRouter();
  const { user } = useAuth();
  const { colorScheme } = useSettings();
  const insets = useSafeAreaInsets();
  const showSnackbar = useSnackbar();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [extras, setExtras] = useState<Record<number, HabitExtra>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const openingHabitRef = useRef(false);

  const [joinModal, setJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin() {
    const code = extractInviteCode(joinCode);
    if (!code) { setJoinError('Введите код или ссылку'); return; }
    setJoinLoading(true);
    setJoinError(null);
    try {
      const habit = await joinHabit(code);
      setJoinModal(false);
      setJoinCode('');
      router.push(`/(tabs)/habit/${habit.id}`);
      showSnackbar('Вы вступили в группу', 'success');
    } catch (e: any) {
      setJoinError(e.message ?? 'Не удалось вступить');
    } finally {
      setJoinLoading(false);
    }
  }

  const rawName = user?.first_name ?? user?.username ?? null;
  const displayName = rawName && rawName.length > 12 ? rawName.slice(0, 12) + '…' : rawName;

  const load = useCallback(async () => {
    try {
      const data = await getHabits();
      setHabits(data);

      const results = await Promise.allSettled(data.map(h => getHabit(h.id)));
      const map: Record<number, HabitExtra> = {};
      const today = new Date().toISOString().split('T')[0];
      results.forEach((res, i) => {
        if (res.status === 'fulfilled') {
          const detail = res.value;
          const self = detail.members.find(m => m.is_self);
          const todayLog = self
            ? detail.week_logs.find(l => l.date.slice(0, 10) === today && l.user_id === self.id)
            : undefined;
          map[data[i].id] = {
            streak: detail.streak.current,
            streakMax: detail.streak.max,
            today_value: todayLog?.value ?? 0,
          };
        }
      });
      setExtras(map);
    } catch {
      // не авторизован или сеть — оставляем пустой список
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
    // Сбрасываем гейт от двойного тапа по карточке при каждом возврате на экран.
    openingHabitRef.current = false;
  }, [load]));

  // Pull-to-refresh — тот же load, но со спиннером RefreshControl вместо полноэкранного.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  // Быстрый двойной тап по карточке до начала перехода успевал вызвать router.push
  // дважды — в стеке оказывалось два экрана цели. Блокируем повторный переход, пока
  // не вернёмся на этот экран (см. сброс во focus-эффекте выше).
  function openHabit(id: number) {
    if (openingHabitRef.current) return;
    openingHabitRef.current = true;
    router.push(`/(tabs)/habit/${id}`);
  }

  // Только активные (не истёкшие по периоду) цели — та же фильтрация, что и в списке ниже.
  const visibleHabits = habits.filter(h => {
    if (h.duration_type === 'period' && h.period_end && h.period_end < new Date().toISOString().slice(0, 10)) return false;
    return true;
  });
  const total = visibleHabits.length;
  const doneCount = visibleHabits.filter(h => computeHabitStatus(h, extras[h.id] ?? null).done).length;
  const allDone = total > 0 && doneCount === total;
  const statusText = allDone ? 'Все цели выполнены' : `${doneCount}/${total} целей выполнено`;

  const isEmpty = !loading && habits.length === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.surface.bg }}>
      <StatusBar backgroundColor={c.surface.bg} barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />

      {isEmpty ? (
        <>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <MascotSvg width={345} height={293} />
            <Text weight="semibold" style={{ fontSize: 16, color: c.text.secondary, textAlign: 'center', letterSpacing: 0.2 }}>
              Нет активных целей
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Добавить"
                icon={<PlusIcon />}
                onPress={() => router.push('/(tabs)/create-habit')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Вступить"
                icon={<GroupPlusIcon />}
                onPress={() => { setJoinError(null); setJoinModal(true); }}
              />
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Header — маскот слева, приветствие+статус и прогресс-бар справа. Лежит на фоне
              страницы (surface.bg); список карточек ниже — на отдельной светлой «простыне». */}
          {!loading && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: insets.top + 16, paddingHorizontal: 24 }}>
              <Image
                source={allDone ? require('@/assets/images/tapa_happy.png') : require('@/assets/images/tapa_sad.png')}
                style={{ width: 140, height: 113 }}
                resizeMode="contain"
              />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={{ gap: 2 }}>
                  <Text weight="bold" numberOfLines={1} style={{ fontSize: 14, lineHeight: 14 * 1.4, color: c.text.primary, letterSpacing: 0.2 }}>
                    {displayName ? `Привет, ${displayName}` : 'Привет'}
                  </Text>
                  <Text weight="semibold" numberOfLines={1} style={{ fontSize: 12, lineHeight: 12 * 1.4, color: c.text.secondary, letterSpacing: 0.2 }}>
                    {statusText}
                  </Text>
                </View>
                <ProgressBar total={total} value={doneCount} />
              </View>
            </View>
          )}

          {/* Простыня со скруглением сверху — фон surface.input, под ней список карточек */}
          <View style={{
            flex: 1,
            backgroundColor: c.surface.input,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
          }}>
            {loading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={c.brand.primary} />
              </View>
            ) : (
              <FlatList
                data={visibleHabits}
                keyExtractor={h => String(h.id)}
                contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 96, gap: 16 }}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    colors={[c.brand.primary]}
                    tintColor={c.brand.primary}
                    progressBackgroundColor={c.surface.input}
                    progressViewOffset={56}
                  />
                }
                renderItem={({ item }) => (
                  <HabitCard
                    habit={item}
                    extra={extras[item.id] ?? null}
                    onPress={() => openHabit(item.id)}
                  />
                )}
              />
            )}
          </View>

          {/* Toolbar — по центру внизу */}
          {!loading && (
            <View style={{ position: 'absolute', bottom: insets.bottom + 24, left: 0, right: 0, alignItems: 'center' }}>
              <Toolbar
                icon={<SettingsIcon />}
                onIconPress={() => router.push('/(tabs)/app-settings')}
                fabItems={[
                  {
                    label: 'Создать цель',
                    icon: () => <UserIcon width={24} height={24} color={c.text.secondary} />,
                    onPress: () => router.push('/(tabs)/create-habit'),
                  },
                  {
                    label: 'Вступить в группу',
                    icon: () => <GroupPlusIcon width={24} height={24} color={c.text.secondary} />,
                    onPress: () => { setJoinError(null); setJoinModal(true); },
                  },
                ]}
              />
            </View>
          )}
        </>
      )}

      {/* Вступление в группу по коду/ссылке */}
      <BottomSheet
        visible={joinModal}
        title="Вступить в группу"
        onClose={() => { setJoinModal(false); setJoinCode(''); setJoinError(null); }}
      >
        <View style={{ gap: 16 }}>
          <Input
            label="Код-ссылка"
            value={joinCode}
            onChangeText={(t) => { setJoinCode(t); if (joinError) setJoinError(null); }}
            placeholder="Вставьте ссылку или код"
            error={joinError ?? undefined}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Подтвердить"
            onPress={handleJoin}
            loading={joinLoading}
            icon={<CheckIcon />}
          />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
