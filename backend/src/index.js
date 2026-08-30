require('dotenv').config();
const express = require('express');
const runMigrations = require('./db/migrate');
const { scheduleHabitReminders } = require('./jobs/habit-reminders');
const { scheduleHabitNotificationTimes } = require('./jobs/habit-notification-times');
const sql = require('./db/client');
const { AVATARS_DIR, PUBLIC_DIR } = require('./config');
const authRouter = require('./api/auth');
const habitsRouter = require('./api/habits');
const pushRouter = require('./api/push');

// Telegram-бот @Step_Challenges_Bot (grammy, команды, вебхук, Mini App с Google Fit и
// вечерние дайджесты) удалён 2026-08-25 вместе с входом через Telegram — функциональность
// не поддерживается, её заменило мобильное приложение. Уведомления идут через FCM
// (jobs/habit-reminders, jobs/habit-notification-times), не через бота.

const app = express();
app.use(express.json());
app.use('/avatars', express.static(AVATARS_DIR));
// Страница-заглушка на корне: ставится последняя сборка приложения. Сам APK
// раздаёт nginx из public/download/ напрямую — 100+ МБ мимо Node.
app.use(express.static(PUBLIC_DIR));

// API v1
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/habits', habitsRouter);
app.use('/api/v1/push', pushRouter);

app.get('/health', (_, res) => res.json({ ok: true }));

// Экранирование для вставки пользовательских данных (имя цели, имя пригласившего) в HTML.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// GET /join/:code — страница-редирект инвайта в приложение: кнопка + авто-редирект на
// haba://join/<code>, fallback-текст если приложение не установлено. Показывает название
// цели и того, кто пригласил.
app.get('/join/:code', async (req, res) => {
  const code = String(req.params.code).replace(/[^A-Za-z0-9_-]/g, '');
  const deeplink = `haba://join/${code}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  let habitName = null;
  let inviterName = null;
  try {
    const [row] = await sql`
      SELECT h.name, u.first_name, u.username
      FROM habits h
      JOIN users u ON u.id = h.creator_id
      WHERE h.invite_code = ${code} AND h.closed_at IS NULL
    `;
    if (row) {
      habitName = row.name;
      inviterName = row.first_name || row.username;
    }
  } catch (e) {
    console.error('join page lookup error:', e);
  }

  const intro = habitName
    ? `Вас пригласили в групповую цель «${escapeHtml(habitName)}»`
    : 'Вас пригласили в групповую цель';
  const inviter = inviterName
    ? `<p>Приглашает: ${escapeHtml(inviterName)}</p>`
    : '';

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Приглашение в Тапа</title>
  <style>
    body { margin: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #fafafa; font-family: sans-serif; gap: 20px; }
    .btn { background: #6047ff; color: #fff; border: none; border-radius: 12px; padding: 16px 40px; font-size: 17px; font-weight: 700; cursor: pointer; text-decoration: none; }
    p { color: #757575; font-size: 15px; margin: 0; text-align: center; padding: 0 32px; line-height: 1.5; }
  </style>
</head>
<body>
  <p>${intro}</p>
  ${inviter}
  <a class="btn" id="btn" href="${deeplink}">Открыть Тапа</a>
  <p id="fallback" style="display:none">Если приложение не открылось — установите Тапа и откройте ссылку снова.</p>
  <script>
    var deeplink = ${JSON.stringify(deeplink)};
    document.getElementById('btn').onclick = function() { window.location.href = deeplink; };
    setTimeout(function() { window.location.href = deeplink; }, 500);
    setTimeout(function() { document.getElementById('fallback').style.display = 'block'; }, 2000);
  </script>
</body>
</html>`);
});

async function start() {
  await runMigrations();
  scheduleHabitReminders();
  scheduleHabitNotificationTimes();
  app.listen(process.env.PORT, () => {
    console.log('Сервер запущен на порту ' + process.env.PORT);
  });
}

start();
