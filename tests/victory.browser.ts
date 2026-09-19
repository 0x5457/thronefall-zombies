// Full five-night campaign run: real builds, real nights, real dawn perks.
// No state injection, no enemy clearing and no skipped nights — the win must come from play.
// Preparation (expedition, chopping, walking) runs at 1x; nights run at 8x game speed.
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
    const summary = await page.locator('#perk-summary').textContent();
    assert.match(summary!, /评分 [SABC]（\d+）/, 'dawn shows a rating with its score');
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
    const target = await page.evaluate(() => {
      const [px, , pz] = window.__pinefall.stats.player;
      return window.__pinefall.state.logs
        .filter((log) => log.remaining > 0)
        .sort((a, b) => Math.hypot(a.x - px, a.z - pz) - Math.hypot(b.x - px, b.z - pz))[0];
    });
    assert.ok(target, 'a log with swings left is available');
    await walkTo(target.x, target.z);
    for (let swing = 0; swing < target.remaining; swing++) {
      await page.waitForFunction(
        () => !window.__pinefall.stats.collecting && window.__pinefall.stats.collectCooldown === 0,
      );
      const before = await page.evaluate(() => window.__pinefall.state.wood);
      await page.keyboard.press('e');
      await page.waitForFunction((wood) => window.__pinefall.state.wood >= wood, before + 10, {
        timeout: 5000,
      });
    }
    // Back to the spawn-side defensive spot the night plan was tuned around.
    await walkTo(1, -6.1);
  }
  // ECO-01: the mill haul funds what dawn income cannot; only when it is spent do we chop a log.
  async function fund(need: number) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const s = await game();
      if (s.wood >= need) return;
      if (s.expeditionDay !== s.day && s.elapsed + 35 < 150) await takeMill();
      else await gatherLog();
    }
    assert.fail(`fund(${need}) could not raise enough wood`);
  }
  // ECO-01 leaves thinner margins, so invest the honest income in upgrades before the boss night.
  async function upgradeFirstTower() {
    const tower = await page.evaluate(() =>
      window.__pinefall.state.buildings.find((b) => b.type === 'tower')!,
    );
    // Walk back so the live camera is centred where the tower is, then click through the live camera.
    await walkTo(1, -6.1);
    for (const [height, offset] of [
      [3.2, 0],
      [1.3, 0],
    ] as const) {
      const center = await page.evaluate(() => window.__pinefall.stats.camera);
      const live = new OrthographicCamera(-23 * 1.44, 23 * 1.44, 23, -23, 0.1, 260);
      live.position.set(center[0] + 2, 46, center[2] + 37);
      live.lookAt(center[0], 0, center[2] - 0.3);
      live.updateMatrixWorld();
      const p = new Vector3(tower.x, height, tower.z).project(live);
      await page.mouse.click((p.x + 1) * 720 + offset, (1 - p.y) * 500);
      await page.waitForTimeout(200);
      if ((await page.evaluate(() => window.__pinefall.stats.selectedBuilding)) === 'tower') break;
    }
    await page.waitForFunction(() => window.__pinefall.stats.selectedBuilding === 'tower');
    await page.locator('#building-upgrade').click();
    await page.waitForFunction((id) => {
      const b = window.__pinefall.state.buildings.find((x) => x.id === id);
      return !!b && b.level >= 2;
    }, tower.id);
  }
  const dayPlans: [string, string, [string, number, number][]][] = [
    [
      'marksman',
      'night 1',
      [
        ['tower', -2, -8],
        ['tower', 8, 2],
      ],
    ],
    ['engineer', 'night 2', [['tower', -9, -6]]],
    ['survivor', 'night 3', [['tower', 4, -6]]],
    [
      'scavenger',
      'night 4',
      [
        ['lantern', -2, -4],
        ['lantern', -7, -4],
      ],
    ],
    ['', 'night 5', [['tower', -6, -9]]],
  ];
  const nights: Record<string, unknown>[] = [];
  let won = false;
  for (const [perkId, label, builds] of dayPlans) {
    // ECO-01: fund every day through the real UI before building, then fight at 8x.
    await page.evaluate(() => window.__pinefall.setSpeed(1));
    const need = builds.reduce((sum, [type]) => sum + (type === 'tower' ? 35 : 10), 0);
    await fund(need);
    for (const [type, x, z] of builds) await build(type, x, z);
    if (label === 'night 5') {
      await fund(24);
      await upgradeFirstTower();
    }
    const before = await game();
    let waited = 0;
    await page.evaluate(() => window.__pinefall.setSpeed(8));
    await page.keyboard.press('n');
    for (;;) {
      const s = await game();
      if (s.perkPending || s.won || s.over) break;
      waited += 1.5;
      assert.ok(waited < 480, `${label} must finish within 8 minutes`);
      await page.keyboard.press('q');
      await page.waitForTimeout(1500);
    }
    const after = await game();
    nights.push({
      night: before.day,
      health: after.health,
      playerHp: after.playerHp,
      kills: after.kills,
      deaths: after.deaths,
      won: after.won,
      over: after.over,
      rating: after.rating,
    });
    console.log(`${label} result`, nights.at(-1));
    assert.equal(after.over && !after.won, false, `${label} must not end in defeat`);
    if (after.won) {
      won = true;
      break;
    }
    assert.equal(after.perkPending, true, `${label} must reach dawn with a perk pending`);
    assert.equal(after.day, before.day + 1, 'the day advances at dawn');
    await perk(perkId);
  }
  assert.equal(won, true, 'the fifth night must end in victory');
  const end = await game();
  const machine = await page.evaluate(() => window.__pinefall.machine);
  assert.equal(machine.phase, 'victory', 'the machine ends in the victory state');
  assert.equal(end.won, true);
  assert.equal(end.over, true);
  assert.equal(end.phase, 'night', 'rules phase stays night until a new campaign resets it');
  const dialog = page.locator('#end-dialog');
  assert.equal(await dialog.evaluate((node) => (node as HTMLDialogElement).open), true);
  assert.match((await dialog.locator('h2').textContent())!, /守住了/);
  assert.ok(end.kills >= 60, `campaign should record every kill (saw ${end.kills})`);
  await page.screenshot({ path: 'artifacts/victory.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: five nights played to victory', {
    day: end.day,
    kills: end.kills,
    deaths: end.deaths,
    health: end.health,
  });
} finally {
  await browser.close();
}
