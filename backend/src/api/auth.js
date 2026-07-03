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
const AVATARS_DIR = '/var/www/haba/backend/public/avatars';
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
  // jti — иначе при двух рефрешах одного юзера в одну и ту же секунду (гонка, см. /auth/refresh)
  // payload совпадает целиком и jwt.sign даёт побайтово одинаковую строку → конфликт UNIQUE(token).
  return jwt.sign({ sub: userId, type: 'refresh', jti: crypto.randomUUID() }, JWT_SECRET, { expiresIn: REFRESH_TTL });
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

// Фото профиля через VK API users.get с сервисным токеном — в отличие от
// пользовательского access_token, сервисный не привязан к IP устройства, поэтому
// можно звать с сервера в любой момент (не только сразу после клиентского логина).
// photo_max_orig/photo_100 — фоллбэк на случай, если у фото нет варианта 200px
// (VK не отдаёт photo_200, если исходник меньше 200×200).
async function fetchVkPhotoUrl(vkId) {
  const params = new URLSearchParams({
    user_ids: vkId,
    fields: 'photo_max_orig,photo_200,photo_100',
    access_token: VK_SERVICE_TOKEN,
    v: '5.199',
  });
  const res = await fetch(`https://api.vk.com/method/users.get?${params}`);
  const data = await res.json();
  const u = data.response?.[0];
  if (!u) return null;
  return u.photo_max_orig || u.photo_200 || u.photo_100 || null;
}

// Кандидаты URL фото профиля из ЛЮБОГО привязанного провайдера (если привязаны и tg_id,
// и vk_id — проверяем оба). Порядок: Telegram Bot API (надёжнее временных URL) → VK
// users.get (сервисный токен) → freshProviderPhotoUrl (photo_url из виджета/OIDC claims —
// последний фоллбэк на случай, если оба провайдер-специфичных способа не сработали).
async function fetchProviderAvatarCandidates(bot, user, freshProviderPhotoUrl) {
  const candidates = [];
  if (user.tg_id) {
    try {
      const photos = await bot.api.getUserProfilePhotos(Number(user.tg_id), { limit: 1 });
      if (photos.total_count) {
        const fileId = photos.photos[0][0].file_id;
        const file = await bot.api.getFile(fileId);
        candidates.push(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${file.file_path}`);
      }
    } catch (e) {
      console.error('Avatar: Telegram Bot API lookup failed:', e.message);
    }
  }
  if (user.vk_id) {
    try {
      const url = await fetchVkPhotoUrl(user.vk_id);
      if (url) candidates.push(url);
    } catch (e) {
      console.error('Avatar: VK users.get lookup failed:', e.message);
    }
  }
  if (freshProviderPhotoUrl) candidates.push(freshProviderPhotoUrl);
  return candidates;
}

// Скачивает первый доступный кандидат, сохраняет как avatar_url пользователя.
async function downloadFirstAvatar(userId, candidates) {
  const destPath = path.join(AVATARS_DIR, `${userId}.jpg`);
  fs.mkdirSync(AVATARS_DIR, { recursive: true });

  for (const url of candidates) {
    try {
      await downloadFile(url, destPath);
      const avatarUrl = `${AVATARS_URL}/${userId}.jpg`;
      await sql`UPDATE users SET avatar_url = ${avatarUrl} WHERE id = ${userId}`;
      return avatarUrl;
    } catch (e) {
      console.error('Avatar download failed for', url, ':', e.message);
    }
  }
  return null;
}

// Пытается подтянуть аватар, если его ещё нет — вызывается при логине/привязке.
async function ensureAvatar(bot, user, freshProviderPhotoUrl) {
  if (user.avatar_url) return user.avatar_url;
  const candidates = await fetchProviderAvatarCandidates(bot, user, freshProviderPhotoUrl);
  return downloadFirstAvatar(user.id, candidates);
}

const VK_SERVICE_TOKEN = process.env.VK_SERVICE_TOKEN;
const VK_CLIENT_ID = '54615454';

async function verifyVkToken(accessToken, userId) {
  // secure.checkToken не привязан к IP в отличие от users.get с user access token
  const params = new URLSearchParams({
    token: accessToken,
    client_secret: process.env.VK_CLIENT_SECRET,
    access_token: VK_SERVICE_TOKEN,
    v: '5.199',
  });
  const url = `https://api.vk.com/method/secure.checkToken?${params}`;
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
      INSERT INTO users (vk_id, first_name, last_name, email, phone, last_login_provider)
      VALUES (${vkId}, ${firstName}, ${lastName}, ${emailVal}, ${phoneVal}, 'vk')
      ON CONFLICT (vk_id) DO UPDATE SET
        first_name = COALESCE(users.first_name, EXCLUDED.first_name),
        last_name  = COALESCE(users.last_name,  EXCLUDED.last_name),
        email      = COALESCE(EXCLUDED.email,      users.email),
        phone      = COALESCE(EXCLUDED.phone,      users.phone),
        last_login_provider = 'vk'
      RETURNING id, username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(req.bot, user, photoUrl);

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
        username:   user.username || null,
        first_name: user.first_name || null,
        last_name:  user.last_name  || null,
        avatar_url: avatarUrl || null,
        tg_id:      user.tg_id ? String(user.tg_id) : null,
        vk_id:      user.vk_id || null,
        last_login_provider: user.last_login_provider || null,
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
      INSERT INTO users (tg_id, username, first_name, last_name, phone, last_login_provider)
      VALUES (${tgId}, ${username}, ${firstName}, ${lastName}, ${phone}, 'telegram')
      ON CONFLICT (tg_id) DO UPDATE SET
        username   = COALESCE(users.username,   EXCLUDED.username),
        first_name = COALESCE(users.first_name, EXCLUDED.first_name),
        last_name  = COALESCE(users.last_name,  EXCLUDED.last_name),
        phone      = COALESCE(EXCLUDED.phone,      users.phone),
        last_login_provider = 'telegram'
      RETURNING id, username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(req.bot, user, claims.picture || null);

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
        username:   user.username || null,
        first_name: user.first_name || null,
        last_name:  user.last_name  || null,
        avatar_url: avatarUrl || null,
        tg_id:      user.tg_id ? String(user.tg_id) : null,
        vk_id:      user.vk_id || null,
        last_login_provider: user.last_login_provider || null,
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

    // DELETE...RETURNING атомарно «забирает» строку — при гонке параллельных
    // запросов с одним и тем же refreshToken только один из них получит row,
    // остальные получат пустой результат вместо повторного использования токена.
    const [row] = await sql`
      DELETE FROM refresh_tokens
      WHERE token = ${refreshToken}
      RETURNING id, user_id, expires_at
    `;

    if (!row) return res.status(401).json({ message: 'Сессия истекла' });

    if (new Date() > new Date(row.expires_at)) {
      return res.status(401).json({ message: 'Сессия истекла' });
    }

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
      SELECT username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
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
      last_login_provider: user.last_login_provider || null,
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
      RETURNING username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
      tg_id:      user.tg_id ? String(user.tg_id) : null,
      vk_id:      user.vk_id     || null,
      last_login_provider: user.last_login_provider || null,
    });
  } catch (e) {
    console.error('patch me error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/auth/refresh-avatar — принудительно перекачать аватар из привязанных
// провайдеров (в отличие от ensureAvatar игнорирует текущий avatar_url) — кнопка
// «Обновить аватар» в настройках профиля.
router.post('/refresh-avatar', requireAuth, async (req, res) => {
  try {
    const [user] = await sql`SELECT id, tg_id, vk_id FROM users WHERE id = ${req.userId}`;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    if (!user.tg_id && !user.vk_id) {
      return res.status(400).json({ message: 'Нет привязанного Telegram или VK' });
    }

    const candidates = await fetchProviderAvatarCandidates(req.bot, user);
    const avatarUrl = await downloadFirstAvatar(user.id, candidates);
    if (!avatarUrl) {
      return res.status(422).json({ message: 'Не удалось получить фото профиля' });
    }

    const [full] = await sql`
      SELECT username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
      FROM users WHERE id = ${req.userId}
    `;
    res.json({
      username:   full.username   || null,
      first_name: full.first_name || null,
      last_name:  full.last_name  || null,
      avatar_url: full.avatar_url || null,
      tg_id:      full.tg_id ? String(full.tg_id) : null,
      vk_id:      full.vk_id     || null,
      last_login_provider: full.last_login_provider || null,
    });
  } catch (e) {
    console.error('refresh-avatar error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Объединяет данные двух аккаунтов: переносит всё из deleteId в keepId, удаляет deleteId.
// Используется при привязке второго способа входа, если tg_id/vk_id уже занят другим аккаунтом.
async function mergeUsers(keepId, deleteId) {
  // Передаём creator_id привычек
  await sql`UPDATE habits SET creator_id = ${keepId} WHERE creator_id = ${deleteId}`;

  // Переносим участников привычек (дубли — пропускаем)
  await sql`
    INSERT INTO habit_members (habit_id, user_id, joined_at)
    SELECT habit_id, ${keepId}, joined_at FROM habit_members
    WHERE user_id = ${deleteId}
    ON CONFLICT (habit_id, user_id) DO NOTHING
  `;
  await sql`DELETE FROM habit_members WHERE user_id = ${deleteId}`;

  // Переносим логи (на конфликт даты — побеждает большее значение)
  await sql`
    INSERT INTO habit_logs (habit_id, user_id, date, value, source)
    SELECT habit_id, ${keepId}, date, value, source FROM habit_logs
    WHERE user_id = ${deleteId}
    ON CONFLICT (habit_id, user_id, date) DO UPDATE SET
      value  = GREATEST(habit_logs.value, EXCLUDED.value),
      source = CASE WHEN habit_logs.value >= EXCLUDED.value
                    THEN habit_logs.source ELSE EXCLUDED.source END
  `;
  await sql`DELETE FROM habit_logs WHERE user_id = ${deleteId}`;

  // Переносим push-токены (удаляем дубли по токену)
  try {
    await sql`
      DELETE FROM push_tokens
      WHERE user_id = ${deleteId}
        AND token IN (SELECT token FROM push_tokens WHERE user_id = ${keepId})
    `;
    await sql`UPDATE push_tokens SET user_id = ${keepId} WHERE user_id = ${deleteId}`;
  } catch (_) {}

  // Удаляем сессии второго аккаунта
  await sql`DELETE FROM refresh_tokens WHERE user_id = ${deleteId}`;

  // Заполняем пустые поля профиля данными из второго аккаунта
  const [other] = await sql`SELECT * FROM users WHERE id = ${deleteId}`;
  if (other) {
    await sql`
      UPDATE users SET
        username            = COALESCE(username,            ${other.username}),
        first_name          = COALESCE(first_name,          ${other.first_name}),
        last_name           = COALESCE(last_name,           ${other.last_name}),
        email               = COALESCE(email,               ${other.email}),
        phone               = COALESCE(phone,               ${other.phone}),
        avatar_url          = COALESCE(avatar_url,          ${other.avatar_url}),
        health_connected_at = COALESCE(health_connected_at, ${other.health_connected_at})
      WHERE id = ${keepId}
    `;
  }

  await sql`DELETE FROM users WHERE id = ${deleteId}`;
}

// POST /api/v1/auth/link/telegram — привязать Telegram к текущему аккаунту.
// Если tg_id уже есть у другого юзера — мерджим его в текущий.
router.post('/link/telegram', requireAuth, async (req, res) => {
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
    return res.status(401).json({ message: 'Недействительный id_token' });
  }

  const tgId = String(claims.id ?? claims.sub);
  const username = claims.preferred_username || null;
  const fullName = typeof claims.name === 'string' ? claims.name.trim() : '';
  const firstName = fullName ? fullName.split(/\s+/)[0] : null;
  const lastName = fullName && fullName.includes(' ') ? fullName.slice(firstName.length).trim() || null : null;
  const phone = claims.phone_number || null;

  try {
    const [conflict] = await sql`
      SELECT id FROM users WHERE tg_id = ${tgId} AND id != ${req.userId}
    `;
    if (conflict) await mergeUsers(req.userId, conflict.id);

    const [user] = await sql`
      UPDATE users SET
        tg_id      = ${tgId},
        username   = COALESCE(username,   ${username}),
        first_name = COALESCE(first_name, ${firstName}),
        last_name  = COALESCE(last_name,  ${lastName}),
        phone      = COALESCE(phone,      ${phone})
      WHERE id = ${req.userId}
      RETURNING id, username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(req.bot, user, claims.picture || null);

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: avatarUrl       || null,
      tg_id:      user.tg_id ? String(user.tg_id) : null,
      vk_id:      user.vk_id     || null,
      last_login_provider: user.last_login_provider || null,
    });
  } catch (e) {
    console.error('link/telegram error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/auth/link/vk — привязать VK к текущему аккаунту.
// Если vk_id уже есть у другого юзера — мерджим его в текущий.
router.post('/link/vk', requireAuth, async (req, res) => {
  const { accessToken, userId, firstName: clientFirstName, lastName: clientLastName, photo200, email, phone } = req.body;
  if (!accessToken || !userId) return res.status(400).json({ message: 'accessToken и userId обязательны' });

  try {
    await verifyVkToken(accessToken, userId);
  } catch (e) {
    return res.status(401).json({ message: 'Не удалось верифицировать VK токен' });
  }

  const vkId = String(userId);

  try {
    const [conflict] = await sql`
      SELECT id FROM users WHERE vk_id = ${vkId} AND id != ${req.userId}
    `;
    if (conflict) await mergeUsers(req.userId, conflict.id);

    const [user] = await sql`
      UPDATE users SET
        vk_id      = ${vkId},
        first_name = COALESCE(first_name, ${clientFirstName || null}),
        last_name  = COALESCE(last_name,  ${clientLastName  || null}),
        email      = COALESCE(email,      ${email           || null}),
        phone      = COALESCE(phone,      ${phone           || null})
      WHERE id = ${req.userId}
      RETURNING id, username, first_name, last_name, avatar_url, tg_id, vk_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(req.bot, user, photo200 || null);

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: avatarUrl       || null,
      tg_id:      user.tg_id ? String(user.tg_id) : null,
      vk_id:      user.vk_id     || null,
      last_login_provider: user.last_login_provider || null,
    });
  } catch (e) {
    console.error('link/vk error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/auth/me — удалить аккаунт
// Удаляет: токены, логи, членство в привычках, привычки где user — единственный участник,
// аватар с диска, сам аккаунт.
// Групповые привычки с несколькими участниками: передаём права следующему по joined_at,
// либо soft-close если участников > 1 и все остальные — тоже удаляемые (не наш случай).
router.delete('/me', requireAuth, async (req, res) => {
  const userId = req.userId;
  try {
    // 1. Получаем путь к аватару до удаления
    const [user] = await sql`SELECT avatar_url FROM users WHERE id = ${userId}`;

    // 2. Привычки, где пользователь — создатель
    const creatorHabits = await sql`
      SELECT h.id, h.closed_at FROM habits h
      WHERE h.creator_id = ${userId} AND h.closed_at IS NULL
    `;

    for (const habit of creatorHabits) {
      // Есть ли другие участники?
      const others = await sql`
        SELECT user_id FROM habit_members
        WHERE habit_id = ${habit.id} AND user_id != ${userId}
        ORDER BY joined_at ASC
        LIMIT 1
      `;
      if (others.length > 0) {
        // Передаём права следующему участнику
        await sql`UPDATE habits SET creator_id = ${others[0].user_id} WHERE id = ${habit.id}`;
      } else {
        // Единственный участник — soft-close
        await sql`UPDATE habits SET closed_at = now() WHERE id = ${habit.id}`;
      }
    }

    // 3. Удаляем все данные пользователя (каскад через FK DELETE CASCADE на habit_members/habit_logs)
    await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;
    await sql`DELETE FROM habit_logs WHERE user_id = ${userId}`;
    await sql`DELETE FROM habit_members WHERE user_id = ${userId}`;
    await sql`DELETE FROM users WHERE id = ${userId}`;

    // 4. Удаляем аватар с диска (не критично если нет файла)
    if (user?.avatar_url) {
      const avatarPath = path.join(AVATARS_DIR, `${userId}.jpg`);
      fs.unlink(avatarPath, () => {});
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('delete account error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

module.exports = router;
module.exports.requireAuth = requireAuth;
