const { Router } = require('express');
const crypto = require('crypto');
const sql = require('../db/client');
const { requireAuth } = require('./auth');
const { notifyHabitJoin, notifyGoalIfReached } = require('../push/notify');
const { buildPullupsPlan, advanceOrRecalc } = require('../pullups');

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
  // rows: [{date}] отфильтрованы по value >= goal_value, sorted DESC (новые → старые)
  if (rows.length === 0) return { current: 0, max: 0 };

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // max: проход вперёд по всей истории — самая длинная непрерывная серия
  let max = 0, cur = 0;
  let prevD = null;
  for (const row of [...rows].reverse()) {
    const d = new Date(row.date);
    d.setUTCHours(0, 0, 0, 0);
    if (prevD === null) {
      cur = 1;
    } else {
      const diff = Math.round((d - prevD) / 86400000);
      cur = diff === 1 ? cur + 1 : 1;
    }
    if (cur > max) max = cur;
    prevD = d;
  }

  // current: считаем от самой последней записи назад пока дни идут подряд.
  // Если последняя запись была позавчера или раньше — стрик = 0
  // (сегодня не выполнено и вчера не выполнено — серия прервана).
  // Если вчера или сегодня — считаем подряд идущие дни.
  const lastDate = new Date(rows[0].date);
  lastDate.setUTCHours(0, 0, 0, 0);
  const diffFromToday = Math.round((today - lastDate) / 86400000);
  if (diffFromToday > 1) return { current: 0, max };

  let current = 1;
  for (let i = 1; i < rows.length; i++) {
    const prev = new Date(rows[i - 1].date);
    const curr = new Date(rows[i].date);
    prev.setUTCHours(0, 0, 0, 0);
    curr.setUTCHours(0, 0, 0, 0);
    const diff = Math.round((prev - curr) / 86400000);
    if (diff === 1) current++;
    else break;
  }

  return { current, max };
}

// POST /api/v1/habits — создать привычку
router.post('/', async (req, res) => {
  const {
    name, description, category = 'steps', type = 'group', goal_value, goal_unit, notifications = true,
    current_form, target_reps, intensity, training_days,
    // Кастомные поля (новый флоу)
    checkin_type, unit_preset, progression_start,
    periodicity, times_per_day, notification_times, weekdays,
    times_per_week, times_per_month, month_count_type, month_dates,
    duration_type, period_start, period_end,
  } = req.body;
  if (!name) return res.status(400).json({ message: 'name обязателен' });

  let pullups_plan = null;
  if (category === 'pullups') {
    if (!current_form || !target_reps || !intensity || !Array.isArray(training_days)) {
      return res.status(400).json({ message: 'Для подтягиваний нужны current_form, target_reps, intensity, training_days' });
    }
    pullups_plan = buildPullupsPlan(current_form, target_reps, intensity);
  }

  const invite_code = makeInviteCode();
  try {
    const [habit] = await sql`
      INSERT INTO habits (
        creator_id, name, description, category, type, goal_value, goal_unit, notifications, invite_code,
        current_form, target_reps, intensity, training_days, pullups_plan,
        checkin_type, unit_preset, progression_start,
        periodicity, times_per_day, notification_times,
        times_per_week, times_per_month, month_count_type, month_dates,
        duration_type, period_start, period_end
      )
      VALUES (
        ${req.userId}, ${name}, ${description ?? null}, ${category}, ${type}, ${goal_value ?? null}, ${goal_unit ?? null}, ${notifications}, ${invite_code},
        ${current_form ?? null}, ${target_reps ?? null}, ${intensity ?? null}, ${training_days ?? null}, ${pullups_plan ? sql.json(pullups_plan) : null},
        ${checkin_type ?? 'boolean'}, ${unit_preset ?? null}, ${progression_start ?? null},
        ${periodicity ?? 'daily'}, ${times_per_day ?? 1}, ${notification_times ?? null},
        ${times_per_week ?? null}, ${times_per_month ?? null}, ${month_count_type ?? null}, ${month_dates ?? null},
        ${duration_type ?? 'unlimited'}, ${period_start ?? null}, ${period_end ?? null}
      )
      RETURNING *
    `;
    // Для periodicity=weekdays используем training_days (колонка уже есть)
    if (category === 'custom' && periodicity === 'weekdays' && Array.isArray(weekdays) && weekdays.length > 0) {
      await sql`UPDATE habits SET training_days = ${weekdays} WHERE id = ${habit.id}`;
      habit.training_days = weekdays;
    }
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
      SELECT id, habit_id, user_id, date, value, source FROM habit_logs
      WHERE habit_id = ${habitId}
        AND date BETWEEN ${toDateStr(mon)} AND ${toDateStr(sun)}
    `;

    const minValue = habit.goal_value ?? 1;
    // Стрики по всем участникам (одним запросом), чтобы отдать и свой, и для модалки детализации
    const streakRows = await sql`
      SELECT user_id, date FROM habit_logs
      WHERE habit_id = ${habitId} AND value >= ${minValue}
      ORDER BY date DESC
    `;
    const member_streaks = {};
    for (const m of members) {
      member_streaks[m.id] = calcStreaks(streakRows.filter(r => r.user_id === m.id));
    }
    const streak = member_streaks[req.userId] ?? { current: 0, max: 0 };

    const [syncRow] = await sql`
      SELECT MAX(synced_at) AS last_synced_at FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${req.userId}
        AND source IN ('health_connect', 'healthkit')
    `;
    const last_synced_at = syncRow?.last_synced_at ?? null;

    res.json({ ...habit, members, week_logs, streak, member_streaks, last_synced_at });
  } catch (e) {
    console.error('get habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/v1/habits/:id — редактировать привычку (только создатель)
router.patch('/:id', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { name, description, goal_value, notifications } = req.body;
  if (!name?.trim()) return res.status(400).json({ message: 'name обязателен' });
  try {
    const [habit] = await sql`SELECT creator_id, notifications FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    if (habit.creator_id !== req.userId) return res.status(403).json({ message: 'Нет прав' });

    // notifications не передан (старый клиент) — сохраняем текущее значение, не сбрасываем на true
    const nextNotifications = typeof notifications === 'boolean' ? notifications : habit.notifications;

    const [updated] = await sql`
      UPDATE habits
      SET name = ${name.trim()},
          description = ${description?.trim() || null},
          goal_value = ${goal_value ?? null},
          notifications = ${nextNotifications}
      WHERE id = ${habitId}
      RETURNING *
    `;
    res.json({ ...updated, is_creator: true });
  } catch (e) {
    console.error('patch habit error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/v1/habits/:id/logs?from=2026-05-19&to=2026-05-25[&userId=42] — логи за период.
// userId необязателен: по умолчанию текущий юзер, иначе — указанный участник группы.
router.get('/:id/logs', async (req, res) => {
  const habitId = parseInt(req.params.id);
  const { from, to, userId } = req.query;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return res.status(400).json({ message: 'Параметры from и to обязательны (YYYY-MM-DD)' });
  }
  const targetUser = userId ? parseInt(userId) : req.userId;
  try {
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });

    // Чужие логи можно смотреть только по участнику этой же группы
    if (targetUser !== req.userId) {
      const [targetMember] = await sql`
        SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${targetUser}
      `;
      if (!targetMember) return res.status(404).json({ message: 'Участник не найден' });
    }

    const logs = await sql`
      SELECT id, habit_id, user_id, date, value, source FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${targetUser}
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
    const inserted = await sql`
      INSERT INTO habit_members (habit_id, user_id) VALUES (${habit.id}, ${req.userId})
      ON CONFLICT DO NOTHING
      RETURNING user_id
    `;
    res.json({ ...habit, is_creator: habit.creator_id === req.userId });

    // Уведомляем создателя только о реальном новом вступлении (не повторном)
    if (inserted.length) {
      notifyHabitJoin(habit, req.userId).catch(e => console.error('notify join error:', e.message));
    }
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
    const [habit] = await sql`SELECT * FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    const [membership] = await sql`
      SELECT 1 FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}
    `;
    if (!membership) return res.status(403).json({ message: 'Нет доступа' });
    const logDate = date ?? toDateStr(new Date());
    const [prev] = await sql`
      SELECT value FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${req.userId} AND date = ${logDate}
    `;
    const [log] = await sql`
      INSERT INTO habit_logs (habit_id, user_id, date, value, source)
      VALUES (${habitId}, ${req.userId}, ${logDate}, ${value}, 'manual')
      ON CONFLICT (habit_id, user_id, date) DO UPDATE
        SET value = ${value}, source = 'manual'
      RETURNING *
    `;

    let pullups_recalculated = false;
    let pullups_habit = null;
    // Только первый чек-ин за день двигает план — повторное нажатие в тот же день
    // (исправление ошибочного выбора) не должно повторно сдвигать/пересчитывать план.
    if (habit.category === 'pullups' && !prev) {
      const result = advanceOrRecalc(habit, !!value);
      pullups_recalculated = result.recalculated;
      const [updated] = await sql`
        UPDATE habits SET
          pullups_session_index = ${result.pullups_session_index},
          current_form = ${result.current_form ?? habit.current_form},
          pullups_plan = ${sql.json(result.pullups_plan ?? habit.pullups_plan)}
        WHERE id = ${habitId}
        RETURNING *
      `;
      pullups_habit = updated;
    }

    res.json({ ...log, ...(pullups_habit ? { habit: pullups_habit, pullups_recalculated } : {}) });

    notifyGoalIfReached({
      habitId, userId: req.userId, prevValue: prev?.value ?? null, newValue: log.value, date: logDate,
    }).catch(e => console.error('notify goal error:', e.message));
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
    const [prev] = await sql`
      SELECT value FROM habit_logs
      WHERE habit_id = ${habitId} AND user_id = ${req.userId} AND date = ${logDate}
    `;
    const [log] = await sql`
      INSERT INTO habit_logs (habit_id, user_id, date, value, source, synced_at)
      VALUES (${habitId}, ${req.userId}, ${logDate}, ${value}, ${source}, now())
      ON CONFLICT (habit_id, user_id, date) DO UPDATE
        SET value = CASE
              WHEN habit_logs.source = 'manual' THEN habit_logs.value
              ELSE GREATEST(habit_logs.value, EXCLUDED.value)
            END,
            source = CASE
              WHEN habit_logs.source = 'manual' THEN 'manual'
              ELSE EXCLUDED.source
            END,
            synced_at = CASE
              WHEN habit_logs.source = 'manual' THEN habit_logs.synced_at
              ELSE now()
            END
      RETURNING *
    `;
    if (source === 'health_connect' || source === 'healthkit') {
      await sql`
        UPDATE users SET health_connected_at = COALESCE(health_connected_at, now())
        WHERE id = ${req.userId}
      `;
    }
    res.json(log);

    notifyGoalIfReached({
      habitId, userId: req.userId, prevValue: prev?.value ?? null, newValue: log.value, date: logDate,
    }).catch(e => console.error('notify goal error:', e.message));
  } catch (e) {
    console.error('sync habit log error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/habits/:id/members/me — выйти из цели (любой участник)
router.delete('/:id/members/me', async (req, res) => {
  const habitId = parseInt(req.params.id);
  try {
    const [habit] = await sql`SELECT creator_id FROM habits WHERE id = ${habitId}`;
    if (!habit) return res.status(404).json({ message: 'Не найдено' });
    if (habit.creator_id === req.userId) return res.status(400).json({ message: 'Создатель не может покинуть цель — передайте права или удалите цель' });
    await sql`DELETE FROM habit_members WHERE habit_id = ${habitId} AND user_id = ${req.userId}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('leave habit error:', e);
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
