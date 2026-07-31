import { Habit } from '@/lib/api';
import { genitiveUnit, formatUnit } from '@/lib/units';

// Общая логика «статус цели на сегодня» и русская плюрализация — единственный источник
// для карточек главного экрана (index.tsx) и экрана цели (habit/[id].tsx). Раньше эти
// функции были продублированы в обоих файлах и могли разойтись.

export type HabitExtra = { streak: number; streakMax: number; today_value: number };

export type HabitStatus = {
  subtitle: string;
  value: string;
  done: boolean;
  status: 'done' | 'failed' | 'skip';
  showStreakRow: boolean;
  showTag: boolean; // count без цели — без тега статуса (нет состояния выполнено/не выполнено)
};

export function pluralDays(n: number): string {
  const last = n % 10;
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `${n} дней`;
  if (last === 1) return `${n} день`;
  if (last >= 2 && last <= 4) return `${n} дня`;
  return `${n} дней`;
}

export function pluralWord(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** Сегодня — тренировочный день по training_days (1=Пн..7=Вс)? */
export function isTodayTrainingDay(trainingDays: number[] | null): boolean {
  if (!trainingDays) return false;
  const dow = new Date().getDay();
  const isoDay = dow === 0 ? 7 : dow;
  return trainingDays.includes(isoDay);
}

/** Текст сегодняшней тренировки для pullups-цели: «N подходов по M повторений» или «Отдых». */
export function pullupsTodayLabel(habit: Habit): string {
  if (!isTodayTrainingDay(habit.training_days)) return 'Отдых';
  const session = (habit.pullups_plan ?? [])[habit.pullups_session_index];
  if (!session) return 'Отдых';
  return `${session.sets} ${pluralWord(session.sets, 'подход', 'подхода', 'подходов')} `
    + `по ${session.reps} ${pluralWord(session.reps, 'повторение', 'повторения', 'повторений')}`;
}

// Статус цели на сегодня — используется и карточкой в списке,
// и агрегатом «X/Y целей выполнено» в шапке главного экрана.
export function computeHabitStatus(habit: Habit, extra: HabitExtra | null): HabitStatus {
  const isCount = habit.checkin_type === 'count';
  const isBoolean = habit.checkin_type === 'boolean';
  const isProgression = habit.checkin_type === 'progression';
  const isPullups = habit.category === 'pullups';
  const isCountNoGoal = isCount && habit.goal_value == null; // count «без цели»
  const todayVal = extra?.today_value ?? 0;
  const streak = extra?.streak ?? 0;

  const subtitle = habit.category === 'smoking' ? 'Без сигарет'
    : isPullups ? 'Цель на сегодня'
    : isCountNoGoal ? 'Сделано сегодня'
    : isBoolean ? 'Текущий стрик'
    : isProgression ? 'Текущий результат'
    : isCount ? `${genitiveUnit(habit.goal_unit) || 'Количество'} сегодня`
    : 'Шагов за сегодня';

  const value = habit.category === 'smoking'
    ? pluralDays(streak)
    : isPullups
    ? pullupsTodayLabel(habit)
    : isCountNoGoal
    ? formatUnit(todayVal, null) // «N раз» независимо от выбранной единицы (как в макете)
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
  // активность — метрика не имеет смысла), «Подтягиваний» (свой план тренировок/дней отдыха)
  // и count «без цели» (нет порога выполнения — стрик не считаем).
  const showStreakRow = !isProgression && !isPullups && !isCountNoGoal;

  // Тег статуса (выполнено/не выполнено) не показываем для count «без цели» — у него нет
  // состояния выполнения, это просто счётчик.
  const showTag = !isCountNoGoal;

  return { subtitle, value, done, status, showStreakRow, showTag };
}
