const sql = require('./client');

// Токены устройств для push-уведомлений (FCM).
// Один юзер = несколько устройств → отдельная таблица, а не колонка в users.
// token UNIQUE: одно устройство = одна строка; при переустановке/смене аккаунта
// перепривязываем строку к новому user_id (ON CONFLICT (token) в push.js).
async function migratePush() {
  await sql`
    CREATE TABLE IF NOT EXISTS push_tokens (
      id         SERIAL PRIMARY KEY,
      user_id    INT REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT UNIQUE NOT NULL,
      platform   TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS push_tokens_user ON push_tokens (user_id)`;
}

module.exports = migratePush;
