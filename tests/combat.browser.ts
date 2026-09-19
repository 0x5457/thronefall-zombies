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
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  const state = () => page.evaluate(() => window.__pinefall.state);
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  const camera = new OrthographicCamera(-23 * 1.44, 23 * 1.44, 23, -23, 0.1, 260);
  camera.position.set(2, 46, 37);
  camera.lookAt(0, 0, -0.3);
  camera.updateMatrixWorld();
  const clickWorld = async (x: number, z: number) => {
    const p = new Vector3(x, 0, z).project(camera);
    await page.mouse.click((p.x + 1) * 720, (1 - p.y) * 500);
  };
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
    throw new Error(
      `walkTo failed ${tx},${tz}: ${JSON.stringify(await page.evaluate(() => window.__pinefall.stats.player))}`,
    );
  }

  // RV loop: the portable workbench is now the gate for weapon unlocks and the nightly mod.
  await walkTo(5.2, -6);
  await walkTo(5.4, 1.6);
  await walkTo(0.7, 1.5);
  await page.keyboard.press('e');
  await page.waitForFunction(
    () => window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning,
    null,
    { timeout: 15000 },
  );
  await page.waitForSelector('[data-rv-install="workbench"]');
  await page.screenshot({ path: 'artifacts/combat-rv-slots.png' });
  await page.locator('[data-rv-install="workbench"]').click();
  await page.waitForFunction(() => window.__pinefall.stats.rv.includes('workbench'));
  await page.locator('[data-rv-mod="power"]').click();
  await page.waitForFunction(() => window.__pinefall.stats.weaponMod === 'power');
  const geared = await stats();
  assert.equal(geared.playerDamage, 3, 'nightly mod raises carbine damage');
  assert.equal((await state()).wood, 55);
  assert.equal((await state()).scrap, 4);
  await page.locator('#leave-rv').click();
  await page.waitForFunction(
    () => !window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning,
    null,
    { timeout: 15000 },
  );

  // Camp manual: expedition funds the workshop, then the rifle is unlocked and equipped.
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
  assert.equal((await state()).paused, true, 'manual freezes preparation time');
  await page.screenshot({ path: 'artifacts/combat-manual-workshop.png' });
  await page.locator('[data-manual-tab="expedition"]').click();
  const beforeTrip = (await state()).elapsed;
  await page.locator('.manual-card:has-text("山脊中继站") button').click();
  await page.waitForFunction(() => window.__pinefall.state.scrap === 16);
  const trip = await state();
  const spent = trip.elapsed - beforeTrip;
  assert.ok(spent >= 50 && spent < 53, `expedition consumes 50s of daylight (spent ${spent})`);
  assert.equal(trip.playerHp, 80, 'the ridge trip injures the scout');
  await page.locator('[data-manual-tab="workshop"]').click();
  await page.locator('.manual-card:has-text("猎人步枪") button').click();
  await page.waitForFunction(() => window.__pinefall.state.weapon === 'rifle');
  const armed = await state();
  assert.equal(armed.scrap, 6);
  assert.deepEqual(armed.unlocked, ['carbine', 'rifle']);
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused,
  );
  assert.equal((await state()).paused, false, 'closing the manual resumes the day');

  // Active abilities: dash spends stamina, flare starts its cooldown, medkit heals once.
  const before = (await stats()).player;
  await page.keyboard.press('Shift');
  await page.waitForTimeout(360);
  const dashed = await stats();
  assert.ok(
    Math.hypot(dashed.player[0] - before[0], dashed.player[2] - before[2]) > 0.8,
    'dash moved the player',
  );
  assert.ok(dashed.stamina < 100, 'dash spent stamina');
  await page.keyboard.press('q');
  await page.waitForFunction(() => window.__pinefall.stats.flareActive);
  assert.ok((await stats()).flareCooldown > 24, 'flare started its cooldown');
  await page.keyboard.press('f');
  await page.waitForFunction(() => window.__pinefall.state.playerHp === 100);
  assert.equal((await state()).medkits, 1, 'medkit consumed once');
  await page.keyboard.press('f');
  await page.waitForTimeout(150);
  assert.equal((await state()).medkits, 1, 'full health refuses to waste a medkit');

  // Building interaction: place, select, upgrade, refuse useless repair, dismantle with refund.
  await page.click('[data-build="fence"]');
  await clickWorld(-6, -6);
  await page.waitForFunction(() => window.__pinefall.stats.buildings === 1);
  assert.deepEqual((await stats()).buildingLevels, ['fence:1:150']);
  await clickWorld(-6, -6);
  await page.waitForFunction(() => window.__pinefall.stats.selectedBuilding === 'fence');
  assert.equal(await page.locator('#building-panel').isVisible(), true);
  await page.screenshot({ path: 'artifacts/combat-building-panel.png' });
  assert.equal(
    await page.locator('#building-repair').isDisabled(),
    true,
    'full structure needs no repair',
  );
  await page.locator('#building-upgrade').click();
  await page.waitForFunction(() =>
    window.__pinefall.stats.buildingLevels[0]?.startsWith('fence:2'),
  );
  const upgraded = await state();
  assert.equal(upgraded.scrap, 2, 'upgrade costs 20 wood + 4 scrap');
  assert.equal(await page.locator('#building-dismantle').isEnabled(), true);
  const woodBefore = upgraded.wood;
  await page.locator('#building-dismantle').click();
  await page.waitForFunction(() => window.__pinefall.stats.buildings === 0);
  assert.equal((await state()).wood, woodBefore + 21, 'dismantle refunds 60% of 35 invested wood');
  assert.equal((await state()).scrap, 4);
  assert.equal(await page.locator('#building-panel').isVisible(), false);

  // The typed wave reaches the lane with walkers, and the day/night views stay readable.
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  assert.equal((await state()).paused, false);
  await page.waitForFunction(() => window.__pinefall.stats.enemies > 0, null, { timeout: 30000 });
  const night = await stats();
  assert.ok(night.enemyTypes.walker! >= 1, 'first night spawns walkers through the lane');
  assert.ok(night.remaining <= 10);
  await page.keyboard.press('h');
  await page.screenshot({ path: 'artifacts/combat-night-typed.png' });
  await page.keyboard.press('h');
  assert.deepEqual(errors, [], 'no page errors');
  console.log(JSON.stringify({ result: 'PASS', trip, armed, night, errors }, null, 2));
} finally {
  await browser.close();
}
