// Единственное место, где живут публичный адрес сервера и путь к файлам на диске.
// Всё берётся из .env, чтобы переезд на другой хостинг/домен был сменой настройки,
// а не правкой кода. Значения по умолчанию — текущий сервер, чтобы ничего не сломалось,
// если переменные не заданы.

// Публичный origin без завершающего слэша: https://example.ru
const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || 'https://bot.mihmih.pro').replace(/\/+$/, '');

// Каталог с аватарами на диске. На новом сервере путь может отличаться.
const AVATARS_DIR = process.env.AVATARS_DIR || '/var/www/haba/backend/public/avatars';

// URL, по которому аватары отдаются наружу. Он же попадает в users.avatar_url,
// поэтому при смене домена колонку нужно переписать (см. rules_backend_deploy).
const AVATARS_URL = `${PUBLIC_ORIGIN}/avatars`;

module.exports = { PUBLIC_ORIGIN, AVATARS_DIR, AVATARS_URL };
