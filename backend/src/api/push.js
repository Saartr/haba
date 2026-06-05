const { Router } = require('express');
const sql = require('../db/client');
const { requireAuth } = require('./auth');

const router = Router();
router.use(requireAuth);

// POST /api/v1/push/register { token, platform }
// Upsert по token: если устройство меняет аккаунт — перепривязываем к новому user_id.
router.post('/register', async (req, res) => {
  const { token, platform } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token обязателен' });
  }
  try {
    await sql`
      INSERT INTO push_tokens (user_id, token, platform)
      VALUES (${req.userId}, ${token}, ${platform ?? null})
      ON CONFLICT (token) DO UPDATE SET
        user_id    = ${req.userId},
        platform   = COALESCE(${platform ?? null}, push_tokens.platform),
        updated_at = now()
    `;
    res.json({ ok: true });
  } catch (e) {
    console.error('push register error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/push/register { token } — отписка при логауте (только свой токен)
router.delete('/register', async (req, res) => {
  const { token } = req.body;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ message: 'token обязателен' });
  }
  try {
    await sql`DELETE FROM push_tokens WHERE token = ${token} AND user_id = ${req.userId}`;
    res.json({ ok: true });
  } catch (e) {
    console.error('push unregister error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
