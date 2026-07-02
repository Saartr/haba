const cron = require('node-cron');
const sql = require('../db/client');
const { sendToUser } = require('../push/fcm');

// Каждый час в :00 МСК — напоминания для привычек с конкретным временем выполнения.
// Работает только для ежедневных привычек (periodicity='daily') с notification_times.
// Шлёт push только тем, кто ещё не залогировался по данной привычке сегодня.

function scheduleHabitNotificationTimes() {
  cron.schedule('0 * * * *', () => {
    sendNotificationTimeReminders().catch(e => console.error('[notif-times] job error:', e));
  }, { timezone: 'Europe/Moscow' });
}

async function sendNotificationTimeReminders() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const time = `${String(now.getHours()).padStart(2, '0')}:00`;

  const rows = await sql`
    SELECT hm.user_id, h.id AS habit_id, h.name
    FROM habits h
    JOIN habit_members hm ON hm.habit_id = h.id
    WHERE h.closed_at IS NULL
      AND h.notifications = true
      AND h.notification_times IS NOT NULL
      AND ${time} = ANY(h.notification_times)
      AND NOT EXISTS (
        SELECT 1 FROM habit_logs hl
        WHERE hl.habit_id = h.id
          AND hl.user_id = hm.user_id
          AND hl.date = CURRENT_DATE
      )
  `;

  for (const row of rows) {
    try {
      await sendToUser(row.user_id, {
        title: 'Тапа',
        body: `Не забудь отметить цель «${row.name}» 🎯`,
        data: { type: 'reminder', habit_id: String(row.habit_id) },
      });
    } catch (e) {
      console.error('[notif-times] send error for user', row.user_id, e.message);
    }
  }

  if (rows.length) {
    console.log(`[notif-times] ${time} — отправлено напоминаний: ${rows.length}`);
  }
}

module.exports = { scheduleHabitNotificationTimes };
