const sql = require('./client');

async function runYandexMigration() {
  // Яндекс ID как способ входа. Как и vk_id — partial unique index, а не UNIQUE-колонка:
  // у пользователей без Яндекса здесь NULL, и обычный UNIQUE запретил бы второй такой NULL
  // не во всех СУБД одинаково; partial index явно исключает NULL из проверки.
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS yandex_id TEXT
  `;

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS users_yandex_id_unique
      ON users (yandex_id)
      WHERE yandex_id IS NOT NULL
  `;

  // default_avatar_id из профиля Яндекса. Храним, потому что URL аватара собирается из него,
  // а сам id приходит только вместе с живым OAuth-токеном — без него POST /auth/refresh-avatar
  // не смог бы перекачать фото Яндекс-аккаунту (у VK для этого есть сервисный токен).
  await sql`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS yandex_avatar_id TEXT
  `;

  console.log('Yandex migration complete');
}

module.exports = runYandexMigration;
