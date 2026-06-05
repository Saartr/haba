const path = require('path');
const fs = require('fs');
const { GoogleAuth } = require('google-auth-library');
const sql = require('../db/client');

// Прямой FCM HTTP v1 — без Expo Push Service.
// Авторизация по service-account.json через google-auth-library:
// getClient() кэширует OAuth access token до истечения (~1ч), сами не кэшируем.

const PROJECT_ID = process.env.FCM_PROJECT_ID;
const SERVICE_ACCOUNT_PATH = process.env.FCM_SERVICE_ACCOUNT
  ? path.resolve(process.env.FCM_SERVICE_ACCOUNT)
  : path.join(__dirname, '..', '..', 'service-account.json');

const FCM_ENDPOINT = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

let auth = null;

function isConfigured() {
  return Boolean(PROJECT_ID) && fs.existsSync(SERVICE_ACCOUNT_PATH);
}

function getAuth() {
  if (!auth) {
    auth = new GoogleAuth({
      keyFile: SERVICE_ACCOUNT_PATH,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });
  }
  return auth;
}

async function getAccessToken() {
  const client = await getAuth().getClient();
  const { token } = await client.getAccessToken();
  return token;
}

// FCM data-payload требует строковые значения.
function stringifyData(data) {
  if (!data) return undefined;
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

// Отправка на один токен. Возвращает true при успехе.
// Протухшие токены (UNREGISTERED / 404) удаляем из БД.
async function sendToToken(token, { title, body, data }) {
  const accessToken = await getAccessToken();
  const res = await fetch(FCM_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: stringifyData(data),
        android: { priority: 'high', notification: { channel_id: 'default' } },
      },
    }),
  });

  if (res.ok) return true;

  const errBody = await res.json().catch(() => ({}));
  const errCode = errBody?.error?.details?.find(d => d.errorCode)?.errorCode;
  // UNREGISTERED — приложение удалено / токен отозван; 404 — токена нет → чистим.
  if (errCode === 'UNREGISTERED' || res.status === 404) {
    await sql`DELETE FROM push_tokens WHERE token = ${token}`;
    console.log(`[fcm] удалён протухший токен (${errCode || res.status})`);
  } else {
    console.error(`[fcm] ошибка отправки (${res.status}):`, errBody?.error?.message || errCode || 'unknown');
  }
  return false;
}

// Отправка всем устройствам пользователя.
async function sendToUser(userId, message) {
  if (!isConfigured()) {
    console.warn('[fcm] не сконфигурирован (нет FCM_PROJECT_ID или service-account.json) — пропуск');
    return;
  }
  const tokens = await sql`SELECT token FROM push_tokens WHERE user_id = ${userId}`;
  if (!tokens.length) return;
  await Promise.all(
    tokens.map(t =>
      sendToToken(t.token, message).catch(e =>
        console.error('[fcm] send error:', e.message),
      ),
    ),
  );
}

module.exports = { sendToUser, sendToToken, isConfigured };
