import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  const state = () => page.evaluate(() => window.__pinefall.state);
  const stats = () => page.evaluate(() => window.__pinefall.stats);
  async function walkTo(tx, tz) {
    for (let i = 0; i < 220; i++) {
      const { player: [x, , z] } = await page.evaluate(() => window.__pinefall.stats);
      if (Math.hypot(tx - x, tz - z) < .6) return;
      const held = [];
      if (Math.abs(tx - x) > .3) held.push(tx > x ? 'd' : 'a');
      if (Math.abs(tz - z) > .3) held.push(tz > z ? 's' : 'w');
      for (const key of held) await page.keyboard.down(key);
      await page.waitForTimeout(80);
      for (const key of held) await page.keyboard.up(key);
    }
    throw new Error(`walkTo failed ${tx},${tz}`);
  }
  const enter = async () => {
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning, null, { timeout: 15000 });
  };
  const leave = async () => {
    await page.locator('#leave-rv').click();
    await page.waitForFunction(() => !window.__pinefall.stats.inside && !window.__pinefall.stats.transitioning, null, { timeout: 15000 });
  };
  const openIntel = async () => {
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => window.__pinefall.stats.manualOpen);
    await page.locator('[data-manual-tab="intel"]').click();
  };
  const closeManual = async () => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !window.__pinefall.stats.manualOpen && !window.__pinefall.state.paused);
  };

  // Day 1: the interior sells a real choice — one function slot, six cards.
  await walkTo(5.2, -6); await walkTo(5.4, 1.6); await walkTo(.7, 1.5);
  await enter();
  assert.equal(await page.locator('.rv-card').count(), 6, 'three modules and three decor items');
  assert.match(await page.locator('#rv-furniture').textContent(), /功能槽 0\/1/);
  await page.screenshot({ path: 'artifacts/rv-slots-day.png' });
  await page.locator('[data-rv-install="workbench"]').click();
  await page.waitForFunction(() => window.__pinefall.stats.rv.includes('workbench'));
  const bench = await state();
  assert.equal(bench.wood, 55); assert.equal(bench.scrap, 4);
  await page.locator('[data-rv-mod="range"]').click();
  await page.waitForFunction(() => window.__pinefall.stats.weaponMod === 'range');
  assert.equal((await stats()).playerRange, 10, 'range mod reaches the actual weapon');
  await page.screenshot({ path: 'artifacts/rv-workbench-installed.png' });
  assert.equal(await page.locator('[data-rv-install="radio"]').isDisabled(), true, 'one slot forces a choice');
  assert.match(await page.locator('.rv-reason').first().textContent(), /功能槽不足/);
  await leave();

  // Without the radio the intel page only offers the tip card.
  await openIntel();
  assert.match(await page.locator('#manual-page').textContent(), /短波电台/);
  assert.match(await page.locator('#manual-page').textContent(), /房车 · 未安装/);
  assert.doesNotMatch(await page.locator('#manual-page').textContent(), /今晚时间轴/);
  await closeManual();

  // Swap the bench for a radio: refunds 60%, then the timeline appears.
  await enter();
  await page.locator('[data-rv-remove="workbench"]').click();
  await page.waitForFunction(() => !window.__pinefall.stats.rv.includes('workbench'));
  assert.equal((await stats()).weaponMod, null, 'removing the bench clears the mod');
  assert.equal((await state()).wood, 70, 'bench refunds 15 wood');
  assert.equal((await state()).scrap, 6, 'bench refunds 2 scrap');
  await page.locator('[data-rv-install="radio"]').click();
  await page.waitForFunction(() => window.__pinefall.stats.rv.includes('radio'));
  const radio = await state();
  assert.equal(radio.wood, 60); assert.equal(radio.scrap, 0);
  assert.equal((await stats()).maxMedkits, 2, 'no cabinet, no extra kits');
  await page.screenshot({ path: 'artifacts/rv-radio-installed.png' });
  await leave();

  await openIntel();
  assert.match(await page.locator('#manual-page').textContent(), /时间轴/);
  assert.match(await page.locator('#manual-page').textContent(), /北径 · 游荡者 ×10/);
  await page.screenshot({ path: 'artifacts/rv-intel-radio.png' });
  await closeManual();

  // Night: the radio calls out the next lane and the RV windows light up.
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.state.phase === 'night');
  await page.waitForFunction(() => !document.querySelector('#radio-alert').hidden, null, { timeout: 15000 });
  assert.match(await page.locator('#radio-alert').textContent(), /下一路 北径/);
  await page.waitForFunction(() => window.__pinefall.stats.windowGlow > .2, null, { timeout: 15000 });
  await page.screenshot({ path: 'artifacts/rv-night-radio.png' });
  await page.keyboard.press('h');
  await page.mouse.move(720, 500);
  await page.mouse.wheel(0, -900);
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'artifacts/rv-night-windows.png' });
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(300);
  await page.keyboard.press('h');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('PASS: RV slots force a choice, mods alter the real weapon, radio sells timeline + night alert, windows glow');
} finally { await browser.close(); }
