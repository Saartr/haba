const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const GOOGLE_CLIENT_ID = '__GOOGLE_CLIENT_ID__';
const isAndroid = /Android/i.test(navigator.userAgent);

let googleToken = null;

function setStatus(msg, type = '') {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = 'status ' + type;
}

function showGoogle() {
  document.getElementById('google-section').style.display = 'block';
  document.getElementById('manual-section').style.display = 'none';
  document.getElementById('subtitle').textContent = 'Синхронизируй шаги с Google Fit';
}

function showManual() {
  document.getElementById('google-section').style.display = 'none';
  document.getElementById('manual-section').style.display = 'block';
  document.getElementById('back-btn').style.display = isAndroid ? 'block' : 'none';
  document.getElementById('subtitle').textContent = 'Введи количество шагов вручную';
}

async function syncGoogleFit() {
  setStatus('Авторизация в Google...');

  const redirectUri = 'https://bot.mihmih.pro/miniapp/callback';
  const scope = 'https://www.googleapis.com/auth/fitness.activity.read';
  const state = tg.initDataUnsafe?.user?.id || 'unknown';

  const authUrl =
    'https://accounts.google.com/o/oauth2/v2/auth' +
    '?client_id=' + GOOGLE_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&response_type=code' +
    '&scope=' + encodeURIComponent(scope) +
    '&state=' + state +
    '&access_type=offline' +
    '&prompt=consent';

  tg.openLink(authUrl);
  setStatus('После авторизации вернись в Telegram — шаги подтянутся автоматически.');
}

async function submitSteps(count) {
  setStatus('Сохраняем...');
  try {
    const resp = await fetch('https://bot.mihmih.pro/miniapp/steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initData: tg.initData,
        steps: count,
      }),
    });
    const data = await resp.json();
    if (data.ok) {
      setStatus('✅ ' + count.toLocaleString('ru-RU') + ' шагов записано!', 'success');
      setTimeout(() => tg.close(), 1500);
    } else {
      setStatus('Ошибка: ' + (data.error || 'попробуй ещё раз'), 'error');
    }
  } catch (e) {
    setStatus('Нет соединения. Попробуй ещё раз.', 'error');
  }
}

function submitManual() {
  const val = parseInt(document.getElementById('manual-input').value);
  if (isNaN(val) || val < 0 || val > 200000) {
    setStatus('Введи число от 0 до 200 000', 'error');
    return;
  }
  submitSteps(val);
}

// Инициализация
if (isAndroid) {
  showGoogle();
} else {
  showManual();
  document.getElementById('subtitle').textContent =
    'Google Fit доступен только на Android. Введи шаги вручную.';
}
