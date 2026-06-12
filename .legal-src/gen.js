// Генератор lib/legal-content.ts из текстов в этой папке.
// RU-файлы — в Windows-1251, EN — в UTF-8. Запуск: node .legal-src/gen.js
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const dec = new TextDecoder('windows-1251');

function readRu(name) {
  let t = dec.decode(fs.readFileSync(path.join(dir, name)));
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

fs.writeFileSync(path.join(dir, '..', 'lib', 'legal-content.ts'), out, 'utf8');
console.log('lib/legal-content.ts written,', out.length, 'bytes');
