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

  // Группируем по пользователю — если на этот час у него несколько целей,
  // шлём одну объединённую нотификацию вместо пуша на каждую цель отдельно.
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row);
  }

  let sent = 0;
  for (const [userId, userRows] of byUser) {
    try {
      if (userRows.length === 1) {
        await sendToUser(userId, {
          title: 'Тапа',
          body: `Не забудь отметить цель «${userRows[0].name}» 🎯`,
          data: { type: 'reminder', habitId: String(userRows[0].habit_id) },
        });
      } else {
        // Несколько целей в одно время — нет одного habitId для перехода,
        // тап просто открывает приложение (как у ежедневного пуша в 19:00).
        await sendToUser(userId, {
          title: 'Тапа',
          body: combinedReminderBody(userRows.map(r => r.name)),
          data: { type: 'reminder' },
        });
      }
      sent++;
    } catch (e) {
      console.error('[notif-times] send error for user', userId, e.message);
    }
  }

  if (sent) {
    console.log(`[notif-times] ${time} — отправлено напоминаний: ${sent} (целей: ${rows.length})`);
  }
}

// «Не забудь отметить «A» и «B» 🎯» (до 3 целей — перечисляем имена),
// «Не забудь отметить 4 цели за сегодня 🎯» (4+ — длинный список плохо читается в пуше).
function combinedReminderBody(names) {
  if (names.length <= 3) {
    const quoted = names.map(n => `«${n}»`);
    const last = quoted.pop();
    return `Не забудь отметить ${quoted.length ? quoted.join(', ') + ' и ' : ''}${last} 🎯`;
  }
  return `Не забудь отметить ${names.length} ${pluralGoals(names.length)} за сегодня 🎯`;
}

function pluralGoals(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'целей';
  if (mod10 === 1) return 'цель';
  if (mod10 >= 2 && mod10 <= 4) return 'цели';
  return 'целей';
}

module.exports = { scheduleHabitNotificationTimes };
