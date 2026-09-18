import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.keyboard.press('h');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'artifacts/expanded-camp-day.png' });
  // Real keyboard input only: skirt the RV on its north side, join the west road.
  async function walkTo(tx, tz) {
    for (let i = 0; i < 250; i++) {
      const { player: [x, , z] } = await page.evaluate(() => window.__pinefall.stats);
      if (Math.hypot(tx - x, tz - z) < .5) return;
      const held = [];
      if (Math.abs(tx - x) > .25) held.push(tx > x ? 'd' : 'a');
      if (Math.abs(tz - z) > .25) held.push(tz > z ? 's' : 'w');
      for (const key of held) await page.keyboard.down(key);
      await page.waitForTimeout(80);
      for (const key of held) await page.keyboard.up(key);
    }
    throw new Error(`Unable to reach ${tx}, ${tz}: ${JSON.stringify(await page.evaluate(() => window.__pinefall.stats))}`);
  }
  await walkTo(-7, -6.1);
  await walkTo(-12, 2.7);
  for (let x = -16; x >= -56; x -= 4) await walkTo(x, 6 + x * .19 + Math.sin(x * .13));
  await page.waitForTimeout(1200);
  const stats = await page.evaluate(() => window.__pinefall.stats);
  assert.ok(stats.player[0] < -50, 'Player actually crossed the old terrain boundary');
  assert.ok(stats.camera[0] < -35, 'Camera followed player into extension');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: 'artifacts/expanded-west-day.png' });
  await page.keyboard.press('n'); await page.waitForTimeout(7000);
  await page.screenshot({ path: 'artifacts/expanded-west-night.png' });
  console.log(JSON.stringify({ result: 'PASS', stats, errors }, null, 2));
} finally { await browser.close(); }
