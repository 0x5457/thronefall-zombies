// NGT-05 gate: when the day clock runs out the game opens the pre-night briefing instead of
// starting the night. Escape returns to the day (no re-open that day), Enter commits the night.
// Day 1 is reached with the diagnostic 20x time scale — the timeout trigger itself is real,
// no combat result is faked and no wave is skipped.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

// Mirrors WAVES[0] + nightWind(1) from src/rules.ts (browser tests run outside Vite, so the
// rules module cannot be imported here). Frozen together with the machine-graph matrix.
const NIGHT_1 = {
  name: '林间脚步',
  lesson: '单路来袭：先建一座瞭望塔，把北径钉住。',
  advice: '游荡者中速均衡；站在塔的射程里互相掩护即可。',
  windNote: '微风向北：酸液几乎不偏，首夜专注建塔。',
  wind: 'N',
  groups: [['walker', 10, 0]] as [string, number, number][],
};

const URL = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const VIEWPORT = { width: 1440, height: 1000 };
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan'],
});
try {
  await mkdir('artifacts', { recursive: true });

  async function openOnTimeout() {
    const page = await browser.newPage({ viewport: VIEWPORT });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.waitForSelector('#loading.done', { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__pinefall.machine.phase), 'day');
    await page.evaluate(() => window.__pinefall.setSpeed(20));
    await page.waitForFunction(() => window.__pinefall.machine.overlay === 'confirm', null, {
      timeout: 30000,
    });
    return { page, errors };
  }

  const intel = NIGHT_1;

  // ——— Cancel path: Esc returns to the day, never re-opens, and N still commits the night. ———
  const { page: cancelPage, errors: cancelErrors } = await openOnTimeout();
  const open = await cancelPage.evaluate(() => ({
    machine: window.__pinefall.machine,
    state: window.__pinefall.state,
    stats: window.__pinefall.stats,
  }));
  assert.equal(open.machine.overlay, 'confirm', 'timeout opens the confirm overlay');
  assert.equal(open.machine.phase, 'day');
  assert.equal(open.state.phase, 'day', 'the night has not started yet');
  assert.equal(open.state.paused, true, 'the briefing freezes the game');
  assert.equal(
    await cancelPage.locator('#confirm-dialog').evaluate((d) => (d as HTMLDialogElement).open),
    true,
    'native modal is open',
  );

  const text = (await cancelPage.locator('#confirm-dialog').textContent()) ?? '';
  assert.ok(text.includes(intel.name), 'briefing shows the night name');
  assert.ok(text.includes(intel.lesson), 'briefing shows the lesson');
  assert.ok(text.includes(intel.advice), 'briefing shows the advice');
  assert.ok(text.includes(intel.windNote), 'briefing shows the wind');
  assert.equal(await cancelPage.locator('#confirm-dialog').getAttribute('data-day'), '1');
  assert.equal(await cancelPage.locator('#confirm-dialog').getAttribute('data-wind'), intel.wind);
  const groupRows = cancelPage.locator('#confirm-intel .confirm-groups li');
  assert.equal(await groupRows.count(), intel.groups.length, 'every wave group is listed');
  assert.equal(await groupRows.first().getAttribute('data-enemy'), intel.groups[0][0]);
  assert.equal(await groupRows.first().getAttribute('data-count'), String(intel.groups[0][1]));
  assert.equal(await groupRows.first().getAttribute('data-lane'), String(intel.groups[0][2]));
  assert.equal(
    await cancelPage.locator('#confirm-timeline').count(),
    0,
    'without a radio there is no timeline',
  );
  assert.equal(
    await cancelPage.locator('#confirm-wood').textContent(),
    String(open.state.wood),
    'prep summary shows wood',
  );
  assert.equal(await cancelPage.locator('#confirm-scrap').textContent(), String(open.state.scrap));
  assert.equal(
    await cancelPage.locator('#confirm-health').textContent(),
    `${Math.ceil(open.state.health)}%`,
  );
  assert.equal(await cancelPage.locator('#confirm-defenses').textContent(), '0 / 0 / 0');
  assert.equal(await cancelPage.locator('#confirm-perks').textContent(), '暂无');

  const frozen = await cancelPage.evaluate(() => ({
    elapsed: window.__pinefall.state.elapsed,
    wood: window.__pinefall.state.wood,
    player: window.__pinefall.stats.player,
  }));
  await cancelPage.keyboard.down('d');
  await cancelPage.waitForTimeout(800);
  await cancelPage.keyboard.up('d');
  await cancelPage.keyboard.press('n');
  await cancelPage.waitForTimeout(200);
  const held = await cancelPage.evaluate(() => ({
    overlay: window.__pinefall.machine.overlay,
    phase: window.__pinefall.state.phase,
    elapsed: window.__pinefall.state.elapsed,
    wood: window.__pinefall.state.wood,
    player: window.__pinefall.stats.player,
  }));
  assert.equal(held.overlay, 'confirm', 'N inside the briefing does not start the night');
  assert.equal(held.phase, 'day');
  assert.equal(held.elapsed, frozen.elapsed, 'day clock frozen while confirming');
  assert.equal(held.wood, frozen.wood, 'resources frozen while confirming');
  assert.deepEqual(held.player, frozen.player, 'movement frozen while confirming');
  await cancelPage.screenshot({ path: 'artifacts/night-confirm.png' });

  await cancelPage.keyboard.press('Escape');
  await cancelPage.waitForFunction(
    () => window.__pinefall.machine.overlay === 'none' && !window.__pinefall.state.paused,
  );
  const cancelled = await cancelPage.evaluate(() => ({
    machine: window.__pinefall.machine,
    state: window.__pinefall.state,
    stats: window.__pinefall.stats,
  }));
  assert.equal(cancelled.machine.phase, 'day', 'cancel returns to the day');
  assert.equal(cancelled.stats.nightPrompted, true, 'the day remembers the cancelled briefing');
  assert.equal(
    await cancelPage.locator('#confirm-dialog').evaluate((d) => (d as HTMLDialogElement).open),
    false,
  );
  assert.equal(cancelled.state.wood, frozen.wood, 'progress survives the cancel');
  assert.equal(cancelled.state.health, open.state.health);
  assert.equal(cancelled.state.day, open.state.day);

  await cancelPage.waitForTimeout(2000);
  assert.equal(
    await cancelPage.evaluate(() => window.__pinefall.machine.overlay),
    'none',
    'the briefing never re-opens in the same day',
  );
  assert.equal(await cancelPage.evaluate(() => window.__pinefall.stats.nightPrompted), true);

  await cancelPage.evaluate(() => window.__pinefall.setSpeed(1));
  await cancelPage.keyboard.press('n');
  await cancelPage.waitForFunction(() => window.__pinefall.state.phase === 'night', null, {
    timeout: 5000,
  });
  assert.equal(
    await cancelPage.evaluate(() => window.__pinefall.machine.overlay),
    'none',
    'N outside the briefing still commits the night directly',
  );
  assert.equal(
    await cancelPage.evaluate(() => window.__pinefall.stats.nightPrompted),
    false,
    'night resets the session flag',
  );
  assert.deepEqual(cancelErrors, []);
  await cancelPage.close();

  // ——— Confirm path: Enter commits the night and the queue starts for real. ———
  const { page: confirmPage, errors: confirmErrors } = await openOnTimeout();
  await confirmPage.keyboard.press('Enter');
  await confirmPage.evaluate(() => window.__pinefall.setSpeed(1));
  await confirmPage.waitForFunction(() => window.__pinefall.state.phase === 'night', null, {
    timeout: 5000,
  });
  const started = await confirmPage.evaluate(() => ({
    machine: window.__pinefall.machine,
    state: window.__pinefall.state,
    stats: window.__pinefall.stats,
  }));
  assert.equal(started.machine.overlay, 'none', 'confirming closes the overlay');
  assert.equal(started.machine.phase, 'night');
  assert.equal(started.state.paused, false, 'the night runs unpaused');
  assert.ok(started.state.elapsed < 5, 'the >150s day clock was reset into the night');
  assert.equal(
    started.stats.remaining + started.stats.enemies,
    10,
    'the first-night wave is queued in full',
  );
  assert.equal(
    await confirmPage.locator('#confirm-dialog').evaluate((d) => (d as HTMLDialogElement).open),
    false,
  );
  assert.deepEqual(confirmErrors, []);
  await confirmPage.close();

  console.log(
    'PASS: timeout opens #confirm-dialog (overlay=confirm, frozen input/budget), Esc returns to day without re-opening, N stays the direct-start shortcut, Enter confirms into night 1 with the full 10-enemy queue',
  );
} finally {
  await browser.close();
}
