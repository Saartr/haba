// Генератор юридических текстов из .txt в этой папке. Все файлы — в UTF-8.
// Запуск: node .legal-src/gen.js
//
// Из одного источника пишет сразу два места, чтобы тексты не разъезжались:
//   1. lib/legal-content.ts — экран «О приложении» в самом приложении;
//   2. backend/public/<адрес>/index.html и /en/ — публичные страницы на apptapa.ru.
//      Их требует Google Play: политика конфиденциальности должна открываться по ссылке
//      без входа в приложение. Выкладываются обычным ./deploy-backend.ps1.
// Правка текста = правка .txt + запуск генератора. HTML и .ts руками не трогать.
//
// (Раньше RU-файлы читались как Windows-1251 — легаси от исходного экспорта из Word;
// перешли на UTF-8 при переписывании текстов под реальный сбор данных, см. history.)
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const root = path.join(dir, '..');

function readRu(name) {
  let t = fs.readFileSync(path.join(dir, name), 'utf8');
  t = t.replace(/\r\n/g, '\n').replace(/\[Имя Фамилия\]/g, 'Миронов Иван').trim();
  return t;
}
function readEn(name) {
  return fs.readFileSync(path.join(dir, name), 'utf8').replace(/\r\n/g, '\n').trim();
}

const docs = {
  privacy: {
    ru: { title: 'Политика конфиденциальности', body: readRu('Политика конфиденциальности_ru.txt') },
    en: { title: 'Privacy Policy', body: readEn('privacy_en.txt') },
  },
  agreement: {
    ru: { title: 'Пользовательское соглашение', body: readRu('Пользовательское соглашение_ru.txt') },
    en: { title: 'Terms of Use', body: readEn('agreement_en.txt') },
  },
  consent: {
    ru: { title: 'Согласие на обработку данных', body: readRu('Согласие на обработку персональных данных_ru.txt') },
    en: { title: 'Consent to Data Processing', body: readEn('consent_en.txt') },
  },
};

// ── 1. lib/legal-content.ts ──────────────────────────────────────────────────

let out = `// AUTO-GENERATED из .legal-src/ (не редактировать вручную — править исходные .txt и перегенерировать).
// Тексты юридических документов в двух языках для экрана «О приложении».

export type LegalLang = 'ru' | 'en';
export type LegalDoc = { title: string; body: string };

export const LEGAL_CONTENT: Record<string, Record<LegalLang, LegalDoc>> = {\n`;

for (const [type, langs] of Object.entries(docs)) {
  out += `  ${type}: {\n`;
  for (const lang of ['ru', 'en']) {
    out += `    ${lang}: {\n`;
    out += `      title: ${JSON.stringify(langs[lang].title)},\n`;
    out += `      body: ${JSON.stringify(langs[lang].body)},\n`;
    out += `    },\n`;
  }
  out += `  },\n`;
}
out += `};\n`;

fs.writeFileSync(path.join(root, 'lib', 'legal-content.ts'), out, 'utf8');
console.log('lib/legal-content.ts written,', out.length, 'bytes');

// ── 2. Публичные страницы на apptapa.ru ─────────────────────────────────────

// Страница удаления аккаунта есть только на сайте: Google Play требует ссылку, по которой
// удаление можно запросить без приложения. В самом приложении для этого есть кнопка.
const siteDocs = {
  ...docs,
  deletion: {
    ru: { title: 'Удаление аккаунта', body: readRu('Удаление аккаунта_ru.txt') },
    en: { title: 'Account Deletion', body: readEn('delete-account_en.txt') },
  },
};

// Адреса на сайте. Соглашение публикуется как /terms — привычное имя для таких страниц.
const SLUGS = { privacy: 'privacy', agreement: 'terms', consent: 'consent', deletion: 'delete-account' };

const UI = {
  ru: { home: 'Тапа', otherLang: 'English' },
  en: { home: 'Tapa', otherLang: 'Русский' },
};

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Почта в тексте становится ссылкой. Домен без точки на конце: адрес часто стоит в
// конце предложения, и точка не должна уйти в mailto.
function linkify(escaped) {
  return escaped.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => `<a href="mailto:${m}">${m}</a>`);
}

function pageUrl(type, lang) {
  return lang === 'ru' ? `/${SLUGS[type]}/` : `/${SLUGS[type]}/en/`;
}

// Разметка текстов простая и одинаковая во всех файлах: первая строка — полное название,
// вторая — дата обновления или подзаголовок, разделы «N. Заголовок», пункты с «•».
function bodyToHtml(body) {
  const lines = body.split('\n');
  const html = [];
  let inList = false;
  const closeList = () => {
    if (inList) { html.push('  </ul>'); inList = false; }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (i === 0) return; // полное название — уходит в <h1>
    if (i === 1) {
      html.push(`  <p class="updated">${esc(line)}</p>`);
      return;
    }
    if (!line) { closeList(); return; }
    if (/^\d+\.\s/.test(line)) {
      closeList();
      html.push(`  <h2>${esc(line)}</h2>`);
      return;
    }
    if (line.startsWith('•')) {
      if (!inList) { html.push('  <ul>'); inList = true; }
      html.push(`    <li>${linkify(esc(line.replace(/^•\s*/, '')))}</li>`);
      return;
    }
    closeList();
    html.push(`  <p>${linkify(esc(line))}</p>`);
  });
  closeList();
  return html.join('\n') + '\n';
}

// Та же палитра, что у страницы со сборкой на корне домена.
const CSS = `
  :root { --brand:#6047ff; --link:#6047ff; --bg:#f5f5f5; --card:#fff; --text:#121212; --muted:#757575; --border:#e5e5e5; }
  @media (prefers-color-scheme: dark) {
    :root { --link:#a99bff; --bg:#121212; --card:#1e1e1e; --text:#fafafa; --muted:#9e9e9e; --border:#2e2e2e; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); padding:24px 16px;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
  .doc { background:var(--card); border-radius:32px; padding:28px 24px 32px; max-width:760px;
         margin:0 auto; font-size:15px; line-height:1.6; }
  .top { display:flex; justify-content:space-between; gap:12px; margin-bottom:20px; font-size:14px; }
  a { color:var(--link); }
  h1 { font-size:26px; line-height:1.25; margin:0 0 6px; }
  h2 { font-size:18px; line-height:1.35; margin:28px 0 8px; }
  .updated { color:var(--muted); font-size:13px; margin:0 0 20px; }
  p { margin:0 0 10px; }
  ul { margin:0 0 12px; padding-left:22px; }
  li { margin:0 0 6px; }
  footer { margin-top:32px; padding-top:18px; border-top:1px solid var(--border);
           color:var(--muted); font-size:13px; line-height:1.9; }
`;

function renderPage(type, lang) {
  const doc = siteDocs[type][lang];
  const other = lang === 'ru' ? 'en' : 'ru';
  const fullTitle = doc.body.split('\n')[0].trim();
  const footer = Object.keys(siteDocs)
    .filter((t) => t !== type)
    .map((t) => `<a href="${pageUrl(t, lang)}">${esc(siteDocs[t][lang].title)}</a>`)
    .join(' · ');

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<!-- СГЕНЕРИРОВАНО .legal-src/gen.js из .legal-src/*.txt — не править вручную. -->
<title>${esc(doc.title)} — ${UI[lang].home}</title>
<link rel="icon" href="/favicon.png" sizes="48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="alternate" hreflang="${other}" href="${pageUrl(type, other)}">
<meta name="theme-color" content="#6047ff">
<style>${CSS}</style>
</head>
<body>
<main class="doc">
  <nav class="top"><a href="/">← ${UI[lang].home}</a><a href="${pageUrl(type, other)}" hreflang="${other}">${UI[lang].otherLang}</a></nav>
  <h1>${esc(fullTitle)}</h1>
${bodyToHtml(doc.body)}  <footer>${footer}</footer>
</main>
</body>
</html>
`;
}

let pages = 0;
for (const type of Object.keys(siteDocs)) {
  for (const lang of ['ru', 'en']) {
    const outDir = path.join(root, 'backend', 'public', SLUGS[type], ...(lang === 'en' ? ['en'] : []));
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), renderPage(type, lang), 'utf8');
    pages++;
  }
}
console.log(`backend/public: ${pages} pages (${Object.values(SLUGS).join(', ')} × ru/en)`);
