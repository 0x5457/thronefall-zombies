import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

// T15: the build ghost preview must never survive night, pause, modals or photo mode, and a
// refused selection must not leave the previous ghost behind. Reproduction targets were:
// updateGhost() lacking a phase/pause/modal gate, the render loop only refreshing it on
// pointermove, and selectBuild() returning early without clearing on a failed switch.
const VIEW = { width: 1440, height: 1000, zoom: 23 };
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
  // The camp camera focus is clamped to (0,0) near the spawn, so the view is stable already.
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  const label = page.locator('#world-label');
  const ghostVisible = async (): Promise<boolean> => (await stats()).ghost?.visible ?? false;

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

  async function pointAt(x: number, z: number): Promise<void> {
    const at = project(x, 0, z, (await stats()).camera);
    await page.mouse.move(at.x, at.y);
    await page.waitForTimeout(150);
  }

  // ——— 1. Day: selecting a buildable fence shows the rotated footprint preview. ———
  await page.click('[data-build="fence"]');
  await pointAt(4, -6);
  assert.equal(await ghostVisible(), true, 'day ghost is visible');
  assert.equal(await label.isVisible(), true, 'day label is visible');
  assert.equal((await stats()).ghost?.outline, true, 'preview carries a footprint outline');
  assert.equal((await stats()).ghost?.valid, true, 'fallback preview spot is legal');
  await page.screenshot({ path: 'artifacts/ghost-day.png' });

  // ——— 2. Refused switch (tower costs 35, day starts with 25) clears the old ghost. ———
  await page.keyboard.press('2');
  await page.waitForTimeout(200);
  assert.equal((await stats()).ghost, null, 'refused tower leaves no fence ghost');
  assert.equal(await label.isVisible(), false, 'refused switch hides the label');
  await page.click('[data-build="fence"]');
  await pointAt(4, -6);
  assert.equal(await ghostVisible(), true, 'fence ghost is back for the pause checks');

  // ——— 3. Pause hides the ghost and label; resume brings them back. ———
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__pinefall.state.paused);
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), false, 'pause hides the ghost');
  assert.equal(await label.isVisible(), false, 'pause hides the label');
  await page.keyboard.press('p');
  await page.waitForFunction(() => !window.__pinefall.state.paused);
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), true, 'resume restores the ghost');

  // ——— 4. Photo mode hides the ghost; exiting restores it. ———
  await page.keyboard.press('h');
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), false, 'photo mode hides the ghost');
  assert.equal(await label.isVisible(), false, 'photo mode hides the label');
  await page.keyboard.press('h');
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), true, 'leaving photo mode restores the ghost');

  // ——— 5. Camp manual (Tab) hides the ghost; closing it restores the ghost. ———
  await page.keyboard.press('Tab');
  await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), false, 'manual hides the ghost');
  assert.equal(await label.isVisible(), false, 'manual hides the label');
  await page.keyboard.press('Escape');
  await page.waitForFunction(
    () => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused,
  );
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), true, 'closing the manual restores the ghost');

  // ——— 6. Night-confirm modal: time skip, hidden while open, cancel restores day. ———
  await page.evaluate(() => window.__pinefall.setSpeed(20));
  await page.waitForFunction(
    () => document.querySelector<HTMLDialogElement>('#confirm-dialog')?.open === true,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), false, 'night confirm hides the ghost');
  assert.equal(await label.isVisible(), false, 'night confirm hides the label');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__pinefall.machine.overlay === 'none');
  await page.evaluate(() => window.__pinefall.setSpeed(1));
  await page.waitForTimeout(250);
  assert.equal(await ghostVisible(), true, 'cancelling the confirm returns to the day preview');
  await page.screenshot({ path: 'artifacts/ghost-day-restored.png' });

  // ——— 7. Starting the night clears the ghost; the build key at night leaves none behind. ———
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  await page.waitForTimeout(300);
  assert.equal((await stats()).ghost, null, 'night start clears the ghost');
  assert.equal(await ghostVisible(), false, 'night shows no ghost');
  assert.equal(await label.isVisible(), false, 'night shows no label');
  await page.keyboard.press('2');
  await page.waitForTimeout(200);
  assert.equal((await stats()).ghost, null, 'night build key leaves no ghost');
  assert.equal(await label.isVisible(), false, 'night build key leaves no label');
  await page.screenshot({ path: 'artifacts/ghost-night.png' });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(
    'PASS: T15 ghost preview hidden at pause/manual/confirm/photo/night, restored on day, refused selection leaves no residue',
  );
} finally {
  await browser.close();
}
