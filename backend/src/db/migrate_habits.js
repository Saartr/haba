const sql = require('./client');

async function migrateHabits() {
  await sql`
    CREATE TABLE IF NOT EXISTS habits (
      id            SERIAL PRIMARY KEY,
      creator_id    INT NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      category      TEXT NOT NULL DEFAULT 'steps',
      type          TEXT NOT NULL DEFAULT 'group' CHECK (type IN ('solo', 'group')),
      goal_value    INT,
      goal_unit     TEXT,
      notifications BOOLEAN NOT NULL DEFAULT true,
      invite_code   TEXT UNIQUE NOT NULL,
      closed_at     TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS habit_members (
      habit_id  INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      user_id   INT NOT NULL REFERENCES users(id),
      joined_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (habit_id, user_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS habit_logs (
      id        SERIAL PRIMARY KEY,
      habit_id  INT NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
      user_id   INT NOT NULL REFERENCES users(id),
      date      DATE NOT NULL DEFAULT CURRENT_DATE,
      value     INT,
      UNIQUE (habit_id, user_id, date)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS habit_logs_habit_date ON habit_logs(habit_id, date)`;
  await sql`CREATE INDEX IF NOT EXISTS habit_members_user ON habit_members(user_id)`;
  console.log('Habit migrations applied');
}

module.exports = migrateHabits;
