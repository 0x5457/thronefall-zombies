import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
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
  async function build(x: number, z: number) {
    await page.click('[data-build="tower"]');
    const p = new Vector3(x, 0, z).project(camera);
    await page.mouse.move((p.x + 1) * 720, (1 - p.y) * 500);
    await page.waitForTimeout(100);
    assert.ok(
      !(await page.locator('#world-label').getAttribute('class'))!.includes('invalid'),
      `valid tower at ${x},${z}`,
    );
    await page.mouse.down();
    await page.mouse.up();
  }
  async function takeMill() {
    const before = await page.evaluate(() => window.__pinefall.state.wood);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
    await page.locator('[data-manual-tab="expedition"]').click();
    await page.locator('.manual-card:has-text("旧伐木场") button').click();
    await page.waitForFunction((wood) => window.__pinefall.state.wood >= wood, before + 35);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused,
    );
  }
  async function walkTo(tx: number, tz: number) {
    for (let i = 0; i < 220; i++) {
      const {
        player: [x, , z],
      } = await page.evaluate(() => window.__pinefall.stats);
      if (Math.hypot(tx - x, tz - z) < 0.6) return;
      const held: string[] = [];
      if (Math.abs(tx - x) > 0.3) held.push(tx > x ? 'd' : 'a');
      if (Math.abs(tz - z) > 0.3) held.push(tz > z ? 's' : 'w');
      for (const key of held) await page.keyboard.down(key);
      await page.waitForTimeout(80);
      for (const key of held) await page.keyboard.up(key);
    }
    throw new Error(`walkTo failed ${tx},${tz}`);
  }
  async function gatherLog() {
    await walkTo(10, -7);
    for (let swing = 1; swing <= 3; swing++) {
      await page.waitForFunction(
        () => !window.__pinefall.stats.collecting && window.__pinefall.stats.collectCooldown === 0,
      );
      await page.keyboard.press('e');
      await page.waitForFunction((wood) => window.__pinefall.state.wood === wood, 25 + swing * 10, {
        timeout: 5000,
      });
    }
  }
  // ECO-01: 25 wood cannot buy two towers (70). The mill haul (+35) plus one full log (+30) fund both.
  await takeMill();
  await build(-2, -8);
  await gatherLog();
  await build(8, 2);
  assert.equal((await game()).buildings, 2);
  await page.screenshot({ path: 'artifacts/campaign-preparation.png' });
  await page.evaluate(() => window.__pinefall.setSpeed(20));
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
  assert.equal(
    await page.locator('#perk-dialog').evaluate((d) => (d as HTMLDialogElement).open),
    true,
  );
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
  assert.match((await page.locator('#owned-perks').textContent())!, /林地神射手/);
  // Back to 1x so the spawn schedule has not already consumed part of the 16-enemy wave.
  await page.evaluate(() => window.__pinefall.setSpeed(1));
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
