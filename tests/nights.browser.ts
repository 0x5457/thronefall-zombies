import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('#loading.done', { timeout: 60000 });

  // NGT-01/03: the intel page must explain tonight's problem, environment and intents.
  await page.keyboard.press('Tab');
  await page.locator('[data-manual-tab="intel"]').click();
  await page.waitForSelector('#manual-dialog[open]');
  const intel = (await page.locator('#manual-page').textContent())!;
  assert.match(intel, /第 1 夜 · 林间脚步/);
  assert.match(intel, /单路来袭/);
  assert.match(intel, /应对建议/);
  assert.match(intel, /游荡者 ×10/);
  assert.match(intel, /北径 · 突击/);
  await page.screenshot({ path: 'artifacts/nights-intel.png' });
  await page.keyboard.press('Tab');

  // The tutorial night still plays out with the real spawn plan and combat feedback.
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.stats.muzzleFlashes > 0, null, {
    timeout: 90000,
  });
  await page.waitForFunction(() => window.__pinefall.stats.deaths >= 1, null, { timeout: 90000 });
  const stats = await page.evaluate(() => window.__pinefall.stats);
  assert.equal(stats.fog, 0, 'night 1 has no fog');
  assert.equal(stats.hidden, 0, 'nothing is hidden on a clear night');
  assert.ok(stats.enemyTypes.walker! > 0, 'night 1 spawns walkers');
  assert.ok(
    !stats.enemyTypes.spitter && !stats.enemyTypes.stalker,
    'new types stay in later nights',
  );
  await page.screenshot({ path: 'artifacts/nights-first-night.png' });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: intel explains the night lesson/intents; night 1 runs on the real plan with no new-type leakage',
  );
} finally {
  await browser.close();
}
