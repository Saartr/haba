const sql = require('./client');

async function runVkMigration() {
  // Делаем tg_id необязательным (nullable) чтобы VK-пользователи могли существовать без tg_id
  await sql`
    ALTER TABLE users
      ALTER COLUMN tg_id DROP NOT NULL
  `;

  // Добавляем vk_id колонку с уникальным индексом
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS vk_id TEXT
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_vk_id_unique
      ON users (vk_id)
      WHERE vk_id IS NOT NULL
  `;

  // Добавляем недостающие колонки (first_name, last_name) если их ещё нет
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS first_name TEXT
  `;
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS last_name TEXT
  `;
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_url TEXT
  `;

  console.log('VK migration complete');
}

module.exports = runVkMigration;
