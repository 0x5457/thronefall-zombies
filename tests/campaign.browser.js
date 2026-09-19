import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  const game = () =>
    page.evaluate(() => ({ ...window.__pinefall.state, ...window.__pinefall.stats }));
  const camera = new OrthographicCamera(-23 * 1.44, 23 * 1.44, 23, -23, 0.1, 260);
  camera.position.set(2, 46, 37);
  camera.lookAt(0, 0, -0.3);
  camera.updateMatrixWorld();
  async function build(x, z) {
    await page.click('[data-build="tower"]');
    const p = new Vector3(x, 0, z).project(camera);
    await page.mouse.move((p.x + 1) * 720, (1 - p.y) * 500);
    await page.waitForTimeout(100);
    assert.ok(
      !(await page.locator('#world-label').getAttribute('class')).includes('invalid'),
      `valid tower at ${x},${z}`,
    );
    await page.mouse.down();
    await page.mouse.up();
  }
  await build(-2, -8);
  await build(8, 2);
  assert.equal((await game()).buildings, 2);
  await page.screenshot({ path: 'artifacts/campaign-preparation.png' });
  await page.keyboard.press('n');
  await page.keyboard.press('n');
  assert.equal((await game()).phase, 'night', 'N cannot skip living enemies');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'artifacts/campaign-first-night.png' });
  await page.waitForFunction(
    () => window.__pinefall.state.perkPending || window.__pinefall.state.over,
    null,
    { timeout: 240000 },
  );
  const dawn = await game();
  console.log('first dawn', dawn);
  assert.equal(dawn.over, false, 'real defense survived');
  assert.equal(dawn.kills, 10);
  assert.equal(dawn.day, 2);
  assert.equal(await page.locator('#perk-options button').count(), 4);
  assert.equal(dawn.paused, true);
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  await page.keyboard.press('p');
  await page.keyboard.down('d');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  assert.equal((await game()).elapsed, dawn.elapsed);
  assert.deepEqual((await game()).player, dawn.player);
  assert.equal(await page.locator('#perk-dialog').evaluate((d) => d.open), true);
  await page.screenshot({ path: 'artifacts/campaign-dawn.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'artifacts/campaign-dawn-mobile.png' });
  assert.ok(
    await page
      .locator('#perk-dialog')
      .evaluate((d) => d.getBoundingClientRect().right <= innerWidth),
  );
  await page.locator('[data-perk="marksman"]').focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__pinefall.state.paused);
  assert.deepEqual((await game()).perks, ['marksman']);
  assert.equal((await game()).perkPending, false);
  assert.match(await page.locator('#owned-perks').textContent(), /林地神射手/);
  await page.keyboard.press('n');
  assert.equal((await game()).phase, 'night');
  assert.equal((await game()).remaining, 16);
  assert.deepEqual(errors, []);
  console.log(
    'PASS: real first-night defense → modal/input lock → keyboard reward → second night; no state injection',
  );
} finally {
  await browser.close();
}
