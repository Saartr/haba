// Единственное место с адресом сервера — при переезде на другой хостинг/домен
// меняется только эта строка (плюс PUBLIC_ORIGIN в .env на сервере).
export const SERVER_ORIGIN = 'https://apptapa.ru';

export const BASE_URL = `${SERVER_ORIGIN}/api/v1`;

/** Ссылка-приглашение в групповую цель. Открывается страницей на сервере,
 *  которая редиректит в приложение по haba://join/<код>. */
export function inviteLink(code: string): string {
  return `${SERVER_ORIGIN}/join/${code}`;
}

/** client_id приложения в Яндекс OAuth. Публичное значение, не секрет.
 *  Дублируется в plugins/with-yandex-manifest-placeholders.js — там он нужен
 *  нативной сборке до запуска JS, поэтому одним местом обойтись не выходит. */
export const YANDEX_CLIENT_ID = '1e466a3264584e3aaf95945ce4a25449';

/** ID приложения в VK ID для Android — нативный SDK. Публичное значение, не секрет.
 *  Дублируется в plugins/with-vk-manifest-placeholders.js: там он нужен нативной
 *  сборке до запуска JS. */
export const VK_CLIENT_ID = '54615454';

/** ID приложения VK ID с платформой «Веб-сайт» (создано 2026-09-08). Используется
 *  входом на iOS: консоль VK заводит отдельное приложение на каждую платформу, и
 *  наш redirect https://apptapa.ru/auth/vk/callback зарегистрирован именно у этого.
 *  Ему же соответствуют VK_WEB_CLIENT_SECRET и VK_WEB_SERVICE_TOKEN в .env сервера —
 *  secure.checkToken проверяет токен против выдавшего приложения. */
export const VK_WEB_CLIENT_ID = '54761714';
