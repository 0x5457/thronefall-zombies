import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { OrthographicCamera, Vector3 } from 'three';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const game = () =>
    page.evaluate(() => ({ ...window.__pinefall.state, ...window.__pinefall.stats }));
  const camera = new OrthographicCamera(-23 * 1.44, 23 * 1.44, 23, -23, 0.1, 260);
  camera.position.set(2, 46, 37);
  camera.lookAt(0, 0, -0.3);
  camera.updateMatrixWorld();
  const build = async (x: number, z: number) => {
    await page.click('[data-build="tower"]');
    const p = new Vector3(x, 0, z).project(camera);
    await page.mouse.move((p.x + 1) * 720, (1 - p.y) * 500);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.mouse.up();
  };

  // A real dawn checkpoint: start a campaign (day-1 slot), survive night 1 and pick a perk.
  await page.goto(BASE);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__pinefall.startNew()), undefined);
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('pinefall.campaign.current')!).state.day,
    ),
    1,
  );
  await build(-2, -8);
  await build(8, 2);
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.perkPending, null, { timeout: 300000 });
  const before = await game();
  assert.equal(before.buildings, 2);
  await page.locator('#perk-options button').first().click();
  await page.waitForFunction(() => !window.__pinefall.state.perkPending);
  const checkpoint = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('pinefall.campaign.current')!),
  );
  assert.equal(checkpoint.version, 1);
  assert.equal(checkpoint.phase, 'day');
  assert.equal(checkpoint.state.day, 2);
  assert.equal(checkpoint.state.buildings.length, 2, 'buildings serialize as plain data');
  assert.equal(checkpoint.state.perks.length, 1);
  assert.ok(
    checkpoint.state.logs.every((l: { id: string }) => typeof l.id === 'string'),
    'logs serialize with stable ids',
  );
  assert.equal('mesh' in checkpoint.state.buildings[0], false, 'meshes never enter the save');

  // The title screen offers the checkpoint and resumes exactly there.
  await page.goto(`${BASE}?home=1`);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.waitForSelector('#home.shown');
  assert.match((await page.locator('#home-save-info').textContent())!, /第 2 天/);
  await page.screenshot({ path: 'artifacts/save-home-day2.png' });
  await page.click('#home-continue');
  await page.waitForFunction(() => !window.__pinefall.home.visible);
  const resumed = await game();
  assert.equal(resumed.day, 2);
  assert.equal(resumed.perks.length, 1);
  assert.equal(resumed.buildings, 2, 'buildings are rebuilt from data');
  assert.equal(resumed.buildingLevels.length, 2);

  // A corrupt current slot falls back to the previous day-1 backup.
  await page.evaluate(() => localStorage.setItem('pinefall.campaign.current', '{broken json'));
  await page.goto(`${BASE}?home=1`);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.waitForSelector('#home.shown');
  assert.match(
    (await page.locator('#home-save-info').textContent())!,
    /第 1 天/,
    'backup recovered',
  );
  assert.equal(await page.locator('#home-continue').isDisabled(), false);
  await page.click('#home-continue');
  await page.waitForFunction(() => !window.__pinefall.home.visible);
  assert.equal((await game()).day, 1);

  // A future save version is refused and left untouched.
  await page.evaluate(() => {
    const future = JSON.parse(localStorage.getItem('pinefall.campaign.backup')!);
    future.version = 99;
    for (const key of ['pinefall.campaign.current', 'pinefall.campaign.backup'])
      localStorage.setItem(key, JSON.stringify(future));
  });
  await page.goto(`${BASE}?home=1`);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.waitForSelector('#home.shown');
  assert.equal(
    await page.locator('#home-continue').isDisabled(),
    true,
    'newer versions are never loaded',
  );
  assert.match(
    (await page.locator('#home-save-info').textContent())!,
    /损坏|无法/,
    'the refusal is explained',
  );
  const kept = await page.evaluate(
    () => JSON.parse(localStorage.getItem('pinefall.campaign.current')!).version,
  );
  assert.equal(kept, 99, 'refusing a save never rewrites it');
  await page.screenshot({ path: 'artifacts/save-home-refused.png' });

  assert.deepEqual(errors, [], 'no page errors');
  console.log(
    'PASS: real dawn checkpoint saves, title continue resumes it, corrupt falls back, future version refused',
  );
} finally {
  await browser.close();
}
