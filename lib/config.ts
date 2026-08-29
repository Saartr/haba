// Единственное место с адресом сервера — при переезде на другой хостинг/домен
// меняется только эта строка (плюс PUBLIC_ORIGIN в .env на сервере).
export const SERVER_ORIGIN = 'https://apptapa.ru';

export const BASE_URL = `${SERVER_ORIGIN}/api/v1`;

/** Ссылка-приглашение в групповую цель. Открывается страницей на сервере,
 *  которая редиректит в приложение по haba://join/<код>. */
export function inviteLink(code: string): string {
  return `${SERVER_ORIGIN}/join/${code}`;
}
