import { SERVER_ORIGIN, YANDEX_CLIENT_ID } from '@/lib/config';

// Веб-версия входа через Яндекс ID. В приложении этим занимается нативный SDK,
// который сам открывает диалог и возвращает токен. В браузере так нельзя:
// Яндекс поддерживает только authorization code (implicit-флоу у него нет),
// поэтому здесь редирект на oauth.yandex.ru, а код на токен меняет наш сервер
// (POST /auth/yandex/web) — так токен провайдера не попадает в JS страницы.
//
// PKCE вместо client_secret: секрет приложения не нужен ни браузеру, ни серверу.

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const VERIFIER_KEY = 'haba_yandex_code_verifier';
const STATE_KEY = 'haba_yandex_state';

export const yandexRedirectUri = `${SERVER_ORIGIN}/auth/yandex/callback`;

function randomString(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  // base64url без паддинга — допустимый алфавит для code_verifier по RFC 7636
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  const bytes = new Uint8Array(digest);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Уводит страницу на Яндекс. Промис намеренно не резолвится: вкладка уходит на
 *  редирект, а вход завершает страница /auth/yandex/callback. Сигнатура совпадает
 *  с нативной версией, поэтому вызывающий код (welcome.tsx) не меняется. */
export function signInWithYandex(): Promise<string> {
  return (async () => {
    const codeVerifier = randomString(48);
    const state = randomString(16);
    // sessionStorage, а не localStorage: значения одноразовые и нужны только
    // этой вкладке до возврата с редиректа.
    sessionStorage.setItem(VERIFIER_KEY, codeVerifier);
    sessionStorage.setItem(STATE_KEY, state);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: YANDEX_CLIENT_ID,
      redirect_uri: yandexRedirectUri,
      code_challenge: await sha256Base64Url(codeVerifier),
      code_challenge_method: 'S256',
      state,
    });
    window.location.assign(`${AUTHORIZE_URL}?${params}`);
    return new Promise<string>(() => {});
  })();
}

/** Забирает сохранённые перед редиректом значения и сразу их вычищает,
 *  чтобы код нельзя было обменять повторно. */
export function takeStoredAuthRequest(): { codeVerifier: string | null; state: string | null } {
  const codeVerifier = sessionStorage.getItem(VERIFIER_KEY);
  const state = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  return { codeVerifier, state };
}
