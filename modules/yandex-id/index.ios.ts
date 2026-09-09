import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { SERVER_ORIGIN, YANDEX_CLIENT_ID } from '@/lib/config';

// Вход через Яндекс на iOS. Нативного SDK у нас под iOS нет, поэтому используем
// тот же authorization code + PKCE, что и на вебе, но открываем системную
// ASWebAuthenticationSession вместо перехода страницы. Код на токен меняет наш
// сервер (POST /auth/yandex/web) — токен провайдера в приложение не попадает.
//
// Возврат в приложение: Яндекс редиректит на уже зарегистрированный веб-адрес
// https://apptapa.ru/auth/yandex/callback, а та страница, увидев в state префикс
// NATIVE_STATE_PREFIX, сама перебрасывает на haba://auth/yandex/callback. Так не
// нужен ни отдельный Redirect URI в консоли Яндекса, ни Universal Links (которые
// потребовали бы платного Apple Developer Account).

const AUTHORIZE_URL = 'https://oauth.yandex.ru/authorize';
const WEB_REDIRECT = `${SERVER_ORIGIN}/auth/yandex/callback`;
/** Помечает state, чтобы страница-callback поняла: возвращать надо в приложение. */
export const NATIVE_STATE_PREFIX = 'app';
/** Длина случайной части state сразу после префикса. Разделителей в state нет
 *  намеренно: VK не вернул state, содержавший точки, — в редиректе его просто не
 *  оказалось (проверено по логам nginx 2026-09-09). */
const STATE_NONCE_LEN = 16;

/** Куда возвращаться из браузера. В собранном приложении это haba://, а в Expo Go —
 *  exp://<хост-туннеля>/--/…, поэтому адрес нельзя зашивать: Linking.createURL даёт
 *  правильный для текущего окружения. Он же кладётся в state, чтобы страница-callback
 *  знала, куда перебрасывать. */
function appRedirect(): string {
  return Linking.createURL('auth/yandex/callback');
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url без паддинга. Своя реализация, а не btoa: его в React Native может не быть
 *  (см. соседний комментарий про code_verifier). Вход — URL, то есть только ASCII. */
function encodeReturnUrl(url: string): string {
  let out = '';
  for (let i = 0; i < url.length; i += 3) {
    const a = url.charCodeAt(i);
    const b = i + 1 < url.length ? url.charCodeAt(i + 1) : NaN;
    const c = i + 2 < url.length ? url.charCodeAt(i + 2) : NaN;
    out += B64[a >> 2];
    out += B64[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)];
    if (!isNaN(b)) out += B64[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)];
    if (!isNaN(c)) out += B64[c & 63];
  }
  return out;
}

function base64UrlFromBase64(b64: string): string {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Шестнадцатеричная строка, а не base64: btoa в React Native есть не везде, а hex
// целиком укладывается в разрешённый для code_verifier алфавит (RFC 7636).
function randomHex(bytes: number): string {
  return Array.from(Crypto.getRandomBytes(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type YandexAuthCode = { code: string; codeVerifier: string };

/** Открывает системный веб-вход и возвращает код авторизации.
 *  Обмен кода на токены делает вызывающий через yandexWebAuth(). */
export async function signInWithYandexCode(): Promise<YandexAuthCode> {
  const codeVerifier = randomHex(32);
  const redirect = appRedirect();
  const state = NATIVE_STATE_PREFIX + randomHex(STATE_NONCE_LEN / 2) + encodeReturnUrl(redirect);
  const challenge = base64UrlFromBase64(
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    }),
  );

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: YANDEX_CLIENT_ID,
    redirect_uri: WEB_REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });

  const result = await WebBrowser.openAuthSessionAsync(`${AUTHORIZE_URL}?${params}`, redirect);
  if (result.type !== 'success' || !result.url) {
    const e: any = new Error('Вход через Яндекс отменён');
    e.code = 'YANDEX_AUTH_CANCELLED';
    throw e;
  }

  // Linking.parse, а не new URL: в React Native URL реализован не полностью
  const returned = Linking.parse(result.url);
  const code = returned.queryParams?.code as string | undefined;
  const returnedState = returned.queryParams?.state as string | undefined;
  if (!code) throw new Error('Яндекс не вернул код авторизации');
  // state сгенерирован этим же запуском — защищает от подмены ответа
  if (returnedState !== state) throw new Error('Ответ Яндекса не совпал с запросом');

  return { code, codeVerifier };
}

/** Нативного SDK под iOS нет — вход идёт через signInWithYandexCode(). */
export function signInWithYandex(): Promise<string> {
  return Promise.reject(new Error('На iOS вход выполняется через signInWithYandexCode()'));
}

export function takeStoredAuthRequest(): { codeVerifier: string | null; state: string | null } {
  return { codeVerifier: null, state: null };
}
