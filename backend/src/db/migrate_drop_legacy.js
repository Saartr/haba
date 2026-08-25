const sql = require('./client');

// Сносит остатки Telegram-бота @Step_Challenges_Bot (удалён 2026-08-25 вместе с входом
// через Telegram): его таблицы и колонку users.tg_id. На момент удаления во всех таблицах
// было 0 строк — функциональность заменило мобильное приложение.
//
// Порядок важен: внешние ключи здесь без ON DELETE CASCADE, поэтому таблицы удаляются
// снизу вверх — сначала ссылающиеся, потом те, на кого ссылаются. CASCADE не используем
// намеренно, чтобы случайно не утащить что-то ещё.
async function runDropLegacyMigration() {
  await sql`DROP TABLE IF EXISTS steps`;         // → goals, users
  await sql`DROP TABLE IF EXISTS auth_codes`;    // → users
  await sql`DROP TABLE IF EXISTS goals`;         // → groups
  await sql`DROP TABLE IF EXISTS group_members`; // → groups, users
  await sql`DROP TABLE IF EXISTS groups`;        // → users

  await sql`ALTER TABLE users DROP COLUMN IF EXISTS tg_id`;

  console.log('Legacy bot migration complete (tables + users.tg_id dropped)');
}

module.exports = runDropLegacyMigration;
