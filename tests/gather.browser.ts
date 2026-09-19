import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

// FBK-01/FBK-02/WLD-02 gate: real gather swing (E), cooldown, pause safety, guidance and level dots.
// No state injection: movement is keyboard input, upgrades go through the building panel and the
// scrap expedition goes through the camp manual.
// GATHER = { reach: 3, swing: 0.45, hitAt: 0.28, cooldown: 0.35, perSwing: 10 } in src/rules.ts.
const GATHER_REACH = 3;
const PER_SWING = 10;
const VIEW = { width: 1440, height: 1000, zoom: 23 };
// Log coordinates from src/world.ts, nearest first from the spawn at (1, 0, -6.1).
const LOGS: [number, number][] = [
  [10, -7],
  [-8, -12],
  [-12, 7],
  [9, 14],
];

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

  // The live camera follows the player; project through a clone matching main.ts at the default zoom.
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

  async function clickWorld(x: number, y: number, z: number): Promise<void> {
    const point = project(x, y, z, (await stats()).camera);
    await page.mouse.click(point.x, point.y);
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

  // Honest gather loop: walks to the next wooded log and plays a full swing per iteration.
  let logIndex = 0;
  let swingsOnLog = 0;
  async function approachCurrentLog(): Promise<void> {
    if (swingsOnLog >= swingsPerLog) {
      logIndex = Math.min(logIndex + 1, LOGS.length - 1);
      swingsOnLog = 0;
    }
    await walkTo(LOGS[logIndex][0], LOGS[logIndex][1], GATHER_REACH - 0.5);
  }
  async function gatherOnce(): Promise<number> {
    await page.waitForFunction(() => window.__pinefall.stats.collectCooldown === 0);
    await approachCurrentLog();
    const before = (await state()).wood;
    await page.keyboard.press('e');
    await page.waitForFunction((w) => window.__pinefall.state.wood > w, before, { timeout: 5000 });
    await page.waitForFunction(() => !window.__pinefall.stats.collecting);
    swingsOnLog++;
    return (await state()).wood - before;
  }

  async function ensureWood(target: number): Promise<void> {
    while ((await state()).wood < target) {
      assert.equal(await gatherOnce(), PER_SWING, 'each swing yields exactly 10 wood');
    }
  }

  async function buildTower(x: number, z: number): Promise<void> {
    await page.click('[data-build="tower"]');
    const point = project(x, 0, z, (await stats()).camera);
    await page.mouse.move(point.x, point.y);
    await page.waitForTimeout(120);
    assert.ok(
      !(await page.locator('#world-label').getAttribute('class'))!.includes('invalid'),
      `valid tower at ${x},${z}`,
    );
    await page.mouse.down();
    await page.mouse.up();
  }

  async function selectTower(x: number, z: number, level: number): Promise<void> {
    const top = level >= 3 ? 5.7 : level >= 2 ? 4.75 : 3.8;
    await clickWorld(x, top - 0.64, z);
    await page.waitForTimeout(200);
    if ((await stats()).selectedBuilding !== 'tower') {
      await clickWorld(x, 1.3, z);
      await page.waitForTimeout(200);
    }
    assert.equal((await stats()).selectedBuilding, 'tower', `tower selected at L${level}`);
  }

  const dots = () => page.locator('#building-level-dots');
  async function assertDots(level: number): Promise<void> {
    assert.equal(await dots().isVisible(), true, `L${level} dots visible in daylight`);
    assert.equal(await dots().textContent(), '●'.repeat(level), `L${level} shows ${level} dot(s)`);
    assert.equal((await stats()).levelDots, level, 'diagnostic levelDots matches');
  }

  // ——— 1/2. Day 1 starts on the gather step with all four logs untouched. ———
  const initial = await stats();
  const initialLogs = (await state()).logs;
  const swingsPerLog = initialLogs[0]?.remaining ?? 0;
  const initialSwings = initialLogs.reduce((n, l) => n + l.remaining, 0);
  assert.equal(initial.guidance, 'gather', 'day 1 starts on the gather step');
  assert.ok(swingsPerLog > 0, 'logs offer at least one swing');
  assert.ok(
    initialLogs.every((l) => l.remaining === swingsPerLog),
    'every log starts full',
  );
  assert.equal(initial.logsRemaining, initialSwings, 'logsRemaining sums remaining swings');
  assert.equal(initial.collecting, false);
  assert.equal(initial.collectCooldown, 0);

  await walkTo(LOGS[0][0], LOGS[0][1], GATHER_REACH - 0.5);
  assert.equal(await page.locator('#gather-prompt').isVisible(), true, 'gather prompt visible');
  assert.match(
    (await page.locator('#gather-prompt').textContent())!,
    new RegExp(`E 采集木材 · 剩余 ${swingsPerLog}`),
  );
  assert.equal(await page.locator('#note-title').textContent(), '采集木材');
  await page.screenshot({ path: 'artifacts/gather-prompt-day.png' });

  // ——— 3. Real E press: swing timing, movement lock, +10 once, cooldown starts. ———
  const woodBefore = (await state()).wood;
  // Wall-clock is unreliable when frames drop below 20 FPS (dt clamp dilates sim time),
  // so the swing duration is measured in simulation seconds via state.elapsed.
  const swing = page.evaluate(
    () =>
      new Promise<{ ms: number; simMs: number; cooldown: number }>((resolve) => {
        let started = 0;
        let simStart = 0;
        const poll = (): void => {
          const s = window.__pinefall.stats;
          if (!started) {
            if (s.collecting) {
              started = performance.now();
              simStart = window.__pinefall.state.elapsed;
            }
          } else if (!s.collecting) {
            resolve({
              ms: performance.now() - started,
              simMs: (window.__pinefall.state.elapsed - simStart) * 1000,
              cooldown: s.collectCooldown,
            });
            return;
          }
          requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }),
  );
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__pinefall.stats.collecting);
  const lockPos = (await stats()).player;
  await page.keyboard.down('d');
  await page.waitForTimeout(140);
  await page.keyboard.up('d');
  const lockedPos = (await stats()).player;
  assert.ok(
    Math.hypot(lockedPos[0] - lockPos[0], lockedPos[2] - lockPos[2]) < 0.05,
    'movement is locked mid-swing',
  );
  await page.waitForFunction((w) => window.__pinefall.state.wood > w, woodBefore, {
    timeout: 5000,
  });
  // Keep step 4 on fast round-trips only: the swing promise resolves at swing end and the
  // 0.35s cooldown has to survive the rejection press, so no screenshot in between.
  const swingResult = await swing;
  // Tolerance covers one simulation frame on either side of the rAF sampling boundaries.
  assert.ok(
    swingResult.simMs > 300 && swingResult.simMs < 600,
    `swing lasts ~0.45s of game time (measured ${swingResult.simMs.toFixed(0)}ms sim / ${swingResult.ms.toFixed(0)}ms wall)`,
  );
  assert.ok(swingResult.cooldown > 0, 'collect cooldown starts when the swing settles');
  const afterFirst = await state();
  assert.equal(afterFirst.wood, woodBefore + PER_SWING, 'first swing yields exactly 10 wood');
  assert.equal((await stats()).collecting, false, 'collecting returns to false');
  assert.equal(
    (await stats()).logsRemaining,
    initialSwings - 1,
    'one swing consumed from the logs',
  );
  assert.equal((await stats()).guidance, 'build', 'guidance advances after the first collect');

  // ——— 4. E during the cooldown is refused; after it clears the next swing pays. ———
  const cd = (await stats()).collectCooldown;
  assert.ok(cd > 0, `cooldown is running right after the swing (${cd.toFixed(2)}s)`);
  await page.keyboard.press('e');
  await page.waitForTimeout(80);
  assert.equal((await stats()).collecting, false, 'E during cooldown starts no swing');
  assert.equal((await state()).wood, afterFirst.wood, 'no wood gained during cooldown');

  await page.waitForFunction(() => window.__pinefall.stats.collectCooldown === 0);
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__pinefall.stats.collecting);
  await page.waitForFunction(
    (w) => window.__pinefall.state.wood >= w,
    afterFirst.wood + PER_SWING,
    {
      timeout: 5000,
    },
  );
  await page.screenshot({ path: 'artifacts/gather-swing.png' });
  await page.waitForFunction(() => !window.__pinefall.stats.collecting);
  assert.equal((await state()).wood, afterFirst.wood + PER_SWING, 'second swing yields 10 wood');
  assert.equal((await stats()).logsRemaining, initialSwings - 2, 'second swing consumes another');
  swingsOnLog = 2;

  // ——— 5. Guidance: build a tower through the real build bar, card flips to the night step. ———
  await ensureWood(35);
  await buildTower(6, -4);
  await page.waitForFunction(() => window.__pinefall.stats.buildings === 1);
  assert.equal((await stats()).guidance, 'fight', 'tower completes the build step');
  assert.equal(await page.locator('#note-title').textContent(), '迎接夜晚');
  assert.match((await page.locator('#note-body').textContent())!, /北径路口/);
  assert.equal(await page.locator('#skip-guidance').isVisible(), true);

  // ——— 6. Pause safety: the swing and its cooldown freeze, then finish after resume. ———
  await page.waitForFunction(() => window.__pinefall.stats.collectCooldown === 0);
  await approachCurrentLog();
  const beforePause = (await state()).wood;
  const logsBeforePause = (await stats()).logsRemaining;
  await page.keyboard.press('e');
  await page.waitForFunction(() => window.__pinefall.stats.collecting);
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__pinefall.state.paused);
  const frozen = await stats();
  await page.waitForTimeout(1000);
  const held = await stats();
  assert.equal(held.collecting, true, 'swing stays frozen while paused');
  assert.equal((await state()).wood, beforePause, 'no wood lands while paused');
  assert.equal(
    held.collectCooldown,
    frozen.collectCooldown,
    'collect cooldown frozen while paused',
  );
  await page.keyboard.press('p');
  await page.waitForFunction(() => !window.__pinefall.state.paused);
  await page.waitForFunction((w) => window.__pinefall.state.wood >= w, beforePause + PER_SWING, {
    timeout: 5000,
  });
  await page.waitForFunction(() => !window.__pinefall.stats.collecting);
  assert.equal((await state()).wood, beforePause + PER_SWING, 'swing settles after resume');
  assert.equal(
    (await stats()).logsRemaining,
    logsBeforePause - 1,
    'paused swing consumed one more',
  );
  swingsOnLog++;

  // ——— 7. WLD-02: level dots for L1/L2/L3, gathered honestly, then hidden at night. ———
  await selectTower(6, -4, 1);
  await assertDots(1);
  await walkTo(9, -6.5, 0.8);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/wld02-levels-l1.png' });

  await ensureWood(20);
  await page.locator('#building-upgrade').click();
  await page.waitForFunction(() =>
    window.__pinefall.stats.buildingLevels[0]?.startsWith('tower:2'),
  );
  await assertDots(2);
  await walkTo(9, -6.5, 0.8);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/wld02-levels-l2.png' });

  const afterL2 = await state();
  if (afterL2.scrap < 8) {
    const plan = afterL2.scrap + 5 >= 8 ? '废弃救护站' : '山脊中继站';
    const target = afterL2.scrap + (plan === '废弃救护站' ? 5 : 12);
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
    await page.locator('[data-manual-tab="expedition"]').click();
    await page.locator(`.manual-card:has-text("${plan}") button`).click();
    await page.waitForFunction((s) => window.__pinefall.state.scrap >= s, target, {
      timeout: 5000,
    });
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused,
    );
  }

  await ensureWood(40);
  assert.ok((await state()).scrap >= 8, 'scrap covers the L3 upgrade');
  await page.locator('#building-upgrade').click();
  await page.waitForFunction(() =>
    window.__pinefall.stats.buildingLevels[0]?.startsWith('tower:3'),
  );
  await assertDots(3);
  await walkTo(9, -6.5, 0.8);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/wld02-levels-l3.png' });

  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  assert.equal(await dots().isVisible(), false, 'level dots hidden at night');
  await selectTower(6, -4, 3);
  assert.equal(await page.locator('#building-panel').isVisible(), true, 'night panel opens');
  assert.equal(await dots().isVisible(), false, 'dots stay hidden when selected at night');

  assert.deepEqual(errors, []);
  console.log(
    `PASS: real gather swing/cooldown/pause safety, guidance gather→build→fight, tower L1→L2→L3 with level dots and night hiding; final wood ${(await state()).wood}, scrap ${(await state()).scrap}; no state injection`,
  );
} finally {
  await browser.close();
}
