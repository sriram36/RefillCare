#!/usr/bin/env node
/**
 * Keeps English, Bengali and Hindi in step.
 *
 * Fails if a key is missing in a language, if a {placeholder} differs between languages, if a screen uses a key
 * that is not defined, or if a Bengali/Hindi value is just the English text. The customer screens live in
 * lib/i18n.ts and each staff screen has its own file.
 *
 *   npm run check:i18n
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const DICTIONARY_FILES = ['i18n.ts', 'i18n_pharmacist.ts', 'i18n_store.ts', 'i18n_dashboard.ts'];

const ENTRY = /^\s{4}(\w+):\s*'((?:[^'\\]|\\.)*)'/gm;
const dict = { en: {}, bn: {}, hi: {} };
const problems = [];
for (const file of DICTIONARY_FILES) {
  const src = fs.readFileSync(path.join(root, 'lib', file), 'utf8');
  for (const lang of ['en', 'bn', 'hi']) {
    const start = src.indexOf(`  ${lang}: {`);
    const end = src.indexOf('\n  },', start);
    for (const m of src.slice(start, end).matchAll(ENTRY)) {
      if (m[1] in dict[lang]) problems.push(`${file}: "${m[1]}" is defined twice in ${lang}`);
      dict[lang][m[1]] = m[2];
    }
  }
}

const keys = Object.keys(dict.en);

for (const lang of ['bn', 'hi']) {
  for (const k of keys) if (!(k in dict[lang])) problems.push(`${lang}: missing "${k}"`);
  for (const k of Object.keys(dict[lang])) if (!(k in dict.en)) problems.push(`${lang}: "${k}" has no English entry`);
}

const placeholders = (s) => (s.match(/\{(\w+)\}/g) || []).sort().join(',');
for (const k of keys) {
  for (const lang of ['bn', 'hi']) {
    if (k in dict[lang] && placeholders(dict[lang][k]) !== placeholders(dict.en[k])) {
      problems.push(`${lang}: "${k}" has different {placeholders} from English`);
    }
    if (dict[lang][k] === dict.en[k] && /[A-Za-z]{4,}/.test(dict.en[k]) && k !== 'app_title') {
      problems.push(`${lang}: "${k}" is identical to English, so it is probably untranslated`);
    }
  }
}

// every key a screen asks for must exist
const files = [
  'components/CustomerView.tsx',
  'components/Header.tsx',
  'components/AuthModal.tsx',
  'components/Timeline.tsx',
  'components/PharmacistView.tsx',
  'components/StoreView.tsx',
  'components/DashboardView.tsx',
  'app/page.tsx',
  ...fs.readdirSync(path.join(root, 'components', 'customer')).filter((f) => f.endsWith('.tsx')).map((f) => `components/customer/${f}`),
];
for (const f of files) {
  const text = fs.readFileSync(path.join(root, f), 'utf8');
  const used = new Set([
    ...[...text.matchAll(/\bt\(\s*['"](\w+)['"]/g)].map((m) => m[1]),
    ...[...text.matchAll(/translate\(\s*['"](\w+)['"]/g)].map((m) => m[1]),
    ...[...text.matchAll(/key:\s*'((?:area|sample|rel|cat)_\w+)'/g)].map((m) => m[1]),
    ...[...text.matchAll(/\bGROUP_KEY\b[^\n]*'(cat_restricted)'/g)].map((m) => m[1]),
    ...[...text.matchAll(/\[\s*'\w+',\s*'(sample_\w+)'\s*\]/g)].map((m) => m[1]),
    // staff screens keep their keys in lookup tables such as STATUS_KEY = { dispatched: 'ph_status_dispatched' }
    ...[...text.matchAll(/['"]((?:ph|sv|db)_\w+)['"]/g)].map((m) => m[1]),
  ]);
  for (const k of used) if (!(k in dict.en)) problems.push(`${f}: uses "${k}", which is not defined`);
}

if (problems.length) {
  console.error(`i18n check failed (${problems.length}):`);
  problems.forEach((p) => console.error(`  - ${p}`));
  process.exit(1);
}
console.log(`i18n ok: ${keys.length} keys in English, Bengali and Hindi, placeholders match.`);
