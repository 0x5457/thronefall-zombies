import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1404, height: 1080 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  const first = await stats();
  assert.ok(first.triangles > 200000, 'batched forest/terrain still submitted for rendering');
  assert.equal(first.windStrength, 1);
  await page.keyboard.press('h');
  await page.screenshot({ path: 'artifacts/breathing-day-a.png' });
  await page.waitForFunction((t) => window.__pinefall.stats.ambientTime > t + 2, first.ambientTime);
  const later = await stats();
  assert.notEqual(later.wireZ, first.wireZ, 'string lights sway');
  await page.screenshot({ path: 'artifacts/breathing-day-b.png' });
  await page.keyboard.press('p');
  const paused = await stats();
  await page.waitForTimeout(500);
  assert.equal((await stats()).ambientTime, paused.ambientTime, 'pause freezes ambience');
  await page.keyboard.press('p');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.__pinefall.stats.windStrength === 0);
  const reduced = await stats();
  await page.waitForTimeout(500);
  const still = await stats();
  assert.equal(still.ambientTime, reduced.ambientTime);
  assert.equal(still.wireZ, 2, 'wire returns to rest');
  assert.equal(still.fireIntensity, reduced.fireIntensity, 'no fire flicker');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction((t) => window.__pinefall.stats.ambientTime > t, reduced.ambientTime);
  await page.keyboard.press('n');
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'artifacts/breathing-night.png' });
  assert.equal(await page.evaluate(() => window.__pinefall.state.phase), 'night');
  assert.deepEqual(errors, [], 'no JS or shader compilation errors');
  console.log(JSON.stringify({ result: 'PASS', first, later, errors }, null, 2));
} finally {
  await browser.close();
}
