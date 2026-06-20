// Расчёт прогрессивного плана для цели «Подтягивания».
// См. project_pullups_goal_plan.md — формула и тренерская валидация.

const INTENSITY = {
  low: { sessionsPerWeek: 2, growth: 0.07 },
  medium: { sessionsPerWeek: 3, growth: 0.1 },
  high: { sessionsPerWeek: 4, growth: 0.13 },
};

// Раскладка недельного объёма на подходы × повторения.
function decompose(volume, targetReps) {
  if (volume / 3 <= 8) {
    return { sets: 3, reps: Math.ceil(volume / 3) };
  }
  if (volume / 4 <= targetReps) {
    return { sets: 4, reps: Math.ceil(volume / 4) };
  }
  return { sets: 4, reps: targetReps };
}

// currentForm/targetReps — повторений в подходе (старт при 3 подходах, финал при 4 подходах).
// Возвращает развёрнутый по тренировкам массив [{ session, sets, reps }].
function buildPullupsPlan(currentForm, targetReps, intensity) {
  const { sessionsPerWeek, growth } = INTENSITY[intensity];

  const startVolume = 3 * currentForm;
  const finalVolume = 4 * targetReps;

  const weeks = Math.max(1, Math.ceil(Math.log(finalVolume / startVolume) / Math.log(1 + growth)));

  const plan = [];
  for (let week = 0; week <= weeks; week++) {
    const rawVolume = Math.round(startVolume * Math.pow(1 + growth, week));
    const volume = week >= weeks ? finalVolume : Math.min(rawVolume, finalVolume);
    const { sets, reps } = decompose(volume, targetReps);
    for (let i = 0; i < sessionsPerWeek; i++) {
      plan.push({ session: plan.length, sets, reps });
    }
  }
  return plan;
}

// Бинарный чек-ин тренировки (без числового ввода факта — см. project_pullups_goal_plan.md).
// completed=true → переход к следующей тренировке плана.
// completed=false → полный пересчёт плана: новая база current_form = объём последней
// успешно выполненной тренировки (а не запланированной), переведённый в «повторений
// в подходе при 3 подходах»; если провал на самой первой тренировке — current_form не меняется.
function advanceOrRecalc(habit, completed) {
  if (completed) {
    return { pullups_session_index: habit.pullups_session_index + 1, recalculated: false };
  }

  let currentForm = habit.current_form;
  const idx = habit.pullups_session_index;
  if (idx > 0) {
    const lastDone = habit.pullups_plan[idx - 1];
    currentForm = Math.round((lastDone.sets * lastDone.reps) / 3);
  }
  const pullups_plan = buildPullupsPlan(currentForm, habit.target_reps, habit.intensity);
  return { pullups_session_index: 0, recalculated: true, current_form: currentForm, pullups_plan };
}

module.exports = { INTENSITY, buildPullupsPlan, advanceOrRecalc };
