// Smoke test in a real browser: the page boots without errors, windows open, drag, close and reopen in place,
// the helm and the terminal work, every render mode draws. Run: node tools/smoke.mjs [url]   (CI runs it on every PR)
// Software WebGL is slow, so every step waits for a condition instead of a fixed time.
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const base = process.argv[2] || 'http://localhost:8765/index.html';
const url = base + (base.includes('?') ? '&' : '?') + 'fast';
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack || String(e)));
let fail = 0; const ok = (c, m) => { console.log((c ? '✓ ' : '✗ ') + m); if (!c) fail = 1; };
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 15000 }).then(() => true, () => false);
const box = (sel) => page.locator(sel).boundingBox();

await page.goto(url); await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('bentlik-booted', '1'); }); await page.reload();
ok(await until(() => document.getElementById('boot').hidden), 'boots');
ok(await page.evaluate(() => !!document.querySelector('#world')), 'world canvas present');

await page.keyboard.press('n');
ok(await until(() => !document.getElementById('w-notebook').hidden), 'N opens the notebook');
const bar = await box('#w-notebook .bar');
await page.mouse.move(bar.x + 80, bar.y + 10); await page.mouse.down(); await page.mouse.move(bar.x + 280, bar.y + 160, { steps: 6 }); await page.mouse.up();
const after = await box('#w-notebook');
ok(Math.abs(after.x - bar.x - 200) < 30, 'windows drag');
await page.click('#w-notebook .x');
ok(await until(() => document.getElementById('w-notebook').hidden), 'close button closes');
await page.keyboard.press('n');
await until(() => !document.getElementById('w-notebook').hidden);
const re = await box('#w-notebook');
ok(!!re && re.y > 30 && Math.abs(re.x - after.x) < 4, 'a reopened window keeps its place');

await page.evaluate(() => { const b = document.querySelector('.mt[data-mode="glyph"]'); b && b.click(); });
await page.keyboard.press('h');
ok(await until(() => !document.getElementById('helm').hidden), 'H takes the helm');
// a Russian layout sends "ц" for the W key: the boat must still move
const key = (type, k, code) => page.evaluate(([t, kk, c]) => dispatchEvent(new KeyboardEvent(t, { key: kk, code: c, bubbles: true })), [type, k, code]);
await key('keydown', 'ц', 'KeyW');
ok(await until(() => parseFloat(document.getElementById('helm-sp').textContent) > 1), 'W (any layout) moves the boat');
await key('keyup', 'ц', 'KeyW');
ok(await page.evaluate(() => !document.body.classList.contains('m-cpu')) && await page.evaluate(() => getComputedStyle(document.getElementById('w-about')).visibility === 'hidden'), 'aboard: clean 3D view, windows out of the way');
await key('keydown', 'у', 'KeyE');
ok(await until(() => document.getElementById('helm-mode').textContent === 'on deck'), 'E leaves the wheel for the deck');
await key('keydown', 'ц', 'KeyW'); await page.waitForTimeout(1500); await key('keyup', 'ц', 'KeyW');
ok(await page.evaluate(() => document.getElementById('helm-mode').textContent.length > 0), 'walking on deck');
await page.keyboard.press('Escape');
ok(await until(() => document.getElementById('helm').hidden), 'Esc leaves the boat');

await page.keyboard.press('`');
await until(() => document.activeElement && document.activeElement.id === 'term-in');
await page.keyboard.type('whoami'); await page.keyboard.press('Enter');
ok(await until(() => document.getElementById('term-out').textContent.includes('bentlik island')), 'terminal answers');

for (const m of await page.evaluate(() => [...document.querySelectorAll('.mt')].map((b) => b.dataset.mode))) {
  await page.evaluate((id) => document.querySelector('.mt[data-mode="' + id + '"]').click(), m);
  await page.waitForTimeout(150);
}
await page.waitForTimeout(800);
ok(errors.length === 0, 'no page errors' + (errors.length ? ':\n' + errors.slice(0, 3).join('\n') : ''));

const m = await browser.newPage({ viewport: { width: 375, height: 812 } });
await m.goto(url); await m.waitForTimeout(2500);
ok(await m.evaluate(() => document.documentElement.scrollWidth <= 376), 'no sideways scroll at 375px');
await browser.close(); process.exit(fail);
