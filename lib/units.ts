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

export function pluralUnit(unit: string | null): string {
  if (!unit) return 'значение';
  return UNIT_PLURAL[unit] ?? unit.toLowerCase();
}

export function genitiveUnit(unit: string | null): string {
  if (!unit) return '';
  const s = UNIT_GENITIVE[unit] ?? unit.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
