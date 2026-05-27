const cron = require('node-cron');
const sql = require('../db/client');
const { progressBar, fmt, dayLabel } = require('../utils');

function scheduleJobs(bot) {
  // 19:00 MSK — напоминание тем, кто не внёс шаги
  cron.schedule('0 19 * * *', () => sendReminders(bot), { timezone: 'Europe/Moscow' });

  // 20:00 MSK — вечерний дайджест по группам
  cron.schedule('0 20 * * *', () => sendDigest(bot), { timezone: 'Europe/Moscow' });

  // 21:00 MSK — финальные итоги для групп у которых сегодня дедлайн
  cron.schedule('0 21 * * *', () => sendFinalResults(bot), { timezone: 'Europe/Moscow' });
}

async function sendReminders(bot) {
  const members = await sql`
    SELECT DISTINCT u.tg_id, u.username
    FROM (
      SELECT creator_id AS user_id, g.group_id
      FROM goals g
      JOIN groups gr ON gr.id = g.group_id
      WHERE g.starts_at <= CURRENT_DATE AND g.deadline >= CURRENT_DATE
      UNION
      SELECT gm.user_id, g.group_id
      FROM goals g
      JOIN group_members gm ON gm.group_id = g.group_id
      WHERE g.starts_at <= CURRENT_DATE AND g.deadline >= CURRENT_DATE
    ) active
    JOIN users u ON u.id = active.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM steps s
      JOIN goals g ON g.id = s.goal_id
      WHERE s.user_id = active.user_id
        AND g.group_id = active.group_id
        AND s.recorded_at = CURRENT_DATE
    )
  `;

  for (const m of members) {
    try {
      await bot.api.sendMessage(
        m.tg_id,
        `⏰ Привет! Ещё не записал шаги за сегодня.\nОтправь /steps <число> — до дайджеста ещё час! 💪`
      );
    } catch (_) {}
  }
}

async function sendDigest(bot) {
  const activeGoals = await sql`
    SELECT g.*, gr.name AS group_name
    FROM goals g
    JOIN groups gr ON gr.id = g.group_id
    WHERE g.starts_at <= CURRENT_DATE AND g.deadline >= CURRENT_DATE
  `;

  for (const goal of activeGoals) {
    const members = await sql`
      SELECT u.id, u.tg_id, u.username,
        COALESCE(SUM(s.count), 0) AS total_steps,
        COALESCE(MAX(s.count) FILTER (WHERE s.recorded_at = CURRENT_DATE), 0) AS today_steps
      FROM (
        SELECT creator_id AS user_id FROM groups WHERE id = ${goal.group_id}
        UNION
        SELECT user_id FROM group_members WHERE group_id = ${goal.group_id}
      ) m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN steps s ON s.user_id = u.id AND s.goal_id = ${goal.id}
      GROUP BY u.id, u.tg_id, u.username
      ORDER BY today_steps DESC, total_steps DESC
    `;

    if (!members.length) continue;

    const medals = ['🥇', '🥈', '🥉'];
    const lines = members.map((m, i) => {
      const today = parseInt(m.today_steps);
      const percent = Math.round((today / goal.steps_per_day) * 100);
      const icon = today === 0 ? '😴' : (medals[i] ?? `${i + 1}.`);
      return `${icon} @${m.username} — ${fmt(today)} ${progressBar(percent)} ${percent}%`;
    });

    const msg =
      `📊 *Итоги дня — ${goal.group_name}*\n\n` +
      lines.join('\n') +
      `\n\n🎯 Цель: ${fmt(goal.steps_per_day)} шагов/день`;

    for (const member of members) {
      try {
        await bot.api.sendMessage(member.tg_id, msg, { parse_mode: 'Markdown' });
      } catch (_) {}
    }
  }
}

async function sendFinalResults(bot) {
  // Находим группы у которых дедлайн сегодня
  const finishedGoals = await sql`
    SELECT g.*, gr.name AS group_name, gr.creator_id
    FROM goals g
    JOIN groups gr ON gr.id = g.group_id
    WHERE g.deadline = CURRENT_DATE
  `;

  for (const goal of finishedGoals) {
    const members = await sql`
      SELECT u.id, u.tg_id, u.username,
        COALESCE(SUM(s.count), 0) AS total_steps,
        COUNT(DISTINCT s.recorded_at) AS days_active
      FROM (
        SELECT creator_id AS user_id FROM groups WHERE id = ${goal.group_id}
        UNION
        SELECT user_id FROM group_members WHERE group_id = ${goal.group_id}
      ) m
      JOIN users u ON u.id = m.user_id
      LEFT JOIN steps s ON s.user_id = u.id AND s.goal_id = ${goal.id}
      GROUP BY u.id, u.tg_id, u.username
      ORDER BY total_steps DESC
    `;

    if (!members.length) continue;

    const target = goal.steps_per_day * goal.period_days;
    const winners = members.filter(m => parseInt(m.total_steps) >= target);
    const losers  = members.filter(m => parseInt(m.total_steps) < target);
    const medals  = ['🥇', '🥈', '🥉'];

    const leaderLines = members.map((m, i) => {
      const total   = parseInt(m.total_steps);
      const percent = Math.round((total / target) * 100);
      const icon    = medals[i] ?? `${i + 1}.`;
      const done    = total >= target ? '✅' : '❌';
      return `${icon} ${done} @${m.username} — ${fmt(total)} шагов (${percent}%)`;
    });

    const msg =
      `🏁 *Челлендж «${goal.group_name}» завершён!*\n\n` +
      `📅 ${goal.period_days} ${dayLabel(goal.period_days)} · 🎯 ${fmt(goal.steps_per_day)} шагов/день\n` +
      `🏆 Цель: ${fmt(target)} шагов за весь период\n\n` +
      `*Итоги:*\n` +
      leaderLines.join('\n') +
      `\n\n` +
      (winners.length === members.length
        ? `🎉 Все участники выполнили цель! Отличная работа!`
        : winners.length === 0
          ? `😅 Никто не достиг цели. Попробуем ещё раз?`
          : `✅ Цель выполнили: ${winners.map(w => '@' + w.username).join(', ')}\n` +
            `❌ Не добрали: ${losers.map(l => '@' + l.username).join(', ')}`
      );

    // Находим создателя группы чтобы показать кнопку «Новый вызов»
    const [creator] = await sql`SELECT tg_id FROM users WHERE id = ${goal.creator_id}`;

    for (const member of members) {
      try {
        const isCreator = member.tg_id === creator.tg_id;
        await bot.api.sendMessage(member.tg_id, msg, {
          parse_mode: 'Markdown',
          ...(isCreator ? {
            reply_markup: {
              inline_keyboard: [[
                { text: '🚀 Новый вызов!', callback_data: `new_challenge_${goal.group_id}` },
                { text: '❌ Нет, спасибо', callback_data: 'no_new_challenge' },
              ]]
            }
          } : {})
        });
      } catch (_) {}
    }
  }
}

module.exports = { scheduleJobs };