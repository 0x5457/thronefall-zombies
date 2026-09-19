import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { OrthographicCamera, Vector3 } from 'three';

const URL = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const FIRE = { x: 0.1, z: 5.6 };

interface DeathObservation {
  timeout: false;
  downElapsed: number;
  invulnStart: number;
  invulnEnd: number;
  protection: number;
  hpAtDown: number;
  healthAtDown: number;
  maxHp: number;
  position: number[];
  day: number;
  campBefore: number;
  campAfter: number;
  minHp: number;
  invulnerableSeen: boolean;
}

interface DeathTimeout {
  timeout: true;
  hp: number;
  health: number;
  day: number;
  minHp: number;
  campBefore: number;
  enemies: number;
}

type DeathResult = DeathObservation | DeathTimeout;

async function observeDeath(page: Page): Promise<DeathResult> {
  return page.evaluate(
    () =>
      new Promise<DeathResult>((resolve) => {
        const started = performance.now();
        const campBefore = window.__pinefall.state.health;
        let minHp = window.__pinefall.state.playerHp;
        let prevHp = window.__pinefall.state.playerHp;
        let downElapsed = -1;
        let invulnStart = -1;
        let invulnerableSeen = false;
        let hpAtDown = 0;
        let healthAtDown = 0;
        let maxHp = window.__pinefall.stats.maxHp;
        let position: number[] = [];
        const frame = () => {
          const game = window.__pinefall.state;
          const stats = window.__pinefall.stats;
          minHp = Math.min(minHp, game.playerHp);
          if (downElapsed < 0 && prevHp <= 12 && game.playerHp === 50) {
            downElapsed = game.elapsed;
            hpAtDown = game.playerHp;
            healthAtDown = game.health;
            maxHp = stats.maxHp;
            position = [...stats.player];
          }
          prevHp = game.playerHp;
          if (downElapsed >= 0) {
            if (stats.invulnerable) {
              invulnerableSeen = true;
              if (invulnStart < 0) invulnStart = game.elapsed;
            }
            if (invulnerableSeen && !stats.invulnerable) {
              resolve({
                timeout: false,
                downElapsed,
                invulnStart,
                invulnEnd: game.elapsed,
                protection: game.elapsed - invulnStart,
                hpAtDown,
                healthAtDown,
                maxHp,
                position,
                day: game.day,
                campBefore,
                campAfter: game.health,
                minHp,
                invulnerableSeen,
              });
              return;
            }
          }
          if (performance.now() - started > 200000) {
            resolve({
              timeout: true,
              hp: game.playerHp,
              health: game.health,
              day: game.day,
              minHp,
              campBefore,
              enemies: stats.enemies,
            });
            return;
          }
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      }),
  );
}

async function run() {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(URL);
    await page.waitForSelector('#loading.done', { timeout: 60000 });
    const state = () => page.evaluate(() => window.__pinefall.state);
    const stats = () => page.evaluate(() => window.__pinefall.stats);

    const opening = await state();
    const openingStats = await stats();
    assert.equal(opening.day, 1, 'campaign starts on day 1');
    assert.equal(opening.phase, 'day', 'campaign starts in daylight');
    assert.equal(opening.health, 100, 'camp starts at full durability');
    assert.equal(opening.playerHp, 100, 'hero starts at full health');
    assert.equal(openingStats.maxHp, 100, 'hero max health is 100 before any perk');

    async function walkTo(tx: number, tz: number, tol = 0.7) {
      let lastX = Number.NaN,
        lastZ = Number.NaN,
        stuck = 0;
      for (let i = 0; i < 500; i++) {
        const {
          player: [x, , z],
        } = await page.evaluate(() => window.__pinefall.stats);
        if (Math.hypot(tx - x, tz - z) < tol) return;
        if (Math.hypot(x - lastX, z - lastZ) < 0.08) stuck++;
        else stuck = 0;
        lastX = x;
        lastZ = z;
        const held: string[] = [];
        if (stuck > 10) {
          held.push(stuck % 20 < 10 ? 'd' : 'a');
          if (stuck > 25) held.push(tz > z ? 's' : 'w');
        } else {
          if (Math.abs(tx - x) > 0.4) held.push(tx > x ? 'd' : 'a');
          if (Math.abs(tz - z) > 0.4) held.push(tz > z ? 's' : 'w');
        }
        for (const key of held) await page.keyboard.down(key);
        await page.waitForTimeout(60);
        for (const key of held) await page.keyboard.up(key);
      }
      throw new Error(`walkTo failed ${tx},${tz}: ${JSON.stringify((await stats()).player)}`);
    }

    // Continuous-key walk used for the timed lane interception: releasing keys every 60ms costs
    // too much game time at 1x, and being late lets a brute slip past to the camp.
    async function sprintTo(tx: number, tz: number, tol = 0.5) {
      let held: string[] = [];
      const setKeys = async (next: string[]) => {
        for (const key of held) if (!next.includes(key)) await page.keyboard.up(key);
        for (const key of next) if (!held.includes(key)) await page.keyboard.down(key);
        held = next;
      };
      let lastX = Number.NaN,
        lastZ = Number.NaN,
        stuck = 0;
      try {
        for (let i = 0; i < 300; i++) {
          const {
            player: [x, , z],
          } = await stats();
          if (Math.hypot(tx - x, tz - z) < tol) return;
          if (Math.hypot(x - lastX, z - lastZ) < 0.06) stuck++;
          else stuck = 0;
          lastX = x;
          lastZ = z;
          const next: string[] = [];
          if (stuck > 4) {
            next.push(tx > x ? 'd' : 'a', stuck % 16 < 8 ? 'w' : 's');
          } else {
            if (Math.abs(tx - x) > 0.3) next.push(tx > x ? 'd' : 'a');
            if (Math.abs(tz - z) > 0.3) next.push(tz > z ? 's' : 'w');
          }
          await setKeys(next);
          await page.waitForTimeout(70);
        }
      } finally {
        await setKeys([]);
      }
      throw new Error(`sprintTo failed ${tx},${tz}: ${JSON.stringify((await stats()).player)}`);
    }

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

    // One lantern slows the west runners enough for nights 1-2 to end with a clean camp.
    await build('lantern', -5, 0.5);
    await walkTo(-1, -4.2);
    await page.evaluate(() => window.__pinefall.setSpeed(20));
    const nights: Record<string, unknown>[] = [];
    for (const perk of ['scavenger', 'engineer']) {
      const before = await state();
      await page.keyboard.press('n');
      await page.waitForFunction(() => window.__pinefall?.state.phase === 'night', null, {
        timeout: 15000,
      });
      await page.waitForFunction(
        () => window.__pinefall?.state.perkPending || window.__pinefall?.state.over,
        null,
        { timeout: 240000, polling: 250 },
      );
      const dawn = await state();
      nights.push({ day: before.day, hp: dawn.playerHp, health: dawn.health });
      assert.equal(dawn.over, false, `night ${before.day} must not end in defeat`);
      assert.equal(dawn.perkPending, true, `night ${before.day} must reach dawn`);
      assert.equal(dawn.day, before.day + 1, 'the day advances at dawn');
      await page.locator(`[data-perk="${perk}"]`).click();
      await page.waitForFunction(
        () =>
          window.__pinefall !== undefined &&
          !window.__pinefall.state.perkPending &&
          !document.querySelector<HTMLDialogElement>('#perk-dialog')?.open,
      );
    }
    assert.equal((await state()).day, 3, 'third day reached');

    // The day-3 station expedition is real day play that leaves the hero at 80 for the down night.
    // Night 3 is won by real contact against the north-lane brutes (12 damage a hit, armor): the
    // hero waits off-lane, out of carbine reach, so the brutes arrive near full health, then steps
    // onto their waypoint. Their pass must knock the hero down before the camp is ever touched.
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__pinefall?.stats.manualOpen);
    await page.locator('[data-manual-tab="expedition"]').click();
    await page.locator('.manual-card:has-text("山脊中继站") button').click();
    await page.waitForFunction(() => window.__pinefall?.state.playerHp === 80);
    await page.keyboard.press('Tab');
    await page.waitForFunction(
      () => window.__pinefall !== undefined && !window.__pinefall.stats.manualOpen,
    );
    await page.evaluate(() => window.__pinefall.setSpeed(1));
    await walkTo(8.5, -10, 0.7);
    assert.equal((await state()).health, 100, 'camp back to full before the down night');
    assert.equal((await state()).playerHp, 80, 'expedition injury carried into the down night');

    const observation = observeDeath(page);
    observation.catch(() => {});
    await page.keyboard.press('n');
    await page.waitForFunction(() => window.__pinefall?.state.phase === 'night', null, {
      timeout: 15000,
    });
    // Real-time scale so the test can react inside the 2.5s protection window after the down.
    await page.evaluate(() => window.__pinefall.setSpeed(1));

    let downSeen = false;
    let sprinted = false;
    let nextLog = 0;
    const fightStart = Date.now();
    while (Date.now() - fightStart < 150000) {
      const s = await state();
      const st = await stats();
      if (s.playerHp === 50 && s.health <= 85) {
        if (!downSeen) {
          downSeen = true;
          console.log(`down t=${s.elapsed.toFixed(1)} camp${s.health}`);
          await page.screenshot({ path: 'artifacts/death-respawn.png' });
          // Keep moving through the protection window: shots aimed at the respawn point land
          // behind the hero, and the paused game freezes the camp at exactly -15.
          await page.keyboard.down('a');
        }
        if (!st.invulnerable) {
          await page.keyboard.press('p');
          await page.keyboard.up('a');
          break;
        }
      }
      if (s.over) break;
      if (!sprinted && !downSeen && s.elapsed >= 20) {
        sprinted = true;
        await sprintTo(-1, -10, 0.45);
      }
      if (s.elapsed >= nextLog) {
        nextLog = Math.floor(s.elapsed) + 5;
        console.log(
          `hold t=${s.elapsed.toFixed(0)} hp${s.playerHp} camp${s.health} enemies${st.enemies}`,
        );
      }
      await page.waitForTimeout(250);
    }
    assert.equal(downSeen, true, 'the brutes must knock the hero down in real contact');
    const observed = await observation;
    const after = await state();
    const afterStats = await stats();
    await page.screenshot({ path: 'artifacts/death-flow.png' });

    assert.equal(
      observed.timeout,
      false,
      `hero must be downed in real combat: ${JSON.stringify(observed)}`,
    );
    if (observed.timeout) throw new Error('unreachable');
    assert.equal(observed.day, 3, 'the down happens on night 3');
    assert.equal(observed.campBefore, 100, 'camp durability is 100 before the down');
    assert.equal(observed.healthAtDown, 85, 'the down costs the camp exactly 15 durability');
    assert.equal(observed.hpAtDown, 50, 'hero wakes at half of max health');
    assert.equal(observed.maxHp, 100, 'max health is unchanged by the chosen perks');
    assert.equal(observed.invulnerableSeen, true, 'respawn protection was observed');
    assert.ok(
      observed.protection >= 2.2 && observed.protection <= 2.6,
      `respawn protection lasts about 2.5s (saw ${observed.protection.toFixed(2)}s)`,
    );
    assert.ok(observed.minHp <= 12, `hero really dropped to zero (min hp ${observed.minHp})`);
    const distance = Math.hypot(observed.position[0] - FIRE.x, observed.position[2] - FIRE.z);
    assert.ok(distance < 4, `hero wakes near the campfire (${distance.toFixed(2)} units)`);
    assert.equal(
      after.paused,
      true,
      'the game is frozen before later waves can land a second down',
    );
    assert.equal(after.health, 85, 'camp keeps exactly the 15 durability loss');
    assert.equal(after.playerHp, 50, 'hero stays at half health while protected/paused');
    assert.equal(afterStats.invulnerable, false, 'protection window has elapsed');
    assert.equal(afterStats.maxHp, 100, 'max health unchanged after respawn');
    assert.deepEqual(errors, [], 'no page errors');

    console.log(
      JSON.stringify(
        {
          result: 'PASS',
          nights,
          down: {
            day: observed.day,
            campBefore: observed.campBefore,
            campAfter: observed.healthAtDown,
            hpAfter: observed.hpAtDown,
            maxHp: observed.maxHp,
            minHp: observed.minHp,
            protectionSeconds: Number(observed.protection.toFixed(2)),
            respawn: observed.position.map((v) => Number(v.toFixed(2))),
            campfireDistance: Number(distance.toFixed(2)),
            campAfterProtection: observed.campAfter,
            paused: after.paused,
          },
          errors,
        },
        null,
        2,
      ),
    );
    return { days: nights.length + 1, protection: observed.protection, errors };
  } finally {
    await browser.close().catch(() => {});
  }
}

await mkdir('artifacts', { recursive: true });
let report: Awaited<ReturnType<typeof run>> | null = null;
let lastError: unknown = null;
for (let attempt = 1; attempt <= 3 && !report; attempt++) {
  try {
    report = await run();
  } catch (error) {
    lastError = error;
    const message = error instanceof Error ? error.message : String(error);
    const reloaded =
      /destroyed|navigation|detached|has been closed|ERR_ABORTED|ERR_FAILED|Failed to open a new tab|Protocol error|Target closed|Cannot read properties of undefined/i.test(
        message,
      );
    if (!reloaded || attempt === 3) throw error;
    console.warn(`attempt ${attempt} interrupted by a page reload, retrying: ${message}`);
  }
}
if (!report) throw lastError;
console.log(
  `PASS: full down flow on day ${report.days} (protection ${report.protection.toFixed(2)}s)`,
);
process.exit(0);
