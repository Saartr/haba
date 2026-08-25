const { Router } = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const sql = require('../db/client');

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const ACCESS_TTL = '15m';
const REFRESH_TTL = '30d';
const AVATARS_DIR = '/var/www/haba/backend/public/avatars';
const AVATARS_URL = 'https://bot.mihmih.pro/avatars';

// Яндекс ID. Нативный SDK отдаёт готовый OAuth-токен, поэтому обмена code→token на сервере
// нет — только проверка токена через login.yandex.ru/info. Секрет приложения не нужен.
const YANDEX_CLIENT_ID = process.env.YANDEX_CLIENT_ID;

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

// Профиль пользователя по OAuth-токену Яндекса. В отличие от VK, токен не привязан к IP,
// поэтому его можно проверять с сервера напрямую и сервисный ключ не нужен.
// ВАЖНО: ответ содержит client_id — его обязательно сверять со своим. Иначе токен, выданный
// постороннему приложению, можно предъявить нашему серверу и войти под чужим аккаунтом.
async function fetchYandexUserInfo(accessToken) {
  const res = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Yandex info HTTP ${res.status}`);
  const data = await res.json();
  if (!data.id) throw new Error('Yandex info: пустой id');
  if (YANDEX_CLIENT_ID && data.client_id !== YANDEX_CLIENT_ID) {
    throw new Error('Yandex info: токен выдан другому приложению');
  }
  return data;
}

// Аватар Яндекса собирается из default_avatar_id. is_avatar_empty=true — стоит заглушка,
// её качать не нужно. islands-200 — размер 200×200, как photo_200 у VK.
function yandexAvatarUrlById(avatarId) {
  return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
}

function yandexAvatarId(info) {
  if (!info?.default_avatar_id || info.is_avatar_empty) return null;
  return String(info.default_avatar_id);
}

function yandexPhotoUrl(info) {
  const id = yandexAvatarId(info);
  return id ? yandexAvatarUrlById(id) : null;
}

// Кандидаты URL фото профиля из ЛЮБОГО привязанного провайдера (если привязаны и yandex_id,
// и vk_id — проверяем оба). Порядок: VK users.get (сервисный токен) → сохранённый
// yandex_avatar_id → freshProviderPhotoUrl (фото из свежего ответа провайдера) как фоллбэк.
async function fetchProviderAvatarCandidates(user, freshProviderPhotoUrl) {
  const candidates = [];
  if (user.vk_id) {
    try {
      const url = await fetchVkPhotoUrl(user.vk_id);
      if (url) candidates.push(url);
    } catch (e) {
      console.error('Avatar: VK users.get lookup failed:', e.message);
    }
  }
  if (user.yandex_avatar_id) {
    candidates.push(yandexAvatarUrlById(user.yandex_avatar_id));
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
async function ensureAvatar(user, freshProviderPhotoUrl) {
  if (user.avatar_url) return user.avatar_url;
  const candidates = await fetchProviderAvatarCandidates(user, freshProviderPhotoUrl);
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
      RETURNING id, username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(user, photoUrl);

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
        vk_id:      user.vk_id || null,
        yandex_id:  user.yandex_id || null,
        last_login_provider: user.last_login_provider || null,
      },
    });
  } catch (e) {
    console.error('vk auth error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// POST /api/v1/auth/yandex — нативный Яндекс ID SDK отдаёт готовый OAuth-токен.
// Сервер меняет его на профиль через login.yandex.ru/info (там же сверяется client_id).
router.post('/yandex', async (req, res) => {
  const { accessToken: yandexToken } = req.body;
  if (!yandexToken) return res.status(400).json({ message: 'accessToken обязателен' });

  let info;
  try {
    info = await fetchYandexUserInfo(yandexToken);
  } catch (e) {
    console.error('yandex verify failed:', e.message);
    return res.status(401).json({ message: 'Не удалось верифицировать токен Яндекса' });
  }

  const yandexId = String(info.id);
  // real_name/display_name — фоллбэк, если у аккаунта не заполнены отдельные поля имени.
  const fullName = (info.real_name || info.display_name || '').trim();
  const firstName = info.first_name || (fullName ? fullName.split(/\s+/)[0] : null);
  const lastName = info.last_name
    || (fullName && fullName.includes(' ') ? fullName.slice(fullName.split(/\s+/)[0].length).trim() || null : null);
  const username = info.login || null;
  const emailVal = info.default_email || info.emails?.[0] || null;
  const phoneVal = info.default_phone?.number || null;
  const avatarId = yandexAvatarId(info);
  const photoUrl = avatarId ? yandexAvatarUrlById(avatarId) : null;

  try {
    const [user] = await sql`
      INSERT INTO users (yandex_id, username, first_name, last_name, email, phone, yandex_avatar_id, last_login_provider)
      VALUES (${yandexId}, ${username}, ${firstName}, ${lastName}, ${emailVal}, ${phoneVal}, ${avatarId}, 'yandex')
      -- WHERE обязателен: users_yandex_id_unique — ЧАСТИЧНЫЙ индекс, и без повторения его
      -- предиката Postgres не может его вывести (42P10). У vk_id проблемы нет только потому,
      -- что там исторически есть ещё и обычный UNIQUE users_vk_id_key.
      ON CONFLICT (yandex_id) WHERE yandex_id IS NOT NULL DO UPDATE SET
        username   = COALESCE(users.username,   EXCLUDED.username),
        first_name = COALESCE(users.first_name, EXCLUDED.first_name),
        last_name  = COALESCE(users.last_name,  EXCLUDED.last_name),
        email      = COALESCE(EXCLUDED.email,      users.email),
        phone      = COALESCE(EXCLUDED.phone,      users.phone),
        yandex_avatar_id = COALESCE(EXCLUDED.yandex_avatar_id, users.yandex_avatar_id),
        last_login_provider = 'yandex'
      RETURNING id, username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(user, photoUrl);

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
        vk_id:      user.vk_id || null,
        yandex_id:  user.yandex_id || null,
        last_login_provider: user.last_login_provider || null,
      },
    });
  } catch (e) {
    console.error('yandex auth error:', e);
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
      SELECT username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
      FROM users WHERE id = ${req.userId}
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
      vk_id:      user.vk_id     || null,
      yandex_id:  user.yandex_id || null,
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
      RETURNING username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
    `;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: user.avatar_url || null,
      vk_id:      user.vk_id     || null,
      yandex_id:  user.yandex_id || null,
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
    const [user] = await sql`SELECT id, vk_id, yandex_id, yandex_avatar_id FROM users WHERE id = ${req.userId}`;
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });
    if (!user.vk_id && !user.yandex_id) {
      return res.status(400).json({ message: 'Нет привязанного Яндекса или VK' });
    }

    const candidates = await fetchProviderAvatarCandidates(user);
    const avatarUrl = await downloadFirstAvatar(user.id, candidates);
    if (!avatarUrl) {
      return res.status(422).json({ message: 'Не удалось получить фото профиля' });
    }

    const [full] = await sql`
      SELECT username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
      FROM users WHERE id = ${req.userId}
    `;
    res.json({
      username:   full.username   || null,
      first_name: full.first_name || null,
      last_name:  full.last_name  || null,
      avatar_url: full.avatar_url || null,
      vk_id:      full.vk_id     || null,
      yandex_id:  full.yandex_id || null,
      last_login_provider: full.last_login_provider || null,
    });
  } catch (e) {
    console.error('refresh-avatar error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// Объединяет данные двух аккаунтов: переносит всё из deleteId в keepId, удаляет deleteId.
// Используется при привязке второго способа входа, если vk_id/yandex_id уже занят другим аккаунтом.
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

// POST /api/v1/auth/link/yandex — привязать Яндекс к текущему аккаунту.
// Если yandex_id уже есть у другого юзера — мерджим его в текущий.
router.post('/link/yandex', requireAuth, async (req, res) => {
  const { accessToken: yandexToken } = req.body;
  if (!yandexToken) return res.status(400).json({ message: 'accessToken обязателен' });

  let info;
  try {
    info = await fetchYandexUserInfo(yandexToken);
  } catch (e) {
    console.error('link/yandex verify failed:', e.message);
    return res.status(401).json({ message: 'Не удалось верифицировать токен Яндекса' });
  }

  const yandexId = String(info.id);
  const fullName = (info.real_name || info.display_name || '').trim();
  const firstName = info.first_name || (fullName ? fullName.split(/\s+/)[0] : null);
  const lastName = info.last_name
    || (fullName && fullName.includes(' ') ? fullName.slice(fullName.split(/\s+/)[0].length).trim() || null : null);
  const username = info.login || null;
  const emailVal = info.default_email || info.emails?.[0] || null;
  const phoneVal = info.default_phone?.number || null;

  try {
    const [conflict] = await sql`
      SELECT id FROM users WHERE yandex_id = ${yandexId} AND id != ${req.userId}
    `;
    if (conflict) await mergeUsers(req.userId, conflict.id);

    const [user] = await sql`
      UPDATE users SET
        yandex_id  = ${yandexId},
        username   = COALESCE(username,   ${username}),
        first_name = COALESCE(first_name, ${firstName}),
        last_name  = COALESCE(last_name,  ${lastName}),
        email      = COALESCE(email,      ${emailVal}),
        phone      = COALESCE(phone,      ${phoneVal}),
        yandex_avatar_id = COALESCE(${yandexAvatarId(info)}, yandex_avatar_id)
      WHERE id = ${req.userId}
      RETURNING id, username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(user, yandexPhotoUrl(info));

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: avatarUrl       || null,
      vk_id:      user.vk_id     || null,
      yandex_id:  user.yandex_id || null,
      last_login_provider: user.last_login_provider || null,
    });
  } catch (e) {
    console.error('link/yandex error:', e);
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
      RETURNING id, username, first_name, last_name, avatar_url, vk_id, yandex_id, last_login_provider
    `;

    const avatarUrl = await ensureAvatar(user, photo200 || null);

    res.json({
      username:   user.username   || null,
      first_name: user.first_name || null,
      last_name:  user.last_name  || null,
      avatar_url: avatarUrl       || null,
      vk_id:      user.vk_id     || null,
      yandex_id:  user.yandex_id || null,
      last_login_provider: user.last_login_provider || null,
    });
  } catch (e) {
    console.error('link/vk error:', e);
    res.status(500).json({ message: 'Ошибка сервера' });
  }
});

// DELETE /api/v1/auth/me — удалить аккаунт
// Удаляет: токены, логи, членство в привычках/группах, объекты где user — единственный
// участник, аватар с диска, сам аккаунт.
// Привычки и группы с другими участниками: передаём права следующему по joined_at.
// ВАЖНО: все FK на users — NO ACTION (кроме push_tokens ON DELETE CASCADE), поэтому
// перед DELETE FROM users нужно снять ВСЕ ссылки, включая legacy-таблицы бота
// (steps/groups/group_members/auth_codes) и закрытые привычки — иначе 23503.
router.delete('/me', requireAuth, async (req, res) => {
  const userId = req.userId;
  try {
    // Путь к аватару — до удаления строки
    const [user] = await sql`SELECT avatar_url FROM users WHERE id = ${userId}`;

    // Одной транзакцией: иначе падение на любом шаге оставляет «наполовину удалённый»
    // аккаунт (логи и членства уже стёрты, а сам user остался).
    await sql.begin(async sql => {
      // 1. Привычки, где пользователь — создатель. Закрытые (closed_at IS NOT NULL) тоже:
      //    ссылка в creator_id блокирует удаление независимо от статуса привычки.
      const creatorHabits = await sql`SELECT id FROM habits WHERE creator_id = ${userId}`;
      for (const habit of creatorHabits) {
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
          // Единственный участник — привычка без него бессмысленна и никому не видна.
          // habit_members/habit_logs снимутся каскадом по habit_id.
          await sql`DELETE FROM habits WHERE id = ${habit.id}`;
        }
      }

      // 2. Остальные ссылки на пользователя. Legacy-таблицы бота шагов
      //    (steps/groups/group_members/goals/auth_codes) удалены вместе с ботом.
      await sql`DELETE FROM refresh_tokens WHERE user_id = ${userId}`;
      await sql`DELETE FROM habit_logs WHERE user_id = ${userId}`;
      await sql`DELETE FROM habit_members WHERE user_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
    });

    // Аватар с диска (не критично если файла нет)
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
