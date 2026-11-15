#!/usr/bin/env node
/**
 * Visual snapshots for the skin — a dev tool, not a package dependency.
 *
 *   DSH_AUTH_SECRET=$(cat /tmp/islprobe/secret) npm run shots
 *   ... -- --update   rewrite the baselines after an intended change
 *
 * It borrows playwright, pngjs and pixelmatch from the desktop profile, signs
 * the same `dsh-auth` cookie the web shell expects, and writes one PNG per
 * surface into `shots/`. When `shots/baseline/` holds a previous image, the
 * run reports the changed-pixel ratio and fails above SHOT_TOLERANCE
 * (default 0.2%).
 */
import { createRequire } from 'node:module';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createHmac } from 'node:crypto';

const PROFILE = '/Users/capy/.dsh/profiles/desktop/node_modules/';
const requireFromProfile = createRequire(PROFILE);
const { chromium } = requireFromProfile('playwright');
const { PNG } = requireFromProfile('pngjs');
const pixelmatch = requireFromProfile('pixelmatch');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = join(ROOT, 'shots');
const BASE = join(SHOTS, 'baseline');
const TOLERANCE = Number(process.env.SHOT_TOLERANCE ?? '0.002');
const UPDATE = process.argv.includes('--update');

const ORIGIN = process.env.DSH_ORIGIN ?? 'http://127.0.0.1:55574';
const SECRET = process.env.DSH_AUTH_SECRET ?? '';

if (SECRET === '') {
  console.error('set DSH_AUTH_SECRET (the browser-session secret) before running shots');
  process.exit(2);
}

/** The web shell only accepts a cookie signed with the decoded session secret. */
function authCookie() {
  const authority = new URL(ORIGIN).host;
  const key = Buffer.from(SECRET, 'base64url');
  const name = `dsh-auth-${createHash('sha256').update(authority).digest('base64url')}`;
  const now = Date.now();
  const body = Buffer.from(
    JSON.stringify({ version: 1, authority, issuedAt: now, expiresAt: now + 10 * 60 * 1000 }),
  ).toString('base64url');
  const mac = createHmac('sha256', key).update(body).digest('base64url');
  return { name, value: `v1.${body}.${mac}`, url: ORIGIN };
}

const shots = [
  {
    name: 'main',
    async setup(page) {
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-islands-ui]', { timeout: 15000 });
    },
  },
  {
    name: 'dark',
    async setup(page) {
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-islands-ui]', { timeout: 15000 });
      await page.evaluate(() => document.body.setAttribute('data-ds-dark-theme', ''));
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'palette',
    async setup(page) {
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-islands-ui]', { timeout: 15000 });
      await page.keyboard.press('Meta+k');
      await page.waitForSelector('.isl-paletteCard', { timeout: 5000 });
      await page.waitForTimeout(250);
    },
  },
  {
    name: 'debug',
    async setup(page) {
      await page.goto(`${ORIGIN}/?islands-debug=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.isl-debug', { timeout: 15000 });
      await page.waitForTimeout(900);
    },
  },
];

mkdirSync(BASE, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([authCookie()]);
const page = await context.newPage();

// Freeze motion so a diff means the skin changed, not that a spinner was mid-frame.
const STILL = '*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }';
const settle = async () => {
  await page.addStyleTag({ content: STILL });
  await page.waitForTimeout(120);
};

let failed = 0;
for (const shot of shots) {
  await shot.setup(page);
  await settle();
  const buffer = await page.screenshot({ type: 'png' });
  const file = join(SHOTS, `${shot.name}.png`);
  writeFileSync(file, buffer);

  const basePath = join(BASE, `${shot.name}.png`);
  if (!existsSync(basePath) || UPDATE) {
    writeFileSync(basePath, buffer);
    console.log(`${shot.name}: baseline written (${buffer.length} bytes)`);
    continue;
  }

  const a = PNG.sync.read(buffer);
  const b = PNG.sync.read(readFileSync(basePath));
  if (a.width !== b.width || a.height !== b.height) {
    console.log(`${shot.name}: size changed ${b.width}x${b.height} → ${a.width}x${a.height}`);
    failed += 1;
    continue;
  }
  const diff = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
  const ratio = diff / (a.width * a.height);
  const verdict = ratio > TOLERANCE ? 'DIFF' : 'ok';
  if (verdict === 'DIFF') failed += 1;
  console.log(`${shot.name}: ${verdict} ${(ratio * 100).toFixed(3)}% pixels (${diff})`);
}

await browser.close();
if (failed > 0) {
  console.error(`${failed} surface(s) changed; rerun with --update once the change is intended`);
  process.exit(1);
}