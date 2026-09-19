import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const URL = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan'],
});
try {
  await mkdir('artifacts', { recursive: true });
  // Reduced motion must default the shake option off without any stored preference.
  const calm = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    reducedMotion: 'reduce',
  });
  await calm.goto(URL);
  await calm.waitForSelector('#loading.done', { timeout: 60000 });
  assert.equal(
    await calm.evaluate(() => window.__pinefall.stats.shakeEnabled),
    false,
    'reduced-motion defaults shake off',
  );
  await calm.close();

  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  const state = () => page.evaluate(() => window.__pinefall.state);

  assert.equal((await stats()).shakeEnabled, true, 'shake defaults on without reduced motion');
  await page.locator('#shake').click();
  assert.equal((await stats()).shakeEnabled, false);
  assert.equal(await page.locator('#shake').getAttribute('aria-pressed'), 'false');
  await page.reload();
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  assert.equal((await stats()).shakeEnabled, false, 'shake choice persists');
  await page.locator('#shake').click();
  assert.equal((await stats()).shakeEnabled, true);
  await page.screenshot({ path: 'artifacts/feel-day.png' });

  await page.evaluate(() => window.__pinefall.setSpeed(10));
  await page.keyboard.press('n');
  assert.equal((await state()).phase, 'night');
  await page.waitForFunction(() => window.__pinefall.stats.muzzleFlashes > 0, null, {
    timeout: 90000,
  });
  await page.waitForFunction(() => window.__pinefall.stats.flashes > 0, null, { timeout: 90000 });
  await page.waitForFunction(() => window.__pinefall.stats.dying > 0, null, { timeout: 90000 });
  await page.screenshot({ path: 'artifacts/feel-night-kill.png' });
  await page.waitForFunction(() => window.__pinefall.stats.deaths >= 3, null, { timeout: 90000 });
  const peak = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let max = 0;
        const start = performance.now();
        (function sample() {
          max = Math.max(max, window.__pinefall.stats.trauma);
          if (performance.now() - start > 3000) resolve(max);
          else requestAnimationFrame(sample);
        })();
      }),
  );
  const fx = await stats();
  console.log('feel stats', fx);
  assert.ok(fx.muzzleFlashes > 0, 'muzzle flashes fired');
  assert.ok(fx.flashes > 0, 'enemies flashed on hit');
  assert.ok(fx.knockbacks > 0, 'surviving enemies were knocked back');
  assert.ok(fx.recoils > 0, 'player rifle recoiled');
  assert.ok(fx.hitStops > 0, 'hit-stop triggered on kills');
  assert.ok(fx.deaths >= 3, 'kills happened');
  assert.ok(peak > 0, 'kill trauma moved the camera');
  assert.ok(fx.shakeFrames > 0, 'camera shake ran');
  await page.screenshot({ path: 'artifacts/feel-night-combat.png' });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real night combat shows muzzle flash, hit flash, knockback, rifle recoil, death animation, hit-stop and camera shake; shake toggle persists and respects reduced-motion',
  );
} finally {
  await browser.close();
}
