const sql = require('./client');

// Цель «Подтягивания» — прогрессивная программа (план растёт по неделям к target_reps),
// в отличие от статичных целей (шаги/курение). См. project_pullups_goal_plan.md.
async function migratePullups() {
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS current_form INT`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS target_reps INT`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS intensity TEXT`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS training_days SMALLINT[]`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS pullups_plan JSONB`;
  await sql`ALTER TABLE habits ADD COLUMN IF NOT EXISTS pullups_session_index INT NOT NULL DEFAULT 0`;

  console.log('Pullups migrations applied');
}

module.exports = migratePullups;
