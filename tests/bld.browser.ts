import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

// BLD-04/BLD-05 gate: a 90° fence actually blocks as the rotated preview outline shows, and a
// closing fence that would seal the player off the camp heart is refused with a zh reason.
// All fences are paid for with real swings; nothing is injected.
const GATHER_REACH = 3;
const PER_SWING = 10;
const VIEW = { width: 1440, height: 1000, zoom: 23 };
const LOGS: [number, number][] = [
  [10, -7],
  [-8, -12],
  [-12, 7],
  [9, 14],
];
// Ring around the spawn (1, -6.1). The fence footprint is a 3.4 x 0.4 box (hx 1.7, hz 0.2),
// so the side walls span z -8.7..-5.3; the south wall sits at z=-5.0 to leave 0.1m corner
// gaps (too narrow for the 0.44m player) instead of the 0.6m gap z=-4.6 used to leave.
const WALLS = {
  west: { x: -1.2, z: -6.8 },
  north: { x: 1, z: -9.0 },
  east: { x: 3.2, z: -6.8 },
  south: { x: 1, z: -5.0 },
};

const URL = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({ viewport: { width: VIEW.width, height: VIEW.height } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForSelector('#loading.done', { timeout: 60000 });

  const state = () => page.evaluate(() => window.__pinefall.state);
  const stats = () => page.evaluate(() => window.__pinefall.stats);

  function project(x: number, y: number, z: number, center: number[]) {
    const aspect = VIEW.width / VIEW.height;
    const camera = new OrthographicCamera(
      -VIEW.zoom * aspect,
      VIEW.zoom * aspect,
      VIEW.zoom,
      -VIEW.zoom,
      0.1,
      260,
    );
    camera.position.set(center[0] + 2, 46, center[2] + 37);
    camera.lookAt(center[0], 0, center[2] - 0.3);
    camera.updateMatrixWorld();
    const p = new Vector3(x, y, z).project(camera);
    return { x: (p.x + 1) * (VIEW.width / 2), y: (1 - p.y) * (VIEW.height / 2) };
  }

  async function walkTo(tx: number, tz: number, stopDistance = 0.6): Promise<void> {
    for (let i = 0; i < 500; i++) {
      const [x, , z] = (await stats()).player;
      if (Math.hypot(tx - x, tz - z) <= stopDistance) return;
      const held: string[] = [];
      if (Math.abs(tx - x) > 0.3) held.push(tx > x ? 'd' : 'a');
      if (Math.abs(tz - z) > 0.3) held.push(tz > z ? 's' : 'w');
      for (const key of held) await page.keyboard.down(key);
      await page.waitForTimeout(70);
      for (const key of held) await page.keyboard.up(key);
    }
    throw new Error(`walkTo(${tx},${tz}) failed: ${JSON.stringify((await stats()).player)}`);
  }

  // state.logs order differs from the world coordinates; walk the known LOGS list and spend
  // three swings per log like the gather regression does.
  let logIndex = 0,
    swingsOnLog = 0;
  async function gatherOnce(): Promise<number> {
    if (swingsOnLog >= 3) {
      logIndex = Math.min(logIndex + 1, LOGS.length - 1);
      swingsOnLog = 0;
    }
    await page.waitForFunction(() => window.__pinefall.stats.collectCooldown === 0);
    await walkTo(LOGS[logIndex][0], LOGS[logIndex][1], GATHER_REACH - 0.5);
    const before = (await state()).wood;
    await page.keyboard.press('e');
    await page.waitForFunction((w) => window.__pinefall.state.wood > w, before, {
      timeout: 5000,
    });
    await page.waitForFunction(() => !window.__pinefall.stats.collecting);
    swingsOnLog++;
    return (await state()).wood - before;
  }

  async function hover(x: number, z: number) {
    const at = project(x, 0, z, (await stats()).camera);
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
    return (await stats()).ghost;
  }

  async function selectFence(rotate: boolean): Promise<void> {
    await page.click('[data-build="fence"]');
    if (rotate) {
      await page.keyboard.press('r');
      await page.waitForTimeout(120);
    }
  }

  async function buildFence(x: number, z: number, label: string): Promise<void> {
    const ghost = await hover(x, z);
    assert.equal(ghost?.valid, true, `${label} ghost should be valid (${ghost?.reason})`);
    const before = (await stats()).buildings;
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForFunction((n) => window.__pinefall.stats.buildings === n, before + 1, {
      timeout: 5000,
    });
  }

  // ——— 1. Honest gather: 4 swings pay for the 4 fences (25 start + 40). ———
  const start = await state();
  assert.equal(start.phase, 'day');
  assert.equal(start.wood, 25);
  while ((await state()).wood < 60) assert.equal(await gatherOnce(), PER_SWING);
  await walkTo(1, -6.1, 0.5);
  // The camp camera focus returns to (0,0) once the player is back near the spawn.
  await page.waitForFunction(
    () =>
      Math.abs(window.__pinefall.stats.camera[0]) < 0.2 &&
      Math.abs(window.__pinefall.stats.camera[2]) < 0.2,
    null,
    { timeout: 10000 },
  );

  // ——— 2. BLD-04: place a 90° fence and confirm its rotated outline + blocking shape. ———
  await selectFence(true);
  const westGhost = await hover(WALLS.west.x, WALLS.west.z);
  assert.ok(Math.abs(westGhost!.angle - Math.PI / 2) < 1e-9, 'R turned the ghost 90°');
  assert.equal(westGhost!.outline, true, 'rotated footprint outline is attached');
  assert.equal(westGhost!.valid, true, 'west wall is placeable');
  await page.screenshot({ path: 'artifacts/bld-04-fence-rotated.png' });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__pinefall.stats.buildings === 1);

  // Each placement drops the selection; re-select and keep rotating 180°, 270°, 360° (the last
  // two are equivalent to 0° and 90° for the symmetric fence box).
  await selectFence(true);
  await buildFence(WALLS.north.x, WALLS.north.z, 'north');
  await selectFence(true);
  await buildFence(WALLS.east.x, WALLS.east.z, 'east');

  // ——— 3. BLD-05: the closing wall is refused with a specific zh reason. ———
  await selectFence(true);
  const closing = await hover(WALLS.south.x, WALLS.south.z);
  assert.equal(closing?.valid, false, 'closing wall is refused');
  assert.equal(closing?.reason, '会把自己封死', 'refusal names the self-lock');
  assert.equal(
    await page.locator('#world-label').textContent(),
    '会把自己封死',
    'world label shows the reason',
  );
  await page.screenshot({ path: 'artifacts/bld-05-blocked.png' });
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert.equal((await stats()).buildings, 3, 'refused click places nothing');
  assert.ok((await state()).wood >= 20, 'refusal costs no wood');

  // ——— 4. A wall elsewhere still passes: the check is placement-specific, not a blanket ban. ———
  const away = await hover(5.5, -9.5);
  assert.equal(away?.valid, true, 'legal spot stays placeable');
  assert.equal(away?.reason, null, 'legal spot carries no reason');
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(() => window.__pinefall.stats.buildings === 4);

  // ——— 5. BLD-04 collision: the 90° fence blocks at its thin 0.4m face, as the outline shows. ———
  await page.keyboard.press('Escape'); // drop the build selection so movement is free
  // Hold west until the position stabilises: at low frame rates the 0.05s movement substep
  // can leave up to 0.26m between the stop point and the wall face, so a fixed-time hold is
  // not enough to distinguish "stopped at the box face" from "still walking".
  let stoppedX = (await stats()).player[0];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.down('a');
    await page.waitForTimeout(300);
    await page.keyboard.up('a');
    const next = (await stats()).player[0];
    const stable = Math.abs(next - stoppedX) < 0.01;
    stoppedX = next;
    if (stable) break;
  }
  assert.ok(
    stoppedX < -0.25 && stoppedX > -1.0,
    `player stopped at the rotated west face (x=${stoppedX.toFixed(2)}, old circle would stop near 0.2)`,
  );
  await page.keyboard.down('a');
  await page.waitForTimeout(400);
  await page.keyboard.up('a');
  const [heldX] = (await stats()).player;
  assert.ok(Math.abs(heldX - stoppedX) < 0.05, 'holding into the wall does not pass through it');
  await page.screenshot({ path: 'artifacts/bld-04-blocking.png' });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(
    `PASS: BLD-04 rotated preview/collision congruent, BLD-05 sealed pocket refused (wood ${(await state()).wood}), rotated fence stopped the player at x=${stoppedX.toFixed(2)}`,
  );
} finally {
  await browser.close();
}
