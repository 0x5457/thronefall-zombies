// Original chip score and synthesis; no samples, network requests or gameplay RNG.
// 32-bar arrangements: theme → answer → quiet bridge → full reprise.
// Each authored row is one bar of eighth notes; -1 = rest.
export const MUSIC_LAYERS = ['lead', 'arp', 'bass', 'pad', 'counter', 'drums', 'bells'];
export function createMusicBus(ctx, output) {
  const pans = [-.12, -.65, 0, .35, .6, 0, -.4];
  return Object.fromEntries(MUSIC_LAYERS.map((name, i) => {
    const pan = ctx.createStereoPanner(); pan.pan.value = pans[i]; pan.connect(output);
    return [name, pan];
  }));
}
const bars = rows => rows.map(row => row.split(' ').map(Number));
export const TRACKS = {
  day: {
    title: '松风邮递员', bpm: 104,
    chords: [[48,52,55,59],[43,47,50,57],[45,48,52,55],[40,43,47,50],[41,45,48,52],[48,52,55,59],[50,53,57,60],[43,47,50,55]],
    melody: bars([
      '76 -1 79 76 74 72 -1 74', '74 79 -1 81 79 74 71 -1',
      '72 -1 76 79 81 -1 79 76', '74 71 -1 67 71 74 76 -1',
      '77 -1 81 79 77 76 72 -1', '76 79 -1 84 83 79 76 -1',
      '77 76 74 -1 69 72 74 77', '79 -1 77 74 71 -1 74 -1',
      '84 -1 83 79 76 -1 79 83', '81 79 74 -1 71 74 79 -1',
      '81 -1 84 83 81 79 76 -1', '79 78 76 -1 74 71 67 -1',
      '81 79 77 -1 76 77 81 84', '83 79 76 -1 72 76 79 -1',
      '81 77 74 -1 77 76 74 72', '71 74 79 -1 74 71 72 -1',
    ]),
  },
  night: {
    title: '余火追光', bpm: 128,
    chords: [[45,48,52,55],[41,45,48,52],[48,52,55,59],[43,47,50,53],[50,53,57,60],[45,48,52,55],[41,45,48,52],[40,44,47,50]],
    melody: bars([
      '76 76 -1 79 81 -1 79 76', '77 -1 76 72 69 72 76 -1',
      '79 79 -1 83 84 83 79 -1', '74 -1 79 77 74 71 67 -1',
      '77 77 81 -1 84 81 77 74', '76 -1 81 79 76 72 69 -1',
      '72 77 -1 81 79 77 76 72', '71 -1 68 71 74 -1 76 -1',
      '81 83 84 -1 83 81 79 76', '81 -1 84 81 77 76 72 -1',
      '84 83 79 -1 76 79 83 84', '83 -1 81 79 77 74 71 -1',
      '81 84 86 -1 84 81 77 74', '84 83 81 -1 79 76 72 69',
      '77 81 84 -1 81 79 77 76', '74 71 68 -1 71 74 76 -1',
    ]),
  },
  interior: {
    title: '窗边的小灯', bpm: 76,
    chords: [[53,57,60,64],[48,52,55,62],[50,53,57,60],[45,48,52,55],[46,50,53,57],[53,57,60,64],[43,46,50,53],[48,52,55,58]],
    melody: bars([
      '69 -1 -1 72 76 -1 72 -1', '67 -1 64 -1 62 64 67 -1',
      '65 -1 69 -1 72 -1 74 72', '64 -1 -1 67 69 -1 64 -1',
      '65 -1 70 69 65 -1 62 -1', '60 -1 65 -1 69 72 69 -1',
      '67 -1 65 62 58 -1 62 -1', '64 -1 67 -1 70 69 67 -1',
      '72 -1 76 -1 77 76 72 -1', '74 -1 72 67 64 -1 67 -1',
      '69 -1 72 74 77 -1 74 -1', '76 -1 72 69 67 -1 64 -1',
      '74 -1 77 -1 74 72 70 -1', '72 -1 69 65 60 -1 65 -1',
      '70 -1 69 67 65 -1 62 -1', '64 -1 67 70 69 67 65 -1',
    ]),
  },
};
export const musicScene = (game, inside = false) => inside ? 'interior' : game.phase;
const hz = midi => 440 * 2 ** ((midi - 69) / 12);
export function createReverb(ctx, output, mix = .18) {
  const length = Math.floor(ctx.sampleRate * 1.1), impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  let seed = 811;
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) { seed = (seed * 1103515245 + 12345) >>> 0; data[i] = (seed / 2 ** 32 * 2 - 1) * Math.exp(-i / (ctx.sampleRate * .38)); }
  }
  const send = ctx.createGain(), wet = ctx.createGain(), convolver = ctx.createConvolver();
  wet.gain.value = mix; convolver.buffer = impulse;
  send.connect(convolver); convolver.connect(wet); wet.connect(output);
  return send;
}
// Same mix graph for the game and WAV export. Only tonal parts feed the room reverb.
export function createScoreBus(ctx, output, scene) {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass'; filter.frequency.value = scene === 'interior' ? 2400 : 12000;
  filter.connect(output);
  const bus = createMusicBus(ctx, filter), reverb = createReverb(ctx, filter, scene === 'interior' ? .22 : .14);
  for (const name of ['lead', 'counter', 'bells']) bus[name].connect(reverb);
  return bus;
}
export function threatLevel(enemies, x, z) {
  return Math.min(1, enemies.reduce((sum, e) => sum + (e.alive ? Math.max(0, 1 - Math.hypot(e.mesh.position.x - x, e.mesh.position.z - z) / 18) : 0), 0) / 4);
}
export function createSynth(ctx, maxVoices = 64) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 1729;
  for (let i = 0; i < data.length; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; data[i] = (seed / 2 ** 32 * 2 - 1); }
  const voices = new Set();
  function play(output, type, frequency, at, duration, volume, endFrequency = frequency, attack = .006, sustain = false, detune = 0) {
    if (voices.size >= maxVoices) return;
    const source = type === 'noise' ? ctx.createBufferSource() : ctx.createOscillator();
    const gain = ctx.createGain();
    let filter;
    if (type === 'noise') {
      source.buffer = buffer;
      filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = frequency;
      source.connect(filter); filter.connect(gain);
    } else {
      source.type = type; source.frequency.setValueAtTime(frequency, at);
      if (detune) source.detune.value = detune;
      source.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), at + duration);
      source.connect(gain);
    }
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    if (sustain) gain.gain.linearRampToValueAtTime(volume * .75, at + duration * .65);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    gain.gain.linearRampToValueAtTime(0, at + duration + .012);
    gain.connect(output); source.start(at); source.stop(at + duration + .015);
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); filter?.disconnect(); };
  }
  return { play, get voices() { return voices.size; } };
}

export function musicStep(synth, bus, phase, step, at, tension = 0) {
  const track = TRACKS[phase], tick = 30 / track.bpm;
  const bar = Math.floor(step / 8) % 32, slot = step % 8;
  const chord = track.chords[bar % 8], night = phase === 'night', room = phase === 'interior';
  const bridge = bar >= 16 && bar < 24, reprise = bar >= 24;
  const opening = bar < 2, answer = bar >= 2 && !bridge, turnaround = bar % 4 === 3;
  const row = track.melody[bar % 16];
  const note = bridge ? (slot % 2 === 0 ? chord[slot / 2] + 12 : -1) : row[slot];
  const swing = room && slot % 2 ? tick * .13 : 0;
  at += swing;
  // Seven independently routed parts, all scheduled on the same audio clock.
  // Sparse opening → full phrase → counter-melody → small drum fill into the loop.
  if (note >= 0) {
    const length = row[slot + 1] === -1 || bridge ? 1.65 : .8;
    synth.play(bus.lead, room || bridge ? 'triangle' : 'square', hz(note), at, tick * length, room ? .095 : .052);
    // Detuned twin fattens the chip lead; the echo answers a dotted beat later.
    synth.play(bus.lead, room || bridge ? 'triangle' : 'square', hz(note), at + .012, tick * length, room ? .07 : .038, undefined, .006, false, 9);
    synth.play(bus.bells, 'triangle', hz(note), at + tick * 1.5, tick * 1.1, .024);
    if (reprise && slot % 2 === 0) synth.play(bus.counter, 'triangle', hz(note - 12), at, tick * length, .048);
  }
  if (room || bridge ? slot % 2 === 1 : true) {
    const arp = chord[[0,2,1,3,2,1,3,2][slot]] + 12;
    synth.play(bus.arp, room ? 'sine' : 'triangle', hz(arp), at, tick * .9, .08);
  }
  if (night ? true : [0,3,4,6].includes(slot)) {
    const bass = chord[[0,0,2,0,0,2,1,2][slot]] - (slot === 3 || slot === 7 ? 0 : 12);
    synth.play(bus.bass, 'triangle', hz(bass), at, tick * (room ? 2.1 : .85), night ? .18 : .15);
  }
  if (slot === 0) for (const midi of chord.slice(0, 3)) {
    synth.play(bus.pad, 'triangle', hz(midi + 12), at, tick * 7.8, bridge ? .045 : .038, undefined, .12, true);
  }
  // Answers live mostly between lead attacks, staying below the lead register.
  if (answer && [3,5,7].includes(slot) && (!turnaround || slot < 5)) {
    const counter = chord[[2,1,3,2][Math.floor(slot / 2)]] + 12;
    synth.play(bus.counter, room ? 'triangle' : 'square', hz(counter), at, tick * 1.25, room ? .045 : .032);
  }
  if (!opening && (slot === 0 || (turnaround && slot === 6))) {
    synth.play(bus.bells, 'sine', hz(chord[slot === 0 ? 2 : 3] + 24), at, tick * 2.4, .027);
    synth.play(bus.bells, 'triangle', hz(chord[slot === 0 ? 2 : 3] + 36), at, .12, .009);
  }
  if (!room && (!bridge || night)) {
    if (slot === 0 || slot === 4 || (night && slot === 3)) synth.play(bus.drums, 'sine', 125, at, .13, .11, 42);
    if (slot === 2 || slot === 6) synth.play(bus.drums, 'noise', 1800, at, .085, night ? .085 : .055);
    if (night || slot % 2) synth.play(bus.drums, 'noise', 6200, at, slot === 7 ? .09 : .035, slot % 2 ? .024 : .014);
    if (turnaround && slot === 7) {
      synth.play(bus.drums, 'noise', 2400, at, .06, .025);
      synth.play(bus.drums, 'noise', 1700, at + tick / 2, .07, .055);
      synth.play(bus.drums, 'triangle', 160, at, .12, .085, 75);
    }
  }
  // Adaptive layer: threats nearby add a heartbeat and, past 60%, a grinding semitone.
  if (night && tension > 0) {
    if (slot === 1 || slot === 5) synth.play(bus.drums, 'noise', 520, at, .1, tension * .075);
    if (slot === 0) {
      synth.play(bus.bass, 'triangle', 55, at, .2, .13 * tension, 38);
      synth.play(bus.bass, 'triangle', 55, at + tick * .5, .16, .1 * tension, 36);
    }
    if (tension > .6 && slot === 0) synth.play(bus.pad, 'triangle', hz(chord[0] + 1), at, tick * 7.5, .026 * (tension - .6) / .4, undefined, .3, true);
  }
}

export const EFFECTS = {
  // [wave, Hz, offset, duration, gain, end Hz]
  shoot: [['noise',3600,0,.055,.11],['square',190,0,.06,.035,65]],
  tower: [['noise',2200,0,.08,.12],['triangle',145,0,.1,.09,45]],
  kill: [['triangle',520,0,.1,.06,190],['noise',950,0,.09,.06]],
  build: [['noise',700,0,.11,.13],['square',523,.05,.12,.055],['square',659,.14,.12,.045],['triangle',784,.23,.22,.1]],
  collect: [['square',660,0,.09,.055],['square',880,.08,.14,.045],['triangle',1320,.17,.18,.055]],
  damage: [['noise',600,0,.16,.17],['square',110,0,.18,.07,55]],
  destroy: [['noise',1300,0,.32,.2],['triangle',180,0,.35,.13,35]],
  night: [['triangle',220,0,.35,.12],['square',262,.2,.3,.04],['square',247,.4,.4,.04]],
  dawn: [['triangle',523,0,.25,.12],['triangle',659,.16,.25,.1],['triangle',784,.32,.5,.1]],
  defeat: [['triangle',330,0,.4,.12],['triangle',294,.25,.4,.12],['triangle',220,.5,.65,.12]],
  victory: [['square',523,0,.2,.05],['square',659,.18,.2,.05],['square',784,.36,.2,.05],['triangle',1047,.54,.65,.13]],
};
export function playEffect(synth, output, name, at) {
  for (const [wave, frequency, delay, duration, gain, end] of EFFECTS[name] || []) synth.play(output, wave, frequency, at + delay, duration, gain, end);
}
const STORAGE = 'pinefall.audio.v1';
export function loadAudioSettings(storage) {
  const defaults = { enabled: true, master: .65, music: .65, sfx: .8 };
  try {
    const saved = JSON.parse(storage.getItem(STORAGE));
    if (typeof saved?.enabled === 'boolean') defaults.enabled = saved.enabled;
    for (const key of ['master','music','sfx']) if (Number.isFinite(saved?.[key])) defaults[key] = Math.max(0, Math.min(1, saved[key]));
  } catch { /* Local storage can be disabled; audio still works. */ }
  return defaults;
}
export function createAudio() {
  let storage; try { storage = window.localStorage; } catch { /* private mode */ }
  const settings = loadAudioSettings(storage);
  let ctx, master, music, sceneBuses, sfx, synth, timer, phase = 'day', requestedPhase = 'day', step = 0, next = 0;
  let paused = false, hidden = false, over = false, unlocked = false, tension = 0, targetTension = 0;
  const lastCue = {};
  const counts = {};
  function mix() {
    if (!ctx) return;
    master.gain.setTargetAtTime(settings.enabled ? settings.master : 0, ctx.currentTime, .025);
    music.gain.setTargetAtTime(over ? 0 : settings.music, ctx.currentTime, .08);
    sfx.gain.setTargetAtTime(settings.sfx, ctx.currentTime, .025);
  }
  function schedule() {
    if (!ctx || !unlocked || ctx.state !== 'running' || over || paused || hidden || !settings.enabled) return;
    if (next < ctx.currentTime) next = ctx.currentTime + .025; // Never replay a backlog after a stalled tab.
    while (next < ctx.currentTime + .12) {
      if (step % 8 === 0 && requestedPhase !== phase) {
        phase = requestedPhase; step = 0;
        for (const [name, bus] of Object.entries(sceneBuses)) {
          bus.gain.gain.cancelAndHoldAtTime(next);
          bus.gain.gain.linearRampToValueAtTime(name === phase ? 1 : 0, next + .65);
        }
      }
      tension += ((phase === 'night' ? targetTension : 0) - tension) * .12;
      musicStep(synth, sceneBuses[phase].layers, phase, step, next, tension);
      next += 30 / TRACKS[phase].bpm; step = (step + 1) % 256;
    }
  }
  function lifecycle() {
    if (!ctx || !unlocked) return;
    const shouldRun = settings.enabled && !paused && !hidden;
    const pending = shouldRun ? ctx.resume() : ctx.suspend();
    pending.catch(() => {}); mix();
  }
  function prepare() {
    if (!settings.enabled || ctx) return Boolean(ctx);
    try {
      ctx = new AudioContext();
      master = ctx.createGain(); music = ctx.createGain(); sfx = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -12; limiter.ratio.value = 8;
      music.connect(master); sfx.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
      sceneBuses = Object.fromEntries(Object.keys(TRACKS).map(name => {
        const gain = ctx.createGain();
        gain.gain.value = name === phase ? 1 : 0;
        gain.connect(music);
        return [name, { gain, layers: createScoreBus(ctx, gain, name) }];
      }));
      master.gain.value = 0; music.gain.value = settings.music; sfx.gain.value = settings.sfx;
      synth = createSynth(ctx); timer = setInterval(schedule, 25);
      return true;
    } catch {
      ctx = undefined;
      return false;
    }
  }
  async function unlock() {
    if (!settings.enabled || !prepare()) return;
    // Called directly inside pointer/keyboard gestures for autoplay policy compliance.
    if (!paused && !hidden) await ctx.resume();
    unlocked = true; lifecycle(); schedule();
  }
  function configure(key, value) {
    if (key === 'enabled' && typeof value === 'boolean') settings.enabled = value;
    else if (['master','music','sfx'].includes(key) && Number.isFinite(value)) settings[key] = Math.max(0, Math.min(1, value));
    try { storage?.setItem(STORAGE, JSON.stringify(settings)); } catch { /* no persistence */ }
    mix(); lifecycle();
  }
  function update(game, inside = false, threat = targetTension) {
    targetTension = Number.isFinite(threat) ? Math.max(0, Math.min(1, threat)) : 0;
    requestedPhase = musicScene(game, inside); // Next bar; at most 3.08 s indoors + a .65 s fade.
    if (!ctx) phase = requestedPhase;
    const changed = paused !== game.paused || hidden !== document.hidden || over !== game.over;
    paused = game.paused; hidden = document.hidden; over = game.over;
    if (changed) lifecycle();
  }
  function effect(name) {
    if (!ctx || ctx.state !== 'running' || paused || hidden || !settings.enabled) return;
    const now = ctx.currentTime;
    if (now - (lastCue[name] ?? -Infinity) < (name === 'damage' ? .3 : .065)) return;
    lastCue[name] = now; counts[name] = (counts[name] || 0) + 1;
    playEffect(synth, sfx, name, now + .005);
  }
  return { prepare, unlock, configure, update, effect, get settings() { return { ...settings }; },
    get stats() { return { arrangement: 'v3-adaptive', tension, targetTension, title: TRACKS[phase].title, section: ['主题','对答','间奏','再现'][Math.floor(step / 64) % 4], context: unlocked ? ctx?.state || 'locked' : 'locked', phase, requestedPhase, layers: MUSIC_LAYERS, step, voices: synth?.voices || 0, counts: { ...counts }, ...settings }; },
    dispose() { clearInterval(timer); ctx?.close().catch(() => {}); },
  };
}
