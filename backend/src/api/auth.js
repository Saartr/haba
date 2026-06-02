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

// Telegram Native Login (нативный SDK) — на сервере только верификация id_token.
// Браузерный OIDC-флоу (PKCE/обмен code→token) НЕ используется: SDK отдаёт id_token напрямую.
const jose = require('jose');
const TG_CLIENT_ID = process.env.TELEGRAM_CLIENT_ID;
const TG_OIDC_ISSUER = 'https://oauth.telegram.org';
const TG_JWKS = jose.createRemoteJWKSet(
  new URL('https://oauth.telegram.org/.well-known/jwks.json'),
);

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
  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  // Сначала пробуем Bot API — надёжнее чем временный photo_url из виджета
  try {
    const photos = await bot.api.getUserProfilePhotos(tgId, { limit: 1 });
    if (photos.total_count) {
      const fileId = photos.photos[0][0].file_id;
      const file = await bot.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`;
      await downloadFile(fileUrl, destPath);
      return `${AVATARS_URL}/${userId}.jpg`;
    }
  } catch (e) {
    console.error('Avatar download via Bot API failed:', e.message);
  }

  // Fallback на photo_url из виджета
  if (photoUrl) {
    try {
      await downloadFile(photoUrl, destPath);
      return `${AVATARS_URL}/${userId}.jpg`;
    } catch (e) {
      console.error('Avatar download from widget URL failed:', e.message);
    }
  }

  return null;
}

const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN;
const VK_CLIENT_ID = '54615454';

async function verifyVkToken(accessToken, userId) {
  // secure.checkToken не привязан к IP в отличие от users.get с user access token
  const url = `https://api.vk.com/method/secure.checkToken?token=${accessToken}&client_secret=${process.env.VK_CLIENT_SECRET}&access_token=${VK_SERVICE_TOKEN}&v=5.199`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`VK API error: ${data.error.error_msg}`);
  if (!data.response?.success) throw new Error('Token verification failed');
  if (String(data.response.user_id) !== String(userId)) throw new Error('userId mismatch');
  return data.response;
}

// POST /api/v1/auth/vk
router.post('/vk', async (req, res) => {
  const { accessToken, userId, firstName: clientFirstName, lastName: clientLastName, photo200, email, phone } = req.body;
  if (!accessToken || !userId) {
    return res.status(400).json({ message: 'accessToken и userId обязательны' });
  }

  try {
    await verifyVkToken(accessToken, userId);
  } catch (e) {
    console.error('VK token verify error:', e.message);
    return res.status(401).json({ message: 'Не удалось верифицировать VK токен' });
  }

  const vkId = String(userId);
  const firstName = clientFirstName || null;
  const lastName = clientLastName || null;
  const photoUrl = photo200 || null;
  const emailVal = email || null;
  const phoneVal = phone || null;

  try {
    const [user] = await sql`
      INSERT INTO users (vk_id, first_name, last_name, email, phone)
      VALUES (${vkId}, ${firstName}, ${lastName}, ${emailVal}, ${phoneVal})
      ON CONFLICT (vk_id) DO UPDATE SET
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name  = COALESCE(EXCLUDED.last_name,  users.last_name),
        email      = COALESCE(EXCLUDED.email,      users.email),
        phone      = COALESCE(EXCLUDED.phone,      users.phone)
      RETURNING id, first_name, last_name, avatar_url
    `;

    let avatarUrl = user.avatar_url;
    if (!avatarUrl && photoUrl) {
      const destPath = path.join(AVATARS_DIR, `${user.id}.jpg`);
      try {
        fs.mkdirSync(AVATARS_DIR, { recursive: true });
        await downloadFile(photoUrl, destPath);
        avatarUrl = `${AVATARS_URL}/${user.id}.jpg`;
        await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${user.id}`;
      } catch (e) {
        console.error('VK avatar download failed:', e.message);
      }
    }

    const newAccessToken = makeAccessToken(user.id);
    const refreshToken = makeRefreshToken(user.id);
    const refreshExp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await sql`DELETE FROM refresh_tokens WHERE user_id = ${user.id}`;
    await sql`
      INSERT INTO refresh_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${refreshToken}, ${refreshExp})
    `;

    res.json({
      accessToken: newAccessToken,
      refreshToken,
      user: {
        username:   null,
        first_name: user.first_name || null,
        last_name:  user.last_name  || null,
        avatar_url: avatarUrl || null,
      },
    });
  } catch (e) {
    console.error('vk auth error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/auth/telegram-native — нативный Telegram SDK отдаёт id_token (OIDC JWT).
// Верифицируем подпись через JWKS Telegram (RS256), проверяем iss/aud, достаём claims.
router.post('/telegram-native', async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ message: 'id_token обязателен' });

  let claims;
  try {
    const { payload } = await jose.jwtVerify(id_token, TG_JWKS, {
      issuer: TG_OIDC_ISSUER,
      audience: TG_CLIENT_ID,
    });
    claims = payload;
  } catch (e) {
    console.error('telegram-native verify failed:', e.message);
    return res.status(401).json({ message: 'Недействительный id_token' });
  }

  // OIDC claims: sub/id = tg user id, name, preferred_username, picture, phone_number
  const tgId = String(claims.id ?? claims.sub);
  if (!tgId || tgId === 'undefined') {
    return res.status(400).json({ message: 'В токене нет идентификатора пользователя' });
  }
  const fullName = typeof claims.name === 'string' ? claims.name.trim() : '';
  const firstName = fullName ? fullName.split(/\s+/)[0] : null;
  const lastName = fullName && fullName.includes(' ')
    ? fullName.slice(firstName.length).trim() || null
    : null;
  const username = claims.preferred_username || null;
  const phone = claims.phone_number || null;

  try {
    const [user] = await sql`
      INSERT INTO users (tg_id, username, first_name, last_name, phone)
      VALUES (${tgId}, ${username}, ${firstName}, ${lastName}, ${phone})
      ON CONFLICT (tg_id) DO UPDATE SET
        username   = COALESCE(EXCLUDED.username,   users.username),
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name  = COALESCE(EXCLUDED.last_name,  users.last_name),
        phone      = COALESCE(EXCLUDED.phone,      users.phone)
      RETURNING id, username, first_name, last_name, avatar_url
    `;

    // Аватар: claims.picture — URL фото из Telegram. Скачиваем через тот же helper
    // (по Bot API надёжнее, picture может протухать), fallback на текущий.
    let avatarUrl = await fetchAndSaveAvatar(req.bot, tgId, user.id, claims.picture || null);
    if (!avatarUrl) avatarUrl = user.avatar_url;
    if (avatarUrl && avatarUrl !== user.avatar_url) {
      await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${user.id}`;
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
    console.error('telegram-native auth error:', e);
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
      SELECT username, first_name, last_name, avatar_url, tg_id, vk_id
      FROM users WHERE id = ${req.userId}
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
      tg_id:      user.tg_id ? String(user.tg_id) : null,
      vk_id:      user.vk_id     || null,
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
