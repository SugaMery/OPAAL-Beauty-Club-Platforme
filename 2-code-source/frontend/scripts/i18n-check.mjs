// Vérifie que chaque texte traduisible du code a sa traduction anglaise.
// Usage : node scripts/i18n-check.mjs   (code de sortie 1 s'il manque des traductions)
//
// Textes détectés :
//   {{ 'Texte' | tr }}, [attr]="'Texte' | tr"   (modèles)
//   tr('Texte'), i18n.tr('Texte'), mark('Texte') (code)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('../src/app/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dictFiles = { site: join(root, 'core/i18n-site-en.ts'), admin: join(root, 'admin/i18n-admin-en.ts') };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|html)$/.test(name) && !/i18n-(site|admin)-en\.ts$/.test(name)) out.push(p);
  }
  return out;
}

function unescape(s) {
  return s.replace(/\\(u\{?[0-9a-fA-F]+\}?|.)/g, (m, c) => {
    if (c === 'n') return '\n';
    if (c === 't') return '\t';
    if (c.startsWith('u')) return String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16));
    return c;
  });
}

function loadDict(file) {
  const src = readFileSync(file, 'utf8');
  const start = src.indexOf('{', src.indexOf('='));
  const end = src.lastIndexOf('}');
  return new Function('return ' + src.slice(start, end + 1))();
}

const STR = String.raw`(['"])((?:\\.|(?!\1)[^\\])*)\1`;
const patterns = [
  new RegExp(STR + String.raw`\s*\|\s*tr\b`, 'g'),
  new RegExp(String.raw`\b(?:tr|trActive|mark)\(\s*` + STR, 'g'),
  // Messages de repli des formulaires : err('champ', 'Texte')
  new RegExp(String.raw`\berr\(\s*'\w+'\s*,\s*` + STR, 'g'),
  // translate(langue, 'Texte') et copy(valeur, 'Message affiché')
  new RegExp(String.raw`\btranslate\(\s*[\w.()]+\s*,\s*` + STR, 'g'),
  new RegExp(String.raw`\bcopy\([^,()]+(?:\(\))?\s*,\s*` + STR, 'g'),
];

const used = new Map(); // clé -> fichiers
const add = (key, file) => {
  if (!key.trim()) return;
  if (!used.has(key)) used.set(key, new Set());
  used.get(key).add(relative(root, file).replace(/\\/g, '/'));
};
for (const file of walk(root)) {
  const src = readFileSync(file, 'utf8');
  for (const re of patterns) {
    for (const m of src.matchAll(re)) add(unescape(m[2]), file);
  }
  // (condition ? 'Texte A' : (autre ? 'B' : 'C')) | tr   et   tr(condition ? 'A' : 'B', …)
  const branches = (expr) => {
    for (const m of expr.matchAll(new RegExp(String.raw`[?:]\s*\(?\s*` + STR, 'g'))) add(unescape(m[2]), file);
  };
  for (const m of src.matchAll(/\)\s*\|\s*tr\b/g)) {
    let depth = 0;
    for (let i = m.index; i >= 0; i--) {
      if (src[i] === ')') depth++;
      else if (src[i] === '(' && --depth === 0) {
        branches(src.slice(i, m.index + 1));
        break;
      }
    }
  }
  for (const m of src.matchAll(/\b(?:tr|trActive|t)\(/g)) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')' && --depth === 0) {
        const args = src.slice(m.index + m[0].length, i);
        branches(args);
        // t('singulier', 'pluriel', n) : les deux formes
        if (m[0] === 't(') for (const s of args.matchAll(new RegExp(STR, 'g'))) add(unescape(s[2]), file);
        break;
      }
    }
  }
  // Textes passés à <app-page-hero crumb="…" lead="…"> (traduits dans le composant)
  for (const tag of src.matchAll(/<app-page-hero\b(?:[^>"]|"[^"]*")*>/g)) {
    for (const a of tag[0].matchAll(/\s(?:crumb|eyebrow|lead|ghost|badge)="([^"]*)"/g)) add(a[1], file);
  }
  // <app-edit-lang note="…"> (précision traduite dans le composant)
  for (const m of src.matchAll(/<app-edit-lang\b[^>]*\snote="([^"]*)"/g)) add(m[1], file);
}

const site = loadDict(dictFiles.site);
let admin = {};
try {
  admin = loadDict(dictFiles.admin);
} catch {
  /* pas encore créé */
}
const all = { ...site, ...admin };

const missing = [...used.keys()].filter((k) => !(k in all));
const unused = Object.keys(all).filter((k) => !used.has(k));
const empty = Object.entries(all).filter(([, v]) => !String(v).trim()).map(([k]) => k);
const badVars = Object.entries(all).filter(([k, v]) => {
  const a = (k.match(/\{\w+\}/g) || []).sort().join();
  const b = (String(v).match(/\{\w+\}/g) || []).sort().join();
  return a !== b;
}).map(([k]) => k);

// Textes de l'espace propriétaire placés dans le dictionnaire du site public (et inversement) : simple avertissement
const adminOnlyInSite = Object.keys(site).filter((k) => used.has(k) && [...used.get(k)].every((f) => f.startsWith('admin/')));

console.log(`Textes traduisibles : ${used.size} · traductions : ${Object.keys(all).length}`);
if (missing.length) {
  console.log(`\n✗ ${missing.length} traduction(s) manquante(s) :`);
  for (const k of missing) console.log(`  ${JSON.stringify(k)}  ← ${[...used.get(k)].join(', ')}`);
}
if (badVars.length) {
  console.log(`\n✗ ${badVars.length} traduction(s) avec des {variables} différentes :`);
  for (const k of badVars) console.log(`  ${JSON.stringify(k)}`);
}
if (empty.length) console.log(`\n✗ ${empty.length} traduction(s) vide(s) : ${empty.map((k) => JSON.stringify(k)).join(', ')}`);
if (unused.length) console.log(`\n· ${unused.length} traduction(s) inutilisée(s) : ${unused.slice(0, 40).map((k) => JSON.stringify(k)).join(', ')}${unused.length > 40 ? '…' : ''}`);
if (adminOnlyInSite.length) console.log(`\n· ${adminOnlyInSite.length} texte(s) de l'espace propriétaire dans le dictionnaire du site : ${adminOnlyInSite.slice(0, 20).map((k) => JSON.stringify(k)).join(', ')}`);
process.exit(missing.length || badVars.length || empty.length ? 1 : 0);
