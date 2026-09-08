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
const APP_REDIRECT = 'haba://auth/yandex/callback';
/** Помечает state, чтобы страница-callback поняла: возвращать надо в приложение. */
export const NATIVE_STATE_PREFIX = 'app.';

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
  const state = NATIVE_STATE_PREFIX + randomHex(8);
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

  const result = await WebBrowser.openAuthSessionAsync(`${AUTHORIZE_URL}?${params}`, APP_REDIRECT);
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
