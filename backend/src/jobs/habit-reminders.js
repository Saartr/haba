const cron = require('node-cron');
const sql = require('../db/client');
const { sendToUser } = require('../push/fcm');

// Ежедневное напоминание (push) о невыполненных целях.
// Универсально: и групповые, и сольные привычки. Один пуш на пользователя.

function scheduleHabitReminders() {
  // 19:00 MSK — напоминание тем, кто сегодня ещё ничего не отметил
  cron.schedule('0 19 * * *', () => {
    sendHabitReminders().catch(e => console.error('[reminders] job error:', e));
  }, { timezone: 'Europe/Moscow' });
}

// Выбираем пользователей, у кого есть хотя бы одна активная привычка
// (closed_at IS NULL, notifications=true) без лога за сегодня — и шлём один пуш.
async function sendHabitReminders() {
  const users = await sql`
    SELECT DISTINCT hm.user_id
    FROM habit_members hm
    JOIN habits h ON h.id = hm.habit_id
    WHERE h.closed_at IS NULL
      AND h.notifications = true
      AND NOT EXISTS (
        SELECT 1 FROM habit_logs hl
        WHERE hl.habit_id = hm.habit_id
          AND hl.user_id = hm.user_id
          AND hl.date = CURRENT_DATE
      )
  `;

  for (const u of users) {
    try {
      await sendToUser(u.user_id, {
        title: 'Тапа',
        body: 'Не забудь отметить свои цели за сегодня 🎯',
        data: { type: 'reminder' },
      });
    } catch (e) {
      console.error('[reminders] send error for user', u.user_id, e.message);
    }
  }

  console.log(`[reminders] отправлено напоминаний: ${users.length}`);
}

module.exports = { scheduleHabitReminders, sendHabitReminders };
