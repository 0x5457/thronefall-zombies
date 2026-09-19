import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';

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
  const game = () =>
    page.evaluate(() => ({ ...window.__pinefall.state, ...window.__pinefall.stats }));
  const camera = new OrthographicCamera(-23 * 1.44, 23 * 1.44, 23, -23, 0.1, 260);
  camera.position.set(2, 46, 37);
  camera.lookAt(0, 0, -0.3);
  camera.updateMatrixWorld();
  async function build(type: string, x: number, z: number) {
    await page.click(`[data-build="${type}"]`);
    const p = new Vector3(x, 0, z).project(camera);
    await page.mouse.move((p.x + 1) * 720, (1 - p.y) * 500);
    await page.waitForTimeout(80);
    const label = await page.locator('#world-label').getAttribute('class');
    assert.ok(!label!.includes('invalid'), `${type} valid at ${x},${z}`);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(80);
  }
  async function perk(id: string) {
    await page.waitForFunction(() => window.__pinefall.state.perkPending, null, {
      timeout: 300000,
    });
    const summary = await page.locator('#perk-summary').textContent();
    assert.match(summary!, /评分 [SABC]（\d+）/, 'dawn shows a rating with its score');
    const rating = await page.evaluate(() => window.__pinefall.stats.rating);
    assert.ok(
      rating &&
        rating.score >= 0 &&
        rating.score <= 100 &&
        ['S', 'A', 'B', 'C'].includes(rating.grade),
    );
    await page.locator(`[data-perk="${id}"]`).click();
    await page.waitForFunction(() => !window.__pinefall.state.perkPending);
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
      const before = await page.evaluate(() => window.__pinefall.state.wood);
      await page.keyboard.press('e');
      await page.waitForFunction((wood) => window.__pinefall.state.wood >= wood, before + 10, {
        timeout: 5000,
      });
    }
  }
  // Night 1 (ECO-01): the mill haul plus one full log fund two towers (70 wood).
  await takeMill();
  await gatherLog();
  await build('tower', -2, -8);
  await build('tower', 8, 2);
  await page.evaluate(() => window.__pinefall.setSpeed(10));
  await page.keyboard.press('n');
  await perk('marksman');
  // Night 2: add a west tower for the runner lane.
  await takeMill();
  await build('tower', -9, -6);
  await page.keyboard.press('n');
  await perk('engineer');
  // Night 3: one more tower, then observe siege + spit behavior.
  await takeMill();
  await build('tower', 4, -6);
  await page.keyboard.press('n');
  const max = { sieging: 0, spits: 0, hidden: 0 };
  let shot = false;
  for (let i = 0; i < 500; i++) {
    const s = await game();
    max.sieging = Math.max(max.sieging, s.sieging);
    max.spits = Math.max(max.spits, s.spits);
    max.hidden = Math.max(max.hidden, s.hidden);
    if (!shot && s.sieging > 0 && s.spits > 0) {
      await page.screenshot({ path: 'artifacts/nights-siege.png' });
      shot = true;
    }
    if (s.over || s.perkPending) break;
    await page.waitForTimeout(400);
  }
  const end = await game();
  console.log('night 3 result', {
    max,
    day: end.day,
    health: end.health,
    over: end.over,
    kills: end.kills,
    deaths: end.deaths,
  });
  assert.ok(max.sieging > 0, 'brutes targeted towers during the siege night');
  assert.ok(max.spits > 0, 'spitters launched corrosive spit');
  if (!shot) await page.screenshot({ path: 'artifacts/nights-siege.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: night 3 integration shows brute siege targeting and ranged spit');
} finally {
  await browser.close();
}
