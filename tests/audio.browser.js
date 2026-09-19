import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const browser = await chromium.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://localhost:5173/thronefall-zombies/');
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await mkdir('artifacts', { recursive: true });
  const audio = () => page.evaluate(() => window.__pinefall.audio);
  assert.equal((await audio()).context, 'locked');
  await page.click('#sound');
  await page.waitForFunction(() => window.__pinefall.audio.step > 2);
  assert.equal((await audio()).context, 'running');
  assert.equal((await audio()).layers.length, 7);
  assert.equal((await audio()).arrangement, 'v3-adaptive');
  await page.locator('.audio-settings summary').click();
  await page.locator('#audio-music').fill('44');
  assert.equal((await audio()).music, 0.44);
  await page.screenshot({ path: 'artifacts/audio-day.png' });
  await page.locator('.audio-settings summary').click();
  await page.keyboard.press('p');
  await page.waitForTimeout(200);
  const paused = await audio();
  assert.equal(paused.context, 'suspended');
  await page.waitForTimeout(400);
  assert.equal((await audio()).step, paused.step);
  await page.keyboard.press('p');
  await page.waitForFunction(() => window.__pinefall.audio.context === 'running');
  // Build through actual UI/placement, not a test-only sound trigger.
  await page.click('[data-build="tower"]');
  for (const [x, y] of [
    [720, 390],
    [640, 380],
    [820, 390],
    [850, 500],
  ]) {
    await page.mouse.move(x, y);
    await page.waitForTimeout(120);
    if (!(await page.locator('#world-label').getAttribute('class')).includes('invalid')) {
      await page.mouse.click(x, y);
      break;
    }
  }
  assert.equal((await audio()).counts.build, 1);
  await page.keyboard.press('n');
  await page.waitForFunction(() => window.__pinefall.audio.phase === 'night', null, {
    timeout: 10000,
  });
  assert.equal((await audio()).counts.night, 1);
  await page.waitForTimeout(6000);
  await page.screenshot({ path: 'artifacts/audio-night.png' });
  console.log('gameplay cues observed', (await audio()).counts);
  await page.click('#sound');
  await page.waitForTimeout(200);
  assert.equal((await audio()).context, 'suspended');
  await page.reload();
  await page.waitForSelector('#loading.done', { timeout: 60000 });
  await page.click('#photo');
  assert.equal((await audio()).context, 'locked', 'saved mute survives other gestures');
  assert.equal((await audio()).music, 0.44);
  await page.keyboard.press('h');
  await page.click('#sound');
  await page.waitForFunction(() => window.__pinefall.audio.context === 'running');

  // Render the SAME score/synth in an OfflineAudioContext: verify actual PCM, not just API calls.
  const result = await page.evaluate(async () => {
    const mainScript = document.querySelector('script[src*="main.js"]').src;
    const audioModule = await import(new URL('audio.js', new URL('./', mainScript)).href);
    const { TRACKS, createSynth, createScoreBus, musicStep, EFFECTS, playEffect } = audioModule;
    const outputs = [];
    for (const phase of ['day', 'night', 'interior', 'sfx']) {
      const rate = 22050,
        seconds =
          phase === 'sfx'
            ? Object.keys(EFFECTS).length * 1.4 + 1
            : (256 * 30) / TRACKS[phase].bpm + 2;
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const gain = ctx.createGain();
      gain.gain.value = 0.65 * 0.65;
      gain.connect(ctx.destination);
      // Offline scheduling enqueues the entire score at once; realtime caps only the look-ahead window.
      const synth = createSynth(ctx, 10000),
        bus = createScoreBus(ctx, gain, phase);
      if (phase === 'sfx')
        Object.keys(EFFECTS).forEach((name, i) => playEffect(synth, gain, name, i * 1.4));
      else
        for (let i = 0; i < 256; i++)
          musicStep(
            synth,
            bus,
            phase,
            i,
            (i * 30) / TRACKS[phase].bpm,
            phase === 'night' && i >= 128 ? 0.85 : 0,
          );
      const buffer = await ctx.startRendering();
      const left = buffer.getChannelData(0),
        right = buffer.getChannelData(1);
      let peak = 0,
        sum = 0,
        stereo = 0;
      const wav = new ArrayBuffer(44 + left.length * 4),
        view = new DataView(wav);
      const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      text(0, 'RIFF');
      view.setUint32(4, wav.byteLength - 8, true);
      text(8, 'WAVE');
      text(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 2, true);
      view.setUint32(24, rate, true);
      view.setUint32(28, rate * 4, true);
      view.setUint16(32, 4, true);
      view.setUint16(34, 16, true);
      text(36, 'data');
      view.setUint32(40, left.length * 4, true);
      for (let i = 0; i < left.length; i++) {
        peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
        sum += left[i] ** 2;
        stereo += Math.abs(left[i] - right[i]);
        view.setInt16(44 + i * 4, Math.max(-1, Math.min(1, left[i])) * 32767, true);
        view.setInt16(46 + i * 4, Math.max(-1, Math.min(1, right[i])) * 32767, true);
      }
      let binary = '';
      const bytes = new Uint8Array(wav);
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      outputs.push({
        phase,
        seconds,
        peak,
        rms: Math.sqrt(sum / left.length),
        stereo: stereo / left.length,
        voices: synth.voices,
        wav: btoa(binary),
      });
    }
    return outputs;
  });
  for (const output of result) {
    console.log('PCM', output.phase, output.peak, output.rms, output.stereo);
    await writeFile(`artifacts/pinefall-${output.phase}.wav`, Buffer.from(output.wav, 'base64'));
    assert.ok(
      output.peak > 0.01 && output.peak < 0.95,
      `${output.phase} non-silent, headroom before compressor`,
    );
    assert.ok(output.rms > 0.001);
    if (output.phase !== 'sfx') assert.ok(output.stereo > 0.001, 'stereo layers differ');
    delete output.wav;
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', renders: result, errors }, null, 2));
} finally {
  await browser.close();
}
