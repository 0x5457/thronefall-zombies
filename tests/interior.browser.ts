import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1404, height: 1080 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  async function walk(x: number, z: number) {
    for (let i = 0; i < 240; i++) {
      const s = await stats();
      const [px, , pz] = s.player;
      const dx = x - px,
        dz = z - pz;
      if (Math.hypot(dx, dz) < 0.28) return;
      // Press duration shrinks with distance; a fixed burst oscillates behind obstacles.
      const speed = s.inside ? 2.2 : 5.1;
      const held: string[] = [];
      if (Math.abs(dx) > 0.12) held.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dz) > 0.12) held.push(dz > 0 ? 's' : 'w');
      for (const k of held) await page.keyboard.down(k);
      await page.waitForTimeout(Math.max(24, (Math.hypot(dx, dz) / speed) * 1000 - 20));
      for (const k of held) await page.keyboard.up(k);
      await page.waitForTimeout(30);
    }
    assert.fail(`unable to reach ${x},${z}: ${JSON.stringify(await stats())}`);
  }
  await page.keyboard.press('e');
  assert.equal((await stats()).inside, false, 'cannot enter remotely');
  await walk(5.8, -6.1);
  await walk(5.8, 1.5);
  await walk(0, 1.3);
  await page.waitForSelector('#rv-door:not([hidden])');
  const outside = (await stats()).player;
  await page.screenshot({ path: 'artifacts/rv-door-day.png' });
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => window.__pinefall.stats.transitioning && window.__pinefall.stats.viewZoom > 1.02,
  );
  const transitionBudget = await page.evaluate(() => window.__pinefall.state.elapsed);
  await page.keyboard.press('e');
  await page.keyboard.press('n');
  await page.keyboard.press('2');
  await page.screenshot({ path: 'artifacts/rv-enter-transition.png' });
  await page.waitForFunction(
    () => window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning,
  );
  assert.equal(
    await page.evaluate(() => window.__pinefall.state.elapsed),
    transitionBudget,
    'transition freezes budget',
  );
  assert.equal((await stats()).viewZoom, 1, 'camera settles at original zoom');
  await page.waitForFunction(() => window.__pinefall.audio.phase === 'interior', null, {
    timeout: 10000,
  });
  assert.equal(await page.evaluate(() => window.__pinefall.audio.context), 'running');
  const elapsed = await page.evaluate(() => window.__pinefall.state.elapsed);
  await page.keyboard.press('n');
  await page.keyboard.press('2');
  await page.mouse.click(600, 420);
  await page.waitForTimeout(600);
  assert.equal(await page.evaluate(() => window.__pinefall.state.elapsed), elapsed);
  assert.equal(await page.evaluate(() => window.__pinefall.state.phase), 'day');
  assert.equal((await stats()).buildings, 0);
  await walk(2.3, 0.85);
  await page.keyboard.down('w');
  await page.waitForTimeout(800);
  await page.keyboard.up('w');
  assert.ok((await stats()).player[2] >= 0.12, 'cannot walk into furniture');
  await page.waitForTimeout(3400); // Let the input-guard toast clear before art captures.
  await page.screenshot({ path: 'artifacts/rv-interior.png' });
  await page.keyboard.press('h');
  await page.screenshot({ path: 'artifacts/rv-details-light-on.png' });
  await page.keyboard.press('h');
  await page.locator('#rv-lamp').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#rv-lamp').getAttribute('aria-pressed'), 'false');
  assert.equal((await stats()).lampOn, false, 'scene light actually off after toggle');
  await page.keyboard.press('h');
  await page.screenshot({ path: 'artifacts/rv-details-light-off.png' });
  await page.keyboard.press('h');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.screenshot({ path: 'artifacts/rv-details-720.png' });
  await page.setViewportSize({ width: 1404, height: 1080 });
  await page.keyboard.press('p');
  await page.locator('#rv-lamp').click();
  assert.equal(
    await page.locator('#rv-lamp').getAttribute('aria-pressed'),
    'false',
    'pause blocks lamp interaction',
  );
  assert.equal((await stats()).lampOn, false, 'scene light unchanged under pause');
  await page.keyboard.press('e');
  assert.equal((await stats()).inside, true, 'paused interaction blocked');
  await page.keyboard.press('p');
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning,
  );
  assert.deepEqual((await stats()).player, outside, 'returns to exact door-side position');
  await page.waitForFunction(() => window.__pinefall.audio.phase === 'day', null, {
    timeout: 10000,
  });
  assert.equal(await page.evaluate(() => window.__pinefall.audio.context), 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#rv-door').click();
  assert.equal((await stats()).transitioning, false, 'reduced motion skips camera travel');
  await page.waitForFunction(
    () => window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning,
  );
  assert.equal(
    await page.locator('#rv-lamp').getAttribute('aria-pressed'),
    'false',
    'lamp choice survives exit/reentry',
  );
  assert.equal((await stats()).lampOn, false, 'scene light state survives exit/reentry');
  await page.locator('#rv-lamp').click();
  assert.equal(await page.locator('#rv-lamp').getAttribute('aria-pressed'), 'true');
  assert.equal((await stats()).lampOn, true, 'scene light back on');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/rv-interior-mobile.png' });
  await page.locator('#leave-rv').click();
  await page.waitForFunction(() => !window.__pinefall.stats.transitioning);
  await page.keyboard.press('n');
  await page.keyboard.press('e');
  assert.equal((await stats()).inside, false, 'night entry rejected');
  await page.setViewportSize({ width: 1404, height: 1080 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'artifacts/rv-door-night.png' });
  assert.deepEqual(errors, []);
  console.log(
    'PASS: RV door, interior music active, outdoor music restored, movement, budget freeze, input guards, return, narrow viewport, night denial',
  );
} finally {
  await browser.close();
}
