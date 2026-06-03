require('dotenv').config();
const express = require('express');
const path = require('path');
const { Bot } = require('grammy');
const runMigrations = require('./db/migrate');
const setupCommands = require('./handlers/commands');
const { scheduleJobs } = require('./jobs/digest');
const sql = require('./db/client');
const authRouter = require('./api/auth');
const habitsRouter = require('./api/habits');

const bot = new Bot(process.env.TELEGRAM_TOKEN);
setupCommands(bot);

bot.catch((err) => {
  console.error('Ошибка бота:', err);
});

const app = express();
app.use(express.json());
app.use('/avatars', express.static('/var/www/haba/backend/public/avatars'));

// Передаём bot в req для роутеров
app.use((req, res, next) => {
  req.bot = bot;
  next();
});

// API v1
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/habits', habitsRouter);

app.post('/webhook', async (req, res) => {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }
  res.sendStatus(200);
  try {
    await bot.handleUpdate(req.body);
  } catch (err) {
    console.error('Ошибка обработки апдейта:', err);
  }
});

app.get('/health', (_, res) => res.json({ ok: true }));

app.get('/miniapp/telegram-web-app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'miniapp/telegram-web-app.js'));
});

app.get('/miniapp/app.js', (req, res) => {
  const fs = require('fs');
  const filePath = path.join(__dirname, 'miniapp/app.js');
  try {
    let js = fs.readFileSync(filePath, 'utf8');
    js = js.replace('__GOOGLE_CLIENT_ID__', process.env.GOOGLE_CLIENT_ID || '');
    res.setHeader('Content-Type', 'application/javascript');
    res.send(js);
  } catch (e) {
    console.error('app.js read error:', e.message);
    res.status(500).send('// error: ' + e.message);
  }
});

app.get('/miniapp', (req, res) => {
  res.sendFile(path.join(__dirname, 'miniapp/index.html'));
});

// GET /join/:code — страница-редирект инвайта в приложение.
// По образцу telegram-callback: кнопка + авто-редирект на haba://join/<code>.
// fallback-текст если приложение не установлено.
app.get('/join/:code', (req, res) => {
  const code = String(req.params.code).replace(/[^A-Za-z0-9_-]/g, '');
  const deeplink = `haba://join/${code}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
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
  <p>Вас пригласили в групповую цель</p>
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

app.get('/miniapp/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code) return res.send('<script>window.close()</script>');

  try {
    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: 'https://bot.mihmih.pro/miniapp/callback',
        grant_type: 'authorization_code',
      }),
    });
    const tokenData = await tokenResp.json();
    if (!tokenData.access_token) throw new Error('No token');

    const now = Date.now();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const fitResp = await fetch(
      'https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate',
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + tokenData.access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: 'com.google.step_count.delta' }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: startOfDay.getTime(),
          endTimeMillis: now,
        }),
      }
    );
    const fitData = await fitResp.json();
    const steps = fitData.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal || 0;

    const tgId = parseInt(state);
    if (tgId) {
      const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;
      if (user) {
        const [goal] = await sql`
          SELECT g.id FROM goals g
          JOIN groups gr ON gr.id = g.group_id
          WHERE (gr.creator_id = ${user.id} OR gr.id IN (
            SELECT group_id FROM group_members WHERE user_id = ${user.id}
          ))
          AND g.starts_at <= CURRENT_DATE AND g.deadline >= CURRENT_DATE
          ORDER BY g.id DESC LIMIT 1
        `;
        if (goal) {
          await sql`
            INSERT INTO steps (user_id, goal_id, count, recorded_at)
            VALUES (${user.id}, ${goal.id}, ${steps}, CURRENT_DATE)
            ON CONFLICT (user_id, goal_id, recorded_at)
            DO UPDATE SET count = ${steps}
          `;
          await bot.api.sendMessage(tgId,
            '*Google Fit:* записано *' + steps.toLocaleString('ru-RU') + '* шагов за сегодня!',
            { parse_mode: 'Markdown' }
          );
        }
      }
    }

    res.send('ok');
  } catch (e) {
    console.error('Google OAuth error:', e);
    res.status(500).send('error');
  }
});

app.post('/miniapp/steps', async (req, res) => {
  const { initData, steps } = req.body;
  if (!initData || steps === undefined) return res.json({ ok: false, error: 'bad request' });

  try {
    const params = new URLSearchParams(initData);
    const userStr = params.get('user');
    if (!userStr) return res.json({ ok: false, error: 'no user' });

    const tgUser = JSON.parse(userStr);
    const tgId = tgUser.id;

    const [user] = await sql`SELECT id FROM users WHERE tg_id = ${tgId}`;
    if (!user) return res.json({ ok: false, error: 'user not found' });

    const [goal] = await sql`
      SELECT g.id FROM goals g
      JOIN groups gr ON gr.id = g.group_id
      WHERE (gr.creator_id = ${user.id} OR gr.id IN (
        SELECT group_id FROM group_members WHERE user_id = ${user.id}
      ))
      AND g.starts_at <= CURRENT_DATE AND g.deadline >= CURRENT_DATE
      ORDER BY g.id DESC LIMIT 1
    `;
    if (!goal) return res.json({ ok: false, error: 'no active goal' });

    await sql`
      INSERT INTO steps (user_id, goal_id, count, recorded_at)
      VALUES (${user.id}, ${goal.id}, ${steps}, CURRENT_DATE)
      ON CONFLICT (user_id, goal_id, recorded_at)
      DO UPDATE SET count = ${steps}
    `;

    res.json({ ok: true });
  } catch (e) {
    console.error('Mini App steps error:', e);
    res.json({ ok: false, error: 'server error' });
  }
});

async function start() {
  await bot.init();
  await runMigrations();
  await bot.api.setMyCommands([
    { command: 'steps',   description: 'Записать шаги за сегодня' },
    { command: 'status',  description: 'Мой прогресс и таблица лидеров' },
    { command: 'members', description: 'Участники группы' },
    { command: 'goal',    description: 'Задать цель челленджа (создатель)' },
    { command: 'deletegroup', description: 'Удалить свою группу' },
    { command: 'help',    description: 'Список команд' },
    { command: 'start',   description: 'Главное меню' },
    { command: 'app',     description: 'Открыть Mini App для записи шагов' },
  ]);
  scheduleJobs(bot);
  app.listen(process.env.PORT, () => {
    console.log('Сервер запущен на порту ' + process.env.PORT);
  });
}

start();
