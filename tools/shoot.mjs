// Screenshot tool. Serves game/ on a free port, opens each staged ?shot= state in headless
// Chromium with software GL and no offsite requests, and writes 1280x720 JPEG screenshots.

import { createReadStream, mkdirSync, statSync, unlinkSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../game', import.meta.url)));
const outDir = resolve(fileURLToPath(new URL('../screenshots', import.meta.url)));
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
  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
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
const base = `http://127.0.0.1:${server.address().port}`;
const names = ['1-cover', '2-chase', '3-combat', '4-mission'];
const errors = [];
let browser;

mkdirSync(outDir, { recursive: true });
for (const starter of ['1-start.jpg', '2-play.jpg', '3-end.jpg']) {
  try {
    unlinkSync(join(outDir, starter));
  } catch {
    // already gone
  }
}

try {
  browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
      '--no-sandbox', '--disable-dev-shm-usage',
    ],
  });
  for (const name of names) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${name}: console: ${message.text()}`);
    });
    page.on('pageerror', (error) => errors.push(`${name}: pageerror: ${error.message}`));
    await page.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.protocol === 'data:' || url.hostname === '127.0.0.1') return route.continue();
      errors.push(`${name}: offsite request: ${route.request().url()}`);
      return route.abort();
    });
    await page.goto(`${base}/?shot=${name}&seed=7`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    await page.waitForTimeout(700);
    const framing = await page.evaluate(() => {
      const game = window.game;
      const point = (label, p, lift = 0) => {
        const frame = window.framePoint(p.x, p.y + lift, p.z);
        return `${label} x=${frame.x.toFixed(3)} y=${frame.y.toFixed(3)} ${frame.onScreen ? 'on' : 'off'}`
          + ` (world ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)})`;
      };
      const lines = [];
      const player = game.player;
      lines.push(point(player.inVehicle ? 'player(in car)' : 'player', player.position, 1));
      const car = player.vehicle ?? game.vehicles.find((v) => v.specId === 'coupe');
      if (car) lines.push(point(`player car(${car.specId})`, car.position, car.spec.height * 0.5));
      game.police.units.forEach((unit, i) => {
        lines.push(point(`police ${i + 1}(${unit.kind})`, unit.position,
          unit.kind === 'cruiser' ? 0.7 : 1));
      });
      return lines;
    });
    for (const line of framing) console.log(`${name}: ${line}`);
    const file = join(outDir, `${name}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 82 });
    console.log(`${name}.jpg ${statSync(file).size} bytes`);
    await page.close();
  }
} catch (error) {
  errors.push(`shoot: ${error.stack ?? error.message}`);
} finally {
  if (browser) await browser.close();
  await new Promise((done) => server.close(done));
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
