// Local QA gate. Serves game/ on a free port, opens it in headless Chromium with every request
// outside localhost blocked, scripts a few seconds of input, and fails on console errors, failed
// requests or a renderer that produced no draw calls. Usage: node tools/smoke.mjs

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end('bad request');
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = resolve(join(root, normalize(pathname)));
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error('not a file');
  } catch {
    response.writeHead(404).end('not found');
    return;
  }
  response.writeHead(200, {
    'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

await new Promise((done) => server.listen(0, '127.0.0.1', done));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;
const errors = [];
const offsite = [];
let browser;

function observe(page, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`${label}: console: ${message.text()}`);
  });
  page.on('pageerror', (error) => {
    errors.push(`${label}: pageerror: ${error.message}`);
    process.exitCode = 1;
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).hostname === '127.0.0.1') errors.push(`${label}: request: ${request.url()}`);
  });
  return page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol === 'data:' || url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
      return route.continue();
    }
    offsite.push(`${label}: ${route.request().url()}`);
    return route.abort();
  });
}

function snapshot(page) {
  return page.evaluate(() => ({
    ready: window.__velamar?.ready === true,
    state: window.game?.state,
    inVehicle: window.game?.player?.inVehicle === true,
    ...window.__velamar?.stats,
  }));
}

function checkFrame(label, stats) {
  if (!stats.ready) errors.push(`${label}: __velamar.ready was never published`);
  if (!stats.frames || stats.frames < 3) errors.push(`${label}: too few frames (${stats.frames})`);
  if (!stats.drawCalls) errors.push(`${label}: renderer produced no draw calls`);
  if (!stats.triangles) errors.push(`${label}: renderer produced no triangles`);
}

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--no-sandbox', '--disable-dev-shm-usage',
    ],
  });

  for (const name of ['1-cover', '2-chase', '3-combat', '4-mission']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await observe(page, name);
    await page.goto(`${base}/?seed=7&shot=${name}`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__velamar?.ready === true, null, { timeout: 25000 });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 25000 });
    checkFrame(name, await snapshot(page));
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await observe(page, 'play');
  await page.goto(`${base}/?seed=7`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__velamar?.ready === true, null, { timeout: 25000 });
  const before = await snapshot(page);
  await page.keyboard.press('Enter');
  await page.keyboard.down('w');
  await page.keyboard.down('Shift');
  await page.keyboard.press('Space');
  await page.keyboard.press('e');
  await page.waitForTimeout(1300);
  await page.keyboard.up('Shift');
  await page.keyboard.up('w');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  await page.keyboard.press('Escape');
  await page.mouse.move(640, 360);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const after = await snapshot(page);
  checkFrame('play', after);
  if (before.state !== 'menu') errors.push(`play: expected menu at boot, got ${before.state}`);
  if (after.state !== 'play') errors.push(`play: expected play after input, got ${after.state}`);
  if (after.frames <= before.frames) errors.push('play: the frame loop did not advance');
  const image = await page.screenshot({ type: 'jpeg', quality: 60 });
  if (image.length < 2000) errors.push(`play: screenshot is blank (${image.length} bytes)`);
  const report = {
    port,
    boot: before,
    play: after,
    screenshotBytes: image.length,
    consoleErrors: errors,
    offsiteRequests: offsite,
  };
  console.log(JSON.stringify(report, null, 2));
  await page.close();
} catch (error) {
  errors.push(`smoke: ${error.stack ?? error.message}`);
  console.log(JSON.stringify({ consoleErrors: errors, offsiteRequests: offsite }, null, 2));
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}

if (errors.length || offsite.length) process.exitCode = 1;
