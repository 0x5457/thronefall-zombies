import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/';
const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?home=1`);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.waitForSelector('#home.shown');
  assert.equal(await page.evaluate(() => window.__pinefall.home.visible), true);
  assert.equal(await page.locator('#home h1').textContent(), 'PINEFALL');
  assert.equal(await page.locator('#home-continue').isDisabled(), true, 'no checkpoint yet');
  await page.screenshot({ path: 'artifacts/home-title.png' });

  await page.keyboard.press('n');
  await page.waitForTimeout(400);
  assert.equal(
    (await page.evaluate(() => window.__pinefall.machine)).phase,
    'day',
    'game input is locked on the title screen',
  );
  await page.mouse.click(340, 720);
  await page.screenshot({ path: 'artifacts/home-spark.png' });

  await page.click('#home-start');
  await page.waitForFunction(() => !window.__pinefall.home.visible);
  assert.equal(await page.evaluate(() => window.__pinefall.machine.phase), 'day');
  assert.equal(
    await page.evaluate(() => localStorage.getItem('pinefall.campaign.current') !== null),
    true,
    'a new campaign writes a day-1 checkpoint',
  );

  // Starting again while a checkpoint exists asks for a second click before overwriting.
  await page.goto(`${BASE}?home=1`);
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.waitForSelector('#home.shown');
  assert.equal(await page.locator('#home-continue').isDisabled(), false);
  assert.match(await page.locator('#home-save-info').textContent(), /第 1 天/);
  const before = await page.evaluate(() => localStorage.getItem('pinefall.campaign.current'));
  await page.click('#home-start');
  await page.waitForTimeout(250);
  assert.match(
    await page.locator('#home-start span').textContent(),
    /再点一次/,
    'first click only warns',
  );
  assert.equal(
    await page.evaluate(() => window.__pinefall.home.visible),
    true,
    'still on the title screen after the first click',
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem('pinefall.campaign.current')),
    before,
    'progress untouched before confirmation',
  );
  await page.click('#home-start');
  await page.waitForFunction(() => !window.__pinefall.home.visible);

  const mobile = await browser.newPage({ viewport: { width: 640, height: 780 } });
  await mobile.goto(`${BASE}?home=1`);
  await mobile.waitForSelector('#loading.done', { timeout: 60000 });
  await mobile.waitForSelector('#home.shown');
  await mobile.screenshot({ path: 'artifacts/home-mobile.png' });
  assert.equal(await mobile.locator('#home-start').isVisible(), true);
  await mobile.close();

  assert.deepEqual(errors, [], 'no page errors');
  console.log(
    'PASS: title screen locks input, warns before overwrite, starts day 1 and renders on mobile',
  );
} finally {
  await browser.close();
}
