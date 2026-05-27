function progressBar(percent) {
  const filled = Math.min(10, Math.round(Math.min(percent, 100) / 10));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function fmt(n) {
  return Number(n).toLocaleString('ru-RU');
}

function dayLabel(days) {
  const n = Math.abs(days);
  if (n === 1) return 'день';
  if (n >= 2 && n <= 4) return 'дня';
  return 'дней';
}

module.exports = { progressBar, fmt, dayLabel };
