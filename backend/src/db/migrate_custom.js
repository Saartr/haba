const sql = require('./client');

async function migrateCustomHabits() {
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS checkin_type TEXT NOT NULL DEFAULT 'boolean'`;
  // 'boolean' | 'count' | 'progression'

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS unit_preset TEXT`;
  // 'minute'|'hour'|'step'|'calorie'|'km'|'m'|'glass'|'litre'|'page'|'rep'|'custom'
  // goal_unit reused for the label string ('Минута', 'стаканы' и т.п.)

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS progression_start INT`;
  // Начальное значение для типа progression

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS periodicity TEXT NOT NULL DEFAULT 'daily'`;
  // 'daily' | 'weekdays' | 'n_per_week' | 'n_per_month'

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS times_per_day INT NOT NULL DEFAULT 1`;
  // Сколько раз в день (только для periodicity = 'daily')

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS notification_times TEXT[]`;
  // Времена уведомлений ['12:00', '18:00'] — сохраняем, включим когда пуши будут готовы

  // training_days (SMALLINT[]) уже есть — reuse для periodicity = 'weekdays'

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS times_per_week INT`;
  // Цель раз в неделю (для n_per_week)

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS times_per_month INT`;
  // Цель раз в месяц (для n_per_month + Суммарно)

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS month_count_type TEXT`;
  // 'summary' | 'dates' (для n_per_month)

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS month_dates SMALLINT[]`;
  // Числа месяца [1, 15]; 32 = последний день месяца

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS duration_type TEXT NOT NULL DEFAULT 'unlimited'`;
  // 'unlimited' | 'period' | 'until_goal'

  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS period_start DATE`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS period_end DATE`;

  console.log('Custom habit migrations applied');
}

module.exports = migrateCustomHabits;
