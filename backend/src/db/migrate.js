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

  // VK auth: make tg_id nullable, add vk_id with partial unique index
  await sql`ALTER TABLE users ALTER COLUMN tg_id DROP NOT NULL`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id TEXT`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_vk_id_unique
      ON users (vk_id)
      WHERE vk_id IS NOT NULL
  `;

  // Profile fields from VK/Telegram
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;

  // Способ последнего входа ('telegram'|'vk') — для иконки сервиса на главном экране
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_provider TEXT`;

  const migrateHabits = require('./migrate_habits');
  await migrateHabits();

  const migratePush = require('./migrate_push');
  await migratePush();

  const migratePullups = require('./migrate_pullups');
  await migratePullups();

  const migrateCustomHabits = require('./migrate_custom');
  await migrateCustomHabits();

  console.log('Миграции применены');
}

module.exports = runMigrations;
