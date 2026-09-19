import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1404, height: 1080 },
    reducedMotion: 'reduce',
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  // Reproduce the original view without changing the working tree.
  let effectEnabled = false;
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: effectEnabled ? body : body.replace('addOcclusionSilhouette(player);', ''),
    });
  });
  const load = async () => {
    await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
    await page.waitForSelector('#loading.done', { timeout: 60000 });
    await page.keyboard.press('h');
  };
  async function approachRV() {
    await page.keyboard.down('s');
    await page.waitForFunction(() => window.__pinefall.stats.player[2] > -4);
    await page.keyboard.up('s');
    // Collision stops at the same position regardless of frame timing.
    await page.keyboard.down('s');
    await page.waitForTimeout(700);
    await page.keyboard.up('s');
  }
  await load();
  await approachRV();
  await page.keyboard.press('p');
  const before = await page.evaluate(() => window.__pinefall.stats.player);
  await page.screenshot({ path: 'artifacts/occlusion-before-day.png' });
  effectEnabled = true;
  await load();
  await approachRV();
  await page.keyboard.press('p');
  const after = await page.evaluate(() => window.__pinefall.stats.player);
  assert.ok(Math.abs(before[2] - after[2]) < 0.26, 'same RV-side location');
  await page.screenshot({ path: 'artifacts/occlusion-day.png' });
  await page.keyboard.press('p');
  await page.keyboard.press('n');
  await page.waitForTimeout(9000);
  await page.keyboard.press('p');
  await page.screenshot({ path: 'artifacts/occlusion-night.png' });

  // Pixel-level regression: exact animated model, no obstruction / half / full.
  const pixels = await page.evaluate(async () => {
    // Use the running dev server's transformed import (base may differ from config
    // if Vite was started before the config was added).
    const mainURL = new URL(
      (document.querySelector('script[src*="src/main.ts"]') as HTMLScriptElement).src,
    );
    const moduleURL = new URL('./occlusion.js', mainURL);
    const source = await (await fetch(moduleURL)).text();
    const threeURL = source.match(/from ["']([^"']+)["']/)![1];
    const T = await import(threeURL);
    const { character } = await import(new URL('./world.js', mainURL).href);
    const { addOcclusionSilhouette } = await import(moduleURL.href);
    const renderer = new T.WebGLRenderer({ stencil: true });
    const target = new T.WebGLRenderTarget(128, 128, { stencilBuffer: true });
    renderer.setRenderTarget(target);
    const scene = new T.Scene();
    scene.background = new T.Color('#304035');
    scene.add(new T.AmbientLight(0xffffff, 2));
    const camera = new T.OrthographicCamera(-1.2, 1.2, 2, -0.4, 0.1, 20);
    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);
    const player = character();
    scene.add(player);
    addOcclusionSilhouette(player);
    player.userData.legs[0].rotation.x = 0.6;
    const overlays: { visible: boolean }[] = [];
    player.traverse((o: { name: string; visible: boolean }) => {
      if (o.name === 'occlusion-silhouette') overlays.push(o);
    });
    const wall = new T.Mesh(
      new T.BoxGeometry(3, 3, 0.2),
      new T.MeshBasicMaterial({ color: '#937857' }),
    );
    wall.position.set(0, 0.8, 2);
    scene.add(wall);
    function draw(enabled: boolean) {
      overlays.forEach((o) => {
        o.visible = enabled;
      });
      renderer.render(scene, camera);
      const bytes = new Uint8Array(128 * 128 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 128, 128, bytes);
      return bytes;
    }
    function diff() {
      const a = draw(false),
        b = draw(true);
      let left = 0,
        right = 0;
      const colors = new Set();
      for (let i = 0; i < a.length; i += 4) {
        if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
          if ((i / 4) % 128 < 64) left++;
          else right++;
          colors.add(`${b[i]},${b[i + 1]},${b[i + 2]}`);
        }
      }
      return { left, right, colors: colors.size };
    }
    wall.visible = false;
    const clear = diff();
    wall.visible = true;
    const full = diff();
    wall.position.x = -1.5;
    const partial = diff();
    wall.position.z = -2;
    const behind = diff();
    // Stencil resets between frames, so moving back into the open leaves no trace.
    wall.visible = false;
    const restored = diff();
    renderer.dispose();
    target.dispose();
    return { clear, full, partial, behind, restored, parts: overlays.length };
  });
  assert.equal(pixels.clear.left + pixels.clear.right, 0, 'unoccluded character unchanged');
  assert.ok(pixels.full.left > 100 && pixels.full.right > 100, 'fully hidden character visible');
  assert.equal(pixels.full.colors, 1, 'overlapping limbs do not stack opacity');
  assert.ok(pixels.partial.left > 100, 'hidden half is highlighted');
  assert.equal(pixels.partial.right, 0, 'visible half is unchanged');
  assert.equal(
    pixels.behind.left + pixels.behind.right,
    0,
    'wall behind player does not highlight',
  );
  assert.equal(pixels.restored.left + pixels.restored.right, 0, 'no stale stencil / trail');
  assert.deepEqual(errors, []);
  console.log('PASS: RV repro + day/night screenshots; occlusion pixels', pixels);
} finally {
  await browser.close();
}
