import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import { SERVER_ORIGIN, VK_WEB_CLIENT_ID } from '@/lib/config';

// Вход через VK ID на iOS. Нативного SDK под iOS у нас нет, поэтому используется
// OAuth 2.1 с PKCE (VK его требует) через системную ASWebAuthenticationSession.
// Код на токен меняет наш сервер (POST /auth/vk/web) — токен провайдера в
// приложение не попадает. Устройство схемы возврата — как у Яндекса, см.
// modules/yandex-id/index.ios.ts: адрес берётся из Linking.createURL и едет в state,
// потому что в Expo Go схема exp://, а в собранном приложении haba://.

const AUTHORIZE_URL = 'https://id.vk.ru/authorize';
const WEB_REDIRECT = `${SERVER_ORIGIN}/auth/vk/callback`;
export const NATIVE_STATE_PREFIX = 'app.';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

/** base64url без паддинга. Своя реализация, а не btoa: его в React Native может не быть. */
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

function randomHex(bytes: number): string {
  return Array.from(Crypto.getRandomBytes(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type VkAuthCode = { code: string; codeVerifier: string; deviceId: string };

/** Открывает системный веб-вход VK и возвращает код авторизации.
 *  Обмен кода на токены делает вызывающий через vkWebAuth(). */
export async function signInWithVKCode(): Promise<VkAuthCode> {
  const codeVerifier = randomHex(32);
  const redirect = Linking.createURL('auth/vk/callback');
  const state = NATIVE_STATE_PREFIX + encodeReturnUrl(redirect) + '.' + randomHex(8);
  const challenge = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier, {
      encoding: Crypto.CryptoEncoding.BASE64,
    })
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: VK_WEB_CLIENT_ID,
    redirect_uri: WEB_REDIRECT,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    // scope намеренно не запрашиваем: базовые данные (имя, фото) VK отдаёт всегда,
    // а email и phone включаются тумблерами в консоли (вкладка Access) — запрос
    // невключённого скоупа VK отклоняет. Понадобятся — включить там и добавить сюда.
  });

  const result = await WebBrowser.openAuthSessionAsync(`${AUTHORIZE_URL}?${params}`, redirect);
  if (result.type !== 'success' || !result.url) {
    const e: any = new Error('Вход через VK отменён');
    e.code = 'VK_AUTH_CANCELLED';
    throw e;
  }

  const returned = Linking.parse(result.url);
  const code = returned.queryParams?.code as string | undefined;
  const deviceId = returned.queryParams?.device_id as string | undefined;
  const returnedState = returned.queryParams?.state as string | undefined;
  if (!code) throw new Error('VK не вернул код авторизации');
  // device_id обязателен при обмене кода в OAuth 2.1 у VK
  if (!deviceId) throw new Error('VK не вернул device_id');
  if (returnedState !== state) throw new Error('Ответ VK не совпал с запросом');

  return { code, codeVerifier, deviceId };
}

/** Нативного SDK под iOS нет — вход идёт через signInWithVKCode(). */
export function signInWithVK(): Promise<never> {
  return Promise.reject(new Error('На iOS вход выполняется через signInWithVKCode()'));
}
