const sql = require('./client');

async function runMigrations() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      tg_id      BIGINT UNIQUE NOT NULL,
      username   TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      invite_code TEXT UNIQUE NOT NULL,
      creator_id  INT REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS group_members (
      user_id   INT REFERENCES users(id),
      group_id  INT REFERENCES groups(id),
      joined_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (user_id, group_id)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS goals (
      id            SERIAL PRIMARY KEY,
      group_id      INT REFERENCES groups(id),
      steps_per_day INT NOT NULL,
      period_days   INT NOT NULL,
      starts_at     DATE NOT NULL,
      deadline      DATE NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS steps (
      id          SERIAL PRIMARY KEY,
      user_id     INT REFERENCES users(id),
      goal_id     INT REFERENCES goals(id),
      count       INT NOT NULL,
      recorded_at DATE NOT NULL,
      UNIQUE (user_id, goal_id, recorded_at)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS auth_codes (
      user_id    INT PRIMARY KEY REFERENCES users(id),
      code       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      attempts   INT DEFAULT 0
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INT REFERENCES users(id),
      token      TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `;

  // Новые колонки профиля — добавляем если не существуют
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name  TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT`;

  const migrateHabits = require('./migrate_habits');
  await migrateHabits();
  console.log('Миграции применены');
}

module.exports = runMigrations;
