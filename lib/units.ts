const UNIT_PLURAL: Record<string, string> = {
  'Минута': 'минуты', 'Час': 'часы', 'Шаг': 'шаги', 'Калория': 'калории',
  'Километр': 'километры', 'Метр': 'метры', 'Стакан': 'стаканы',
  'Литр': 'литры', 'Страница': 'страницы', 'Повторение': 'повторения',
};

const UNIT_GENITIVE: Record<string, string> = {
  'Минута': 'минут', 'Час': 'часов', 'Шаг': 'шагов', 'Калория': 'калорий',
  'Километр': 'километров', 'Метр': 'метров', 'Стакан': 'стаканов',
  'Литр': 'литров', 'Страница': 'страниц', 'Повторение': 'повторений',
};

// Три формы для счётной плюрализации: [1, 2-4, 5+]. Например «1 стакан / 2 стакана / 5 стаканов».
// Ключ — лейбл единицы (именительный ед.ч.), как хранится в goal_unit.
const UNIT_FORMS: Record<string, [string, string, string]> = {
  'Минута': ['минута', 'минуты', 'минут'],
  'Час': ['час', 'часа', 'часов'],
  'Шаг': ['шаг', 'шага', 'шагов'],
  'Калория': ['калория', 'калории', 'калорий'],
  'Километр': ['километр', 'километра', 'километров'],
  'Метр': ['метр', 'метра', 'метров'],
  'Стакан': ['стакан', 'стакана', 'стаканов'],
  'Литр': ['литр', 'литра', 'литров'],
  'Страница': ['страница', 'страницы', 'страниц'],
  'Повторение': ['повторение', 'повторения', 'повторений'],
};

export function pluralUnit(unit: string | null): string {
  if (!unit) return 'значение';
  return UNIT_PLURAL[unit] ?? unit.toLowerCase();
}

export function genitiveUnit(unit: string | null): string {
  if (!unit) return '';
  const s = UNIT_GENITIVE[unit] ?? unit.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// «N единиц» со счётной плюрализацией: «1 стакан», «2 стакана», «5 стаканов».
// Для пресетных единиц — три формы; для своего варианта (нет в словаре) — лейбл как есть
// (правильных форм для произвольного слова у нас нет).
export function formatUnit(n: number, unit: string | null): string {
  if (!unit) return `${n} раз${pluralRazSuffix(n)}`;
  const forms = UNIT_FORMS[unit];
  if (!forms) return `${n} ${unit.toLowerCase()}`;
  const mod10 = n % 10;
  const mod100 = n % 100;
  let form: string;
  if (mod100 >= 11 && mod100 <= 14) form = forms[2];
  else if (mod10 === 1) form = forms[0];
  else if (mod10 >= 2 && mod10 <= 4) form = forms[1];
  else form = forms[2];
  return `${n} ${form}`;
}

// «раз» неизменяемо во множественном, но «раза» для 2-4: 1 раз, 2 раза, 5 раз.
function pluralRazSuffix(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return '';
  if (mod10 >= 2 && mod10 <= 4) return 'а';
  return '';
}
