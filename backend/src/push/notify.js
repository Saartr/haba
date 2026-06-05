const sql = require('../db/client');
const { sendToUser } = require('./fcm');

// Высокоуровневые триггеры push-уведомлений. Текст и адресацию держим здесь,
// fcm.js отвечает только за транспорт.

function displayName(u) {
  return (u && (u.first_name || u.username)) || 'Кто-то';
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Кто-то вступил в групповую цель по инвайту → уведомляем создателя.
async function notifyHabitJoin(habit, joinerId) {
  if (!habit.notifications) return;
  if (habit.creator_id === joinerId) return;
  const [joiner] = await sql`SELECT first_name, username FROM users WHERE id = ${joinerId}`;
  await sendToUser(habit.creator_id, {
    title: habit.name,
    body: `${displayName(joiner)} присоединился к цели`,
    data: { type: 'join', habitId: habit.id },
  });
}

// Участник выполнил дневную цель → уведомляем остальных участников.
async function notifyGoalReached(habit, achieverId) {
  if (!habit.notifications) return;
  const [achiever] = await sql`SELECT first_name, username FROM users WHERE id = ${achieverId}`;
  const members = await sql`
    SELECT user_id FROM habit_members
    WHERE habit_id = ${habit.id} AND user_id != ${achieverId}
  `;
  const name = displayName(achiever);
  await Promise.all(
    members.map(m =>
      sendToUser(m.user_id, {
        title: habit.name,
        body: `${name} выполнил цель на сегодня 🎯`,
        data: { type: 'goal', habitId: habit.id },
      }),
    ),
  );
}

// Вызывается после записи лога. Шлёт уведомление только в момент пересечения
// порога цели сегодня (prev < goal <= new), чтобы не спамить при каждом апдейте.
async function notifyGoalIfReached({ habitId, userId, prevValue, newValue, date }) {
  if (date !== today()) return;
  const nv = Number(newValue);
  if (!Number.isFinite(nv)) return;
  const [habit] = await sql`
    SELECT id, name, goal_value, notifications, creator_id
    FROM habits WHERE id = ${habitId} AND closed_at IS NULL
  `;
  if (!habit || habit.goal_value == null) return;
  if (nv < habit.goal_value) return;
  if (prevValue != null && Number(prevValue) >= habit.goal_value) return; // уже достигал сегодня
  await notifyGoalReached(habit, userId);
}

module.exports = { notifyHabitJoin, notifyGoalIfReached };
