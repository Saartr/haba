const { Router } = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sql = require('../db/client');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const AVATARS_DIR = '/var/www/step-bot/public/avatars';
const AVATARS_URL = 'https://bot.mihmih.pro/avatars';

function makeAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function makeRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Требуется авторизация' });
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type === 'refresh') {
      return res.status(401).json({ message: 'Токен недействителен' });
    }
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ message: 'Токен недействителен или истёк' });
  }
}

function verifyTelegramAuth(data) {
  const { hash, ...fields } = data;
  const checkString = Object.keys(fields)
    .sort()
    .map(k => `${k}=${fields[k]}`)
    .join('\n');
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_TOKEN).digest();
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === hash;
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (u) => {
      https.get(u, res => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return follow(res.headers.location);
        }
        if (res.statusCode !== 200) {
          fs.unlink(dest, () => {});
          return reject(new Error(`HTTP ${res.statusCode} for ${u}`));
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', err => { fs.unlink(dest, () => {}); reject(err); });
      }).on('error', err => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    follow(url);
  });
}

async function fetchAndSaveAvatar(bot, tgId, userId, photoUrl) {
  const destPath = path.join(AVATARS_DIR, `${userId}.jpg`);
  const stat = fs.existsSync(destPath) ? fs.statSync(destPath) : null;
  if (stat && stat.size > 0) return `${AVATARS_URL}/${userId}.jpg`;
  if (stat && stat.size === 0) fs.unlinkSync(destPath);

  if (photoUrl) {
    try {
      fs.mkdirSync(AVATARS_DIR, { recursive: true });
      await downloadFile(photoUrl, destPath);
      return `${AVATARS_URL}/${userId}.jpg`;
    } catch (e) {
      console.error('Avatar download from widget URL failed:', e.message);
    }
  }

  try {
    const photos = await bot.api.getUserProfilePhotos(tgId, { limit: 1 });
    if (!photos.total_count) return null;
    const fileId = photos.photos[0][0].file_id;
    const file = await bot.api.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
    await downloadFile(fileUrl, destPath);
    return `${AVATARS_URL}/${userId}.jpg`;
  } catch (e) {
    console.error('Avatar download via Bot API failed:', e.message);
    return null;
  }
}

// GET /api/v1/auth/telegram-login
router.get('/telegram-login', (req, res) => {
  const BOT_ID = '8671249381';
  const origin = encodeURIComponent('https://bot.mihmih.pro');
  const returnTo = encodeURIComponent('https://bot.mihmih.pro/api/v1/auth/telegram-callback');
  const authUrl = `https://oauth.telegram.org/auth?bot_id=${BOT_ID}&origin=${origin}&return_to=${returnTo}&request_access=write`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>Открыть Telegram</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    .wrap { width: 100%; padding: 24px; display: flex; flex-direction: column; align-items: stretch; }
    .btn {
      width: 100%;
      height: 56px;
      background: #6047ff;
      border: none;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      text-decoration: none;
    }
    .btn:active { background: #381aff; }
    .btn span { font-size: 16px; font-weight: 700; color: #ffffff; }
  </style>
</head>
<body>
  <div class="wrap">
    <a class="btn" href="${authUrl}">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M19.8 12.925L4.4 19.425C4.06667 19.5583 3.75 19.5292 3.45 19.3375C3.15 19.1458 3 18.8667 3 18.5V5.5C3 5.13333 3.15 4.85417 3.45 4.6625C3.75 4.47083 4.06667 4.44167 4.4 4.575L19.8 11.075C20.2167 11.2583 20.425 11.5667 20.425 12C20.425 12.4333 20.2167 12.7417 19.8 12.925ZM5 17L16.85 12L5 7V10.5L11 12L5 13.5V17Z" fill="white"/>
      </svg>
      <span>Открыть Telegram</span>
    </a>
  </div>
</body>
</html>`);
});

// GET /api/v1/auth/telegram-callback
router.get('/telegram-callback', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
});

// POST /api/v1/auth/telegram
router.post('/telegram', async (req, res) => {
  const data = req.body;
  if (!data || !data.hash || !data.id) {
    return res.status(400).json({ message: 'Неверные данные' });
  }

  const authDate = parseInt(data.auth_date);
  if (Date.now() / 1000 - authDate > 86400) {
    return res.status(400).json({ message: 'Данные авторизации устарели' });
  }

  if (!verifyTelegramAuth(data)) {
    return res.status(401).json({ message: 'Неверная подпись' });
  }

  const tgId = String(data.id);
  const username = data.username || null;
  const firstName = data.first_name || null;
  const lastName = data.last_name || null;

  try {
    const [user] = await sql`
      INSERT INTO users (tg_id, username, first_name, last_name)
      VALUES (${tgId}, ${username}, ${firstName}, ${lastName})
      ON CONFLICT (tg_id) DO UPDATE SET
        username   = COALESCE(EXCLUDED.username,   users.username),
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name  = COALESCE(EXCLUDED.last_name,  users.last_name)
      RETURNING id, username, first_name, last_name, avatar_url
    `;

    let avatarUrl = user.avatar_url;
    if (!avatarUrl) {
      avatarUrl = await fetchAndSaveAvatar(req.bot, tgId, user.id, data.photo_url || null);
      if (avatarUrl) {
        await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${user.id}`;
      }
    }

    const accessToken = makeAccessToken(user.id);
    const refreshToken = makeRefreshToken(user.id);
    const refreshExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await sql`DELETE FROM refresh_tokens WHERE user_id = ${user.id}`;
    await sql`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${refreshToken}, ${refreshExp})
    `;

    res.json({
      accessToken,
      refreshToken,
      user: {
        username:   user.username,
        first_name: user.first_name || null,
        last_name:  user.last_name  || null,
        avatar_url: avatarUrl || null,
      },
    });
  } catch (e) {
    console.error('telegram auth error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ message: 'refreshToken обязателен' });

  try {
    let payload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Токен недействителен' });
    }

    if (payload.type !== 'refresh') {
      return res.status(401).json({ message: 'Токен недействителен' });
    }

    const [row] = await sql`
      SELECT id, user_id, expires_at FROM refresh_tokens
      WHERE token = ${refreshToken}
    `;

    if (!row) return res.status(401).json({ message: 'Сессия истекла' });

    if (new Date() > new Date(row.expires_at)) {
      await sql`DELETE FROM refresh_tokens WHERE id = ${row.id}`;
      return res.status(401).json({ message: 'Сессия истекла' });
    }

    await sql`DELETE FROM refresh_tokens WHERE id = ${row.id}`;

    const newAccess = makeAccessToken(row.user_id);
    const newRefresh = makeRefreshToken(row.user_id);
    const newExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (${row.user_id}, ${newRefresh}, ${newExp})
    `;

    res.json({ accessToken: newAccess, refreshToken: newRefresh });
  } catch (e) {
    console.error('refresh error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// GET /api/v1/auth/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const [user] = await sql`
      SELECT username, first_name, last_name, avatar_url
      FROM users WHERE id = ${req.userId}
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
    });
  } catch (e) {
    console.error('me error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// PATCH /api/v1/auth/me
router.patch('/me', requireAuth, async (req, res) => {
  const { first_name } = req.body;
  if (typeof first_name !== 'string' || !first_name.trim()) {
    return res.status(400).json({ message: 'first_name обязателен' });
  }

  try {
    const [user] = await sql`
      UPDATE users SET first_name = ${first_name.trim()}
      WHERE id = ${req.userId}
      RETURNING username, first_name, last_name, avatar_url
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
    });
  } catch (e) {
    console.error('patch me error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
