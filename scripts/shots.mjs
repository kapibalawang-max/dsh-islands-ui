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
import { spawnSync } from 'node:child_process';
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

/** Host chrome that renders live data (relative times, a task list that loads
 *  late). Comparing it would fail the gate on things the skin does not own, so
 *  these rectangles are excluded from the ratio and counted as unchanged. */
const VOLATILE = [
  { x: 1160, y: 590, w: 280, h: 310 }, // floating scheduled-task overlay
  { x: 0, y: 845, w: 70, h: 55 }, // rail footer avatar and its presence dot
];

const SECRET = process.env.DSH_AUTH_SECRET ?? '';

/** The web port is chosen per launch, so discover it instead of hard-coding one.
 *  Order: DSH_ORIGIN, the last origin this script found, then whatever local
 *  server answers with the shell's auth challenge. */
async function discoverOrigin() {
  if (process.env.DSH_ORIGIN) return process.env.DSH_ORIGIN;
  const cache = join(ROOT, '.shots-origin');
  const candidates = [];
  if (existsSync(cache)) candidates.push(readFileSync(cache, 'utf8').trim());
  const lsof = spawnSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], { encoding: 'utf8' });
  for (const line of (lsof.stdout ?? '').split('\n')) {
    const m = /127\.0\.0\.1:(\d+)/.exec(line);
    if (m && !candidates.includes(`http://127.0.0.1:${m[1]}`)) candidates.push(`http://127.0.0.1:${m[1]}`);
  }
  for (const origin of candidates) {
    try {
      const res = await fetch(origin + '/', { signal: AbortSignal.timeout(1200) });
      const text = await res.text();
      if (res.status === 401 && text.includes('dsh web authentication')) {
        writeFileSync(cache, origin);
        return origin;
      }
    } catch {
      /* not this one */
    }
  }
  throw new Error('no DSH web server found; set DSH_ORIGIN (e.g. http://127.0.0.1:61287)');
}

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

let ORIGIN = process.env.DSH_ORIGIN ?? '';

const shots = [
  {
    name: 'main',
    mask: VOLATILE,
    async setup(page) {
      await page.goto(ORIGIN, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-islands-ui]', { timeout: 15000 });
    },
  },
  {
    name: 'dark',
    mask: VOLATILE,
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
    mask: VOLATILE,
    async setup(page) {
      await page.goto(`${ORIGIN}/?islands-debug=1`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.isl-debug', { timeout: 15000 });
      await page.waitForTimeout(900);
    },
  },
];

ORIGIN = await discoverOrigin();

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
  const diff = new PNG({ width: a.width, height: a.height });
  pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1, diffMask: true });
  const masks = shot.mask ?? [];
  const inside = (x, y) => masks.some((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
  let changed = 0;
  let compared = 0;
  for (let y = 0; y < a.height; y += 1) {
    for (let x = 0; x < a.width; x += 1) {
      if (inside(x, y)) continue;
      compared += 1;
      if (diff.data[(y * a.width + x) * 4 + 3] !== 0) changed += 1;
    }
  }
  const ratio = compared === 0 ? 0 : changed / compared;
  const verdict = ratio > TOLERANCE ? 'DIFF' : 'ok';
  if (verdict === 'DIFF') failed += 1;
  console.log(`${shot.name}: ${verdict} ${(ratio * 100).toFixed(3)}% pixels (${changed})`);
}

await browser.close();
if (failed > 0) {
  console.error(`${failed} surface(s) changed; rerun with --update once the change is intended`);
  process.exit(1);
}