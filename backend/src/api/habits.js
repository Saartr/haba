const { Router } = require('express');
const crypto = require('crypto');
const sql = require('../db/client');
const { requireAuth } = require('./auth');

const router = Router();
router.use(requireAuth);

function makeInviteCode() {
  return crypto.randomBytes(6).toString('base64url');
}

function weekRange(date) {
  const d = new Date(date);
  const day = d.getUTCDay() || 7;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() - day + 1);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  return { mon, sun };
}

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function calcStreaks(rows) {
  // rows: [{date}] sorted DESC
  let current = 0, max = 0, streak = 0;
  let prev = null;
  for (const row of rows) {
    const d = new Date(row.date);
    d.setUTCHours(0, 0, 0, 0);
    if (prev === null) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const diff = Math.round((today - d) / 86400000);
      if (diff > 1) break;
      streak = 1;
    } else {
      const diff = Math.round((prev - d) / 86400000);
      if (diff === 1) streak++;
      else break;
    }
    prev = d;
    current = streak;
  }
  // max streak — forward pass
  let cur = 0;
  let prevD = null;
  for (const row of [...rows].reverse()) {
    const d = new Date(row.date);
    d.setUTCHours(0, 0, 0, 0);
    if (prevD === null) { cur = 1; }
    else {
      const diff = Math.round((d - prevD) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > max) max = cur;
    prevD = d;
  }
  return { current, max };
}

// POST /api/v1/habits — создать привычку
router.post('/', async (req, res) => {
  const { name, category = 'steps', type = 'group', goal_value, goal_unit, notifications = true } = req.body;
  if (!name) return res.status(400).json({ message: 'name обязателен' });
  const invite_code = makeInviteCode();
  try {
    const [habit] = await sql`
      INSERT INTO habits (creator_id, name, category, type, goal_value, goal_unit, notifications, invite_code)
      VALUES (${req.userId}, ${name}, ${category}, ${type}, ${goal_value ?? null}, ${goal_unit ?? null}, ${notifications}, ${invite_code})
      RETURNING *
    `;
    await sql`INSERT INTO habit_members (habit_id, user_id) VALUES (${habit.id}, ${req.userId})`;
    res.status(201).json({ ...habit, is_creator: true });
  } catch (e) {
    console.error('create habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/v1/habits — мои привычки
router.get('/', async (req, res) => {
  try {
    const habits = await sql`
      SELECT h.*, (h.creator_id = ${req.userId}) AS is_creator
      FROM habits h
      JOIN habit_members hm ON hm.habit_id = h.id
      WHERE hm.user_id = ${req.userId} AND h.closed_at IS NULL
      ORDER BY h.created_at DESC
    `;
    res.json(habits);
  } catch (e) {
    console.error('list habits error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/v1/habits/:id — карточка привычки
router.get('/:id', async (req, res) => {
  const habitId = parseInt(req.params.id);
  try {
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });

    const [habit] = await sql`
      SELECT *, (creator_id = ${req.userId}) AS is_creator FROM habits WHERE id = ${habitId}
    `;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });

    const members = await sql`
      SELECT u.id, u.username, u.first_name, u.last_name, u.avatar_url,
             (u.id = ${req.userId}) AS is_self,
             (u.id = ${habit.creator_id}) AS is_creator
      FROM habit_members hm
      JOIN users u ON u.id = hm.user_id
      WHERE hm.habit_id = ${habitId}
      ORDER BY hm.joined_at ASC
    `;

    const { mon, sun } = weekRange(new Date());
    const week_logs = await sql`
      SELECT user_id, date, value FROM habit_logs
      WHERE habit_id = ${habitId}
        AND date BETWEEN ${toDateStr(mon)} AND ${toDateStr(sun)}
    `;

    const minValue = habit.goal_value ?? 1;
    const streakRows = await sql`
      SELECT date FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${req.userId} AND value >= ${minValue}
      ORDER BY date DESC
    `;
    const streak = calcStreaks(streakRows);

    res.json({ ...habit, members, week_logs, streak });
  } catch (e) {
    console.error('get habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/v1/habits/:id/logs?from=2026-05-19&to=2026-05-25 — логи текущего юзера за период
router.get('/:id/logs', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { from, to } = req.query;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ message: 'Параметры from и to обязательны (YYYY-MM-DD)' });
  }
  try {
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });

    const logs = await sql`
      SELECT user_id, date, value, source FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${req.userId}
        AND date BETWEEN ${from} AND ${to}
    `;
    res.json(logs);
  } catch (e) {
    console.error('get habit logs error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/habits/join — вступить по invite_code
router.post('/join', async (req, res) => {
  const { invite_code } = req.body;
  if (!invite_code) return res.status(400).json({ message: 'invite_code обязателен' });
  try {
    const [habit] = await sql`
      SELECT * FROM habits WHERE invite_code = ${invite_code} AND closed_at IS NULL
    `;
    if (!habit) return res.status(404).json({ message: 'Цель не найдена' });
    await sql`
      INSERT INTO habit_members (habit_id, user_id) VALUES (${habit.id}, ${req.userId})
      ON CONFLICT DO NOTHING
    `;
    res.json({ ...habit, is_creator: habit.creator_id === req.userId });
  } catch (e) {
    console.error('join habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/habits/:id/logs — внести лог (ручной ввод, безусловный update)
router.post('/:id/logs', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { value, date } = req.body;
  if (value === undefined) return res.status(400).json({ message: 'value обязателен' });
  try {
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });
    const logDate = date ?? toDateStr(new Date());
    const [log] = await sql`
      INSERT INTO habit_logs (habit_id, user_id, date, value, source)
      VALUES (${habitId}, ${req.userId}, ${logDate}, ${value}, 'manual')
      ON CONFLICT (habit_id, user_id, date) DO UPDATE
        SET value = ${value}, source = 'manual'
      RETURNING *
    `;
    res.json(log);
  } catch (e) {
    console.error('log habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/habits/:id/logs/sync — синк из health-трекера (GREATEST, не затирает ручной ввод)
router.post('/:id/logs/sync', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { value, date, source } = req.body;
  if (value === undefined || typeof value !== 'number' || value < 0 || value > 200000) {
    return res.status(400).json({ message: 'value обязателен (0..200000)' });
  }
  if (source !== 'health_connect' && source !== 'healthkit') {
    return res.status(400).json({ message: 'source должен быть health_connect или healthkit' });
  }
  try {
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });
    const logDate = date ?? toDateStr(new Date());
    const [log] = await sql`
      INSERT INTO habit_logs (habit_id, user_id, date, value, source)
      VALUES (${habitId}, ${req.userId}, ${logDate}, ${value}, ${source})
      ON CONFLICT (habit_id, user_id, date) DO UPDATE
        SET value = GREATEST(habit_logs.value, EXCLUDED.value),
            source = CASE WHEN habit_logs.value >= EXCLUDED.value
                          THEN habit_logs.source ELSE EXCLUDED.source END
      RETURNING *
    `;
    if (source === 'health_connect' || source === 'healthkit') {
      await sql`
        UPDATE users SET health_connected_at = COALESCE(health_connected_at, now())
        WHERE id = ${req.userId}
      `;
    }
    res.json(log);
  } catch (e) {
    console.error('sync habit log error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/habits/:id/members/:userId — исключить участника
router.delete('/:id/members/:userId', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const targetId = parseInt(req.params.userId);
  try {
    const [habit] = await sql`SELECT creator_id FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    if (habit.creator_id !== req.userId) return res.status(403).json({ message: 'Только создатель' });
    if (targetId === req.userId) return res.status(400).json({ message: 'Нельзя исключить себя' });
    await sql`DELETE FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${targetId}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('exclude member error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/habits/:id/transfer — передать права
router.post('/:id/transfer', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ message: 'user_id обязателен' });
  try {
    const [habit] = await sql`SELECT creator_id FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    if (habit.creator_id !== req.userId) return res.status(403).json({ message: 'Только создатель' });
    const [member] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${user_id}
    `;
    if (!member) return res.status(400).json({ message: 'Пользователь не в группе' });
    await sql`UPDATE habits SET creator_id = ${user_id} WHERE id = ${habitId}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('transfer error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/habits/:id — закрыть привычку (soft-close via closed_at)
router.delete('/:id', async (req, res) => {
  const habitId = parseInt(req.params.id);
  try {
    const [habit] = await sql`SELECT creator_id FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    if (habit.creator_id !== req.userId) return res.status(403).json({ message: 'Только создатель' });
    await sql`UPDATE habits SET closed_at = now() WHERE id = ${habitId}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('close habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
