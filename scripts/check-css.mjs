/**
 * Stylesheet gate.
 *
 * A rule that touches the host must be scoped to the skin, may only match a
 * host contract or a skin part, and may not name a hashed class or a class
 * substring. Skin-only rules (`.isl-*`) stay unscoped because the components
 * that carry them render nothing while the skin is off. Surfaces that mount
 * unconditionally (the rail, the palette, the inspector, the row dot) carry an
 * unscoped `display: none` base plus a scoped rule that turns them on, so a
 * disabled skin can never paint chrome or swallow a click.
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HOST_ATTRIBUTES, PART_ATTR, partNames } from '../src/host/runtime.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'src');
const problems = [];
const parts = new Set(partNames());
const hostAttributes = new Set(HOST_ATTRIBUTES);
const ownAttributes = new Set([
  'data-islands-ui',
  'data-islands-part',
  'data-islands-workspace-collapsed',
  'data-islands-accent',
  'data-islands-animating',
  'data-islands-state',
  'data-state',
  'data-open',
  'data-scrolled',
  'data-clipped',
  'data-rail-id',
  'data-on',
  'data-ring',
  'data-col',
  'data-span',
  'data-islands-density',
  'data-islands-reply',
  'data-islands-age', 'data-islands-page-in',
]);
const hashedClass = /\.[A-Za-z0-9-]+_[A-Za-z0-9_-]+/u;
const classToken = /\.([A-Za-z][A-Za-z0-9-]*)/gu;

const files = (await readdir(src)).filter((name) => name.endsWith('.css')).sort();
for (const file of files) {
  const label = `src/${file}`;
  const text = (await readFile(join(src, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//gu, '');
  const peer = file === '60-peers.css';
  for (const match of text.matchAll(/([^{}]+)\{/gu)) {
    const selector = match[1].trim();
    if (selector === '' || selector.startsWith('@') || /^(?:from|to|\d+(?:\.\d+)?%)$/u.test(selector)) continue;
    const where = `${label}: "${selector.slice(0, 140)}"`;

    if (!peer && hashedClass.test(selector)) problems.push(`${where}: names a hashed class`);
    if (!peer && selector.includes('[class*=')) problems.push(`${where}: uses a class substring`);
    const selectorWithoutStrings = selector.replace(/'[^']*'/gu, "''").replace(/"[^"]*"/gu, '""');
    if (!peer) {
      for (const token of selectorWithoutStrings.matchAll(classToken)) {
        const name = token[1];
        if (name.startsWith('isl-') || name.startsWith('is-') || name.startsWith('dsh-')) continue;
        problems.push(`${where}: names the host class ".${name}"`);
      }
    }

    const partsRead = [...selector.matchAll(new RegExp(`\\[${PART_ATTR}~="([^"]+)"\\]`, 'gu'))].map((entry) => entry[1]);
    for (const part of partsRead) {
      if (!parts.has(part)) problems.push(`${where}: reads the part "${part}", which the table does not define`);
    }

    const attributes = [...selector.matchAll(/\[(data-[a-z0-9-]+)/gu)].map((entry) => entry[1]);
    if (!peer) {
      for (const attribute of attributes) {
        if (ownAttributes.has(attribute)) continue;
        if (!hostAttributes.has(attribute)) problems.push(`${where}: reads [${attribute}], which is not a host contract`);
      }
    }

    const touchesHost = partsRead.length > 0
      || attributes.some((attribute) => hostAttributes.has(attribute));
    if (touchesHost && !selector.includes('body[data-islands-ui]') && !selector.startsWith('body[data-ds-dark-theme]')) {
      problems.push(`${where}: touches the host without body[data-islands-ui] scope`);
    }
  }
}

/* ---- token hygiene -------------------------------------------------------
   A token declared twice in the same block means the first value is dead, and
   a token nobody reads is either a leftover or a rename that missed a reader.
   Both are silent in the browser, so gate them here. */
const declared = new Map();
const readNames = new Set();
const templateText = await readFile(join(src, 'client.template.js'), 'utf8');
let blockSeq = 0;

/** Walk one stylesheet and report every custom property with its block. */
function collectTokens(text, label, context = '') {
  let index = 0;
  let prelude = '';
  while (index < text.length) {
    const char = text[index];
    if (char === '{') {
      const selector = prelude.trim().replace(/\s+/gu, ' ');
      prelude = '';
      const path = context === '' ? selector : `${context} › ${selector}`;
      if (selector.startsWith('@')) {
        const close = matchBrace(text, index + 1);
        collectTokens(text.slice(index + 1, close), label, path);
        index = close + 1;
        continue;
      }
      /* Each physical block gets its own id: the same selector may legitimately
         appear twice, and only a repeat inside one block is a dead value. */
      blockSeq += 1;
      const block = `${label}#${blockSeq}`;
      const close = matchBrace(text, index + 1);
      const body = text.slice(index + 1, close);
      for (const decl of body.matchAll(/(--[A-Za-z0-9-]+)\s*:/gu)) {
        const name = decl[1];
        const holder = declared.get(name) ?? [];
        holder.push({ label, path, block });
        declared.set(name, holder);
      }
      index = close + 1;
      continue;
    }
    if (char === '}') {
      prelude = '';
      index += 1;
      continue;
    }
    prelude += char;
    index += 1;
  }
}

/** Index of the brace that closes the block opened at `start`. */
function matchBrace(text, start) {
  let depth = 1;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return text.length;
}

for (const file of files) {
  const label = `src/${file}`;
  const text = (await readFile(join(src, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//gu, '');
  collectTokens(text, label);
  for (const read of text.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/gu)) readNames.add(read[1]);
}
for (const read of templateText.matchAll(/var\(\s*(--[A-Za-z0-9-]+)/gu)) readNames.add(read[1]);

for (const [name, sites] of declared) {
  const seen = new Map();
  for (const site of sites) {
    if (seen.has(site.block)) {
      problems.push(`${site.label}: "${site.path}" declares ${name} twice (the first value is dead)`);
    }
    seen.set(site.block, true);
  }
  /* Host `--dsw-*` aliases are read by the host's own components, so only the
     skin's own `--isl-*` scale has to be read here. */
  if (name.startsWith('--isl-') && !readNames.has(name)) {
    problems.push(`${sites[0].label}: ${name} is declared but never read`);
  }
}

if (problems.length > 0) {
  console.error(`check:css failed:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`check:css ok (${files.length} stylesheets)`);
}
