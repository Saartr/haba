const sql = require('./client');

async function runMigrations() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id         SERIAL PRIMARY KEY,
      username   TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
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

  // VK auth: vk_id с partial unique index
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS vk_id TEXT`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_vk_id_unique
      ON users (vk_id)
      WHERE vk_id IS NOT NULL
  `;

  // Поля профиля от провайдеров входа (VK/Яндекс)
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT`;

  // Способ последнего входа ('yandex'|'vk') — для иконки сервиса на главном экране
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_provider TEXT`;

  const migrateYandex = require('./migrate_yandex');
  await migrateYandex();

  // Сносит tg_id и таблицы удалённого бота шагов. Строго после остальных миграций:
  // они ещё могут ссылаться на эти объекты.
  const migrateDropLegacy = require('./migrate_drop_legacy');
  await migrateDropLegacy();

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
