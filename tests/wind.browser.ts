import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { OrthographicCamera, Vector3 } from 'three';

// NGT-06 oracle: the per-night wind table is duplicated here on purpose so this browser check
// fails if the shipped rules change without the intel/spit consumers following.
const WINDS = [
  { dir: 'N', tier: 'light', strength: 0.35 },
  { dir: 'W', tier: 'breeze', strength: 0.6 },
  { dir: 'E', tier: 'strong', strength: 0.9 },
  { dir: 'S', tier: 'strong', strength: 0.9 },
  { dir: 'SW', tier: 'breeze', strength: 0.6 },
] as const;
const DIR_ANGLE: Record<string, number> = {
  E: 0,
  SE: Math.PI / 4,
  S: Math.PI / 2,
  SW: (3 * Math.PI) / 4,
  W: Math.PI,
  NW: (-3 * Math.PI) / 4,
  N: -Math.PI / 2,
  NE: -Math.PI / 4,
};
const DIR_CN: Record<string, string> = {
  N: '北',
  NE: '东北',
  E: '东',
  SE: '东南',
  S: '南',
  SW: '西南',
  W: '西',
  NW: '西北',
};
const TIER_CN: Record<string, string> = { light: '弱', breeze: '中', strong: '强' };
const DRIFT_SCALE = 1.2;
const SPIT_SPEED = 9;

interface SpitTrace {
  fromX: number;
  fromZ: number;
  total: number;
  aimX: number;
  aimZ: number;
  x: number;
  z: number;
  driftX: number;
  driftZ: number;
}

interface WindDiagnostics {
  dir: string;
  tier: string;
  x: number;
  z: number;
  spit: SpitTrace | null;
}

const windNow = (page: Page): Promise<WindDiagnostics> =>
  page.evaluate(() => {
    const s = window.__pinefall.stats as typeof window.__pinefall.stats & {
      windDir: string;
      windTier: string;
      windX: number;
      windZ: number;
      lastSpit: {
        fromX: number;
        fromZ: number;
        total: number;
        aimX: number;
        aimZ: number;
        x: number;
        z: number;
        driftX: number;
        driftZ: number;
      } | null;
    };
    return { dir: s.windDir, tier: s.windTier, x: s.windX, z: s.windZ, spit: s.lastSpit };
  });

// Mirrors src/rules.ts windDrift: perpendicular to the shot, magnitude = crosswind speed × time.
// Returns true when the shot had a crosswind component worth checking.
function assertDriftMatchesWind(
  trace: SpitTrace,
  wind: { dir: string; strength: number },
): boolean {
  const dx = trace.aimX - trace.fromX,
    dz = trace.aimZ - trace.fromZ;
  const length = Math.hypot(dx, dz);
  assert.ok(length > 0.5, 'spitter aimed at a real target');
  const perpX = -dz / length,
    perpZ = dx / length;
  const wx = Math.cos(DIR_ANGLE[wind.dir]) * wind.strength,
    wz = Math.sin(DIR_ANGLE[wind.dir]) * wind.strength;
  const crosswind = wx * perpX + wz * perpZ;
  assert.ok(
    Math.abs(trace.driftX * dx + trace.driftZ * dz) < 1e-6,
    'acid drift stays perpendicular to the shot',
  );
  if (Math.abs(crosswind) < 1e-9) {
    assert.ok(Math.hypot(trace.driftX, trace.driftZ) < 1e-9, 'no crosswind, no drift');
    return false;
  }
  assert.ok(
    crosswind * (trace.driftX * perpX + trace.driftZ * perpZ) > 0,
    'acid drift points downwind',
  );
  const flight = length / SPIT_SPEED;
  assert.ok(
    Math.abs(Math.hypot(trace.driftX, trace.driftZ) - Math.abs(crosswind) * DRIFT_SCALE * flight) <
      1e-6,
    'drift magnitude equals the crosswind speed times the flight time',
  );
  return true;
}

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  await page.evaluate(() => window.__pinefall.startNew());
  await page.waitForFunction(() => window.__pinefall.state.phase === 'day');

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
  async function openIntel() {
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
    await page.locator('[data-manual-tab="intel"]').click();
    const card = page.locator('#manual-page [data-wind]');
    await card.waitFor();
    return {
      dir: (await card.getAttribute('data-wind')) ?? '',
      tier: (await card.getAttribute('data-wind-tier')) ?? '',
      text: (await card.textContent()) ?? '',
    };
  }
  async function closeManual() {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused,
    );
  }
  async function checkIntel(day: number, shot?: string) {
    const expected = WINDS[day - 1];
    assert.ok(expected, `wind table covers day ${day}`);
    const card = await openIntel();
    assert.equal(card.dir, expected.dir, `day ${day} intel shows the night wind direction`);
    assert.equal(card.tier, expected.tier, `day ${day} intel shows the strength tier`);
    assert.ok(
      card.text.includes(`${DIR_CN[expected.dir]}风`),
      `day ${day} intel has the Chinese direction copy`,
    );
    assert.ok(
      card.text.includes(TIER_CN[expected.tier]),
      `day ${day} intel has the Chinese strength copy`,
    );
    const live = await windNow(page);
    assert.equal(live.dir, expected.dir, 'live gameplay wind matches the intel page');
    assert.equal(live.tier, expected.tier);
    const vx = Math.cos(DIR_ANGLE[expected.dir]) * expected.strength,
      vz = Math.sin(DIR_ANGLE[expected.dir]) * expected.strength;
    assert.ok(Math.abs(live.x - vx) < 1e-6, 'shared visual wind reuses the gameplay direction');
    assert.ok(Math.abs(live.z - vz) < 1e-6);
    if (shot) await page.screenshot({ path: shot });
    await closeManual();
    return card;
  }

  // Day 1: the intel card and the live diagnostics agree with the rules table.
  const day1 = await checkIntel(1, 'artifacts/wind-intel.png');

  // Nights 1-2 with the same tower plan as nights-siege, so night 3 (spitters) is reachable.
  await takeMill();
  await gatherLog();
  await build('tower', -2, -8);
  await build('tower', 8, 2);
  // NGT-05 cross-check: the briefing must read the same nightIntel wind as the manual page.
  await page.evaluate(() => window.__pinefall.setSpeed(20));
  await page.waitForFunction(() => window.__pinefall.machine.overlay === 'confirm', null, {
    timeout: 60000,
  });
  assert.equal(
    await page.locator('#confirm-dialog').getAttribute('data-wind'),
    day1.dir,
    'confirm briefing and manual page read the same wind',
  );
  assert.equal(await page.locator('#confirm-dialog').getAttribute('data-wind-tier'), day1.tier);
  const confirmNote = (await page.locator('#confirm-wind').textContent())!;
  assert.ok(day1.text.includes(confirmNote), 'both surfaces show the same wind note');
  await page.locator('#confirm-start').click();
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  await page.evaluate(() => window.__pinefall.setSpeed(10));
  await perk('marksman');
  assert.equal(await page.evaluate(() => window.__pinefall.state.day), 2);
  const day2 = await checkIntel(2);
  assert.notEqual(day2.dir, WINDS[0].dir, 'the next night has a different wind');

  await takeMill();
  await build('tower', -9, -6);
  await page.keyboard.press('n');
  await perk('engineer');
  assert.equal(await page.evaluate(() => window.__pinefall.state.day), 3);
  const day3 = await checkIntel(3);
  assert.notEqual(day3.dir, WINDS[1].dir, 'night 3 wind differs from night 2');

  // Night 3: real spitters must bend their acid across the E wind.
  await page.evaluate(() => window.__pinefall.setSpeed(10));
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  const traces: SpitTrace[] = [];
  const seen = new Set<string>();
  let crosswind = false;
  let screenshot = false;
  for (let i = 0; i < 900; i++) {
    const s = await windNow(page);
    if (s.spit) {
      const key = `${s.spit.fromX},${s.spit.fromZ},${s.spit.x},${s.spit.z}`;
      if (!seen.has(key)) {
        seen.add(key);
        traces.push(s.spit);
        if (assertDriftMatchesWind(s.spit, WINDS[2])) crosswind = true;
      }
    }
    if (!screenshot && seen.size > 0) {
      // Slow the sim down so the next glob is long enough on screen for the screenshot.
      await page.evaluate(() => window.__pinefall.setSpeed(1));
    }
    if (!screenshot && seen.size > 1) {
      await page.screenshot({ path: 'artifacts/wind-spit.png' });
      screenshot = true;
    }
    if (crosswind && screenshot) break;
    const state = await page.evaluate(() => ({
      over: window.__pinefall.state.over,
      perkPending: window.__pinefall.state.perkPending,
    }));
    if (state.over || state.perkPending) break;
    await page.waitForTimeout(120);
  }
  assert.ok(traces.length > 0, 'spitters fired acid on the wind night');
  assert.ok(crosswind, 'at least one crosswind spit drifted downwind by the rules formula');
  const end = await windNow(page);
  console.log(
    JSON.stringify(
      { result: 'PASS', day: 3, wind: end.dir, spits: traces.length, traces, errors },
      null,
      2,
    ),
  );
  assert.deepEqual(errors, [], 'no JS or shader errors');
  if (!screenshot)
    console.log('NOTE: wind-spit.png not captured (no second spit observed in time)');
} finally {
  await browser.close();
}
