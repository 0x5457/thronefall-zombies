import './style.css';
import './ui-polish.css';
import * as T from 'three';
import { cameraFocus } from './map.js';
import { addOcclusionSilhouette } from './occlusion.js';
import { createAudio, threatLevel } from './audio.js';
import { makeInterior, interiorBlocked } from './interior.js';
import { makeWorld, character, structure, walkable, box, seeded } from './world.js';
import { COSTS, NAMES, newGame, canBuild, buy, advance, damageCamp, waveSize, overlaps, PERKS, choosePerk, attackDamage, logYield, DAY_LENGTH } from './rules.js';

const $ = selector => document.querySelector(selector);
const loading = $('#loading'), loadingBar = $('#loading-progress-bar'), loadingPercent = $('#loading-percent'), loadingMessage = $('#loading-message-text');
let loadingProgress = 0;
function setLoadingProgress(value, message) {
  loadingProgress = Math.max(0, Math.min(100, Math.round(value)));
  loadingBar.style.width = `${loadingProgress}%`;
  loadingPercent.textContent = `${loadingProgress}%`;
  loadingMessage.textContent = message;
  loading.querySelector('.loading-progress').setAttribute('aria-valuenow', String(loadingProgress));
}
setLoadingProgress(0, '正在整理资源');
const canvas = $('#world');
const renderer = new T.WebGLRenderer({ canvas, antialias: false, stencil: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new T.Scene(); scene.background = new T.Color('#6d7f61');
const camera = new T.OrthographicCamera(-27, 27, 21, -21, .1, 260);
const cameraCenter = new T.Vector3();
camera.position.set(2, 46, 37); camera.lookAt(0, 0, -.3);
const sun = new T.DirectionalLight('#fff0ce', 2.5);
sun.position.set(-26, 35, -22); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 43, bottom: -43, near: 1, far: 115 });
sun.shadow.normalBias = .055; sun.shadow.bias = -.00015;
scene.add(sun, sun.target);
const sky = new T.HemisphereLight('#d4e2e2', '#92906f', 2.1); scene.add(sky);
const fill = new T.AmbientLight('#b0c7b8', .28); scene.add(fill);
const world = makeWorld(scene);
setLoadingProgress(32, '营地材质已就绪');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let ambientTime = 0;
const state = newGame();
let inside = false, interior = null, rvTransition = null;
const outsidePosition = new T.Vector3();
let outsideRotation = 0;
const doorPosition = new T.Vector3(0, .2, .95);
const random = seeded(3241);
const player = character(); player.position.set(1, 0, -6.1); scene.add(player);
addOcclusionSilhouette(player);
const marker = new T.Mesh(new T.RingGeometry(.47, .53, 24), new T.MeshBasicMaterial({ color: '#ead59a', transparent: true, opacity: .75, side: T.DoubleSide }));
marker.rotation.x = -Math.PI / 2; marker.position.y = .035; scene.add(marker);
const obstacles = [ { x: -1, z: -1.6, r: 0 }, { x: -5.5, z: 4.1, r: 1.5 }, { x: 5.2, z: 4.3, r: 1.5 }, { x: .1, z: 5.6, r: .9 }, { x: -8.5, z: -2.5, r: 1.4 } ];
const buildings = [], enemies = [], shots = [], particles = [], keys = new Set();
const raycaster = new T.Raycaster(), pointer = new T.Vector2(), cursor = new T.Vector3();
const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0), v = new T.Vector3();
let selected = null, ghost = null, ghostAngle = 0, validPlacement = false, pointerInside = false;
let daylight = 1, time = 0, last = performance.now(), zoom = 23, shotTimer = 0, spawnTimer = 0, remaining = 0, toastTimer;
let movementTarget = null, photoMode = false, manualPause = false;
const audio = createAudio();
const ghostMaterial = new T.MeshBasicMaterial({ color: '#ead176', wireframe: true, transparent: true, opacity: .6, depthWrite: false });
const sparkMaterial = new T.MeshBasicMaterial({ color: '#ffcf76', transparent: true });
const cube = new T.BoxGeometry(1, 1, 1);
// Fixed-size pools cover this small camp. Increase pool sizes before adding larger maps/waves.
for (let i = 0; i < 80; i++) {
  const m = character(true); m.visible = false; scene.add(m);
  enemies.push({ mesh: m, alive: false, hp: 0, attack: 0, speed: 0, seed: random() * 20 });
}
for (let i = 0; i < 64; i++) {
  const m = new T.Mesh(cube, new T.MeshBasicMaterial({ color: '#ffe6a1' })); m.visible = false; scene.add(m);
  shots.push({ mesh: m, life: 0 });
}
for (let i = 0; i < 100; i++) {
  const m = new T.Mesh(cube, sparkMaterial); m.visible = false; scene.add(m);
  particles.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
}
const fireflyCount = 110, fireflyPositions = new Float32Array(fireflyCount * 3), fireflyColors = new Float32Array(fireflyCount * 3), fireflySeeds = [];
for (let i = 0; i < fireflyCount; i++) fireflySeeds.push({ x: (random() - .5) * 45, z: (random() - .5) * 39, y: .3 + random() * 2.3, phase: random() * 6.28 });
const fireflyGeo = new T.BufferGeometry(); fireflyGeo.setAttribute('position', new T.BufferAttribute(fireflyPositions, 3));
fireflyGeo.setAttribute('color', new T.BufferAttribute(fireflyColors, 3));
// Positions drift within this fixed volume; don't retain the first frame's bounds.
fireflyGeo.boundingSphere = new T.Sphere(new T.Vector3(), 35);
const fireflyMat = new T.PointsMaterial({ color: '#e9d58f', size: .09, transparent: true, opacity: 0, vertexColors: true, depthWrite: false, blending: T.AdditiveBlending });
scene.add(new T.Points(fireflyGeo, fireflyMat));
// Small drifting smoke diamonds: no external art assets or opaque particle planes.
const smoke = [];
for (let i = 0; i < 13; i++) {
  const m = new T.Mesh(new T.IcosahedronGeometry(1, 0), new T.MeshBasicMaterial({ color: '#bac0a5', transparent: true, opacity: .11, depthWrite: false }));
  scene.add(m); smoke.push(m);
}
setLoadingProgress(46, '环境细节已就绪');
function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200); }
function syncUI() {
  audio.update(state, inside, threatLevel(enemies, player.position.x, player.position.z));
  $('#owned-perks').textContent = state.perks.length ? `专长 · ${state.perks.map(id => PERKS[id].name).join(' / ')}` : '专长 · 守过首夜后选择';
  $('#wood').textContent = state.wood; $('#health').textContent = Math.ceil(state.health); $('#kills').textContent = state.kills;
  $('#health-bar').style.width = `${state.health}%`;
  $('#day-label').textContent = `${state.phase === 'day' ? 'DAY' : 'NIGHT'} ${String(state.day).padStart(2, '0')}`;
  $('#phase-icon').textContent = state.phase === 'day' ? '☀' : '☾';
  $('#phase-label').textContent = state.paused ? '时光暂停' : state.phase === 'day' ? '午后 · 营地建设' : `守夜 · 剩余敌人 ${remaining + enemies.filter(e => e.alive).length}`;
  $('#day-progress').style.width = `${Math.min(100, state.elapsed / DAY_LENGTH * 100)}%`;
  $('#day-progress').style.opacity = state.phase === 'day' ? 1 : 0;
  $('#note-number').textContent = String(state.day).padStart(2, '0');
  $('#note-title').textContent = state.phase === 'day' ? '天黑之前，先安个家。' : '别让最后一束光熄灭。';
  $('#note-body').textContent = state.phase === 'day' ? '在空地建起防线。松林深处，并不只有风声。' : `第 ${state.day} 夜 · 自动射击已就绪，守住房车直到黎明。`;
  $('#next-phase').innerHTML = state.phase === 'day' ? '迎接夜晚 <span>→</span>' : '等待黎明 <span>→</span>';
  $('#build-hint').textContent = state.phase === 'night' ? '夜间无法建造 · 守住营地' : selected ? 'R 旋转 · Esc 取消' : '选择建筑 · 点击空地放置';
  document.querySelectorAll('[data-build]').forEach(button => { button.disabled = inside || !canBuild(state, button.dataset.build); button.classList.toggle('selected', selected === button.dataset.build); });
  $('#pause').textContent = state.paused ? '▷' : 'Ⅱ'; $('#pause').setAttribute('aria-pressed', String(state.paused));
}
function setPause(value) { manualPause = value; state.paused = value || $('#help-dialog').open || $('#perk-dialog').open; keys.clear(); movementTarget = null; syncUI(); }
function openPerks() {
  if (!state.perkPending || state.over || $('#perk-dialog').open) return;
  selectBuild(null); keys.clear(); movementTarget = null;
  $('#perk-summary').textContent = `第 ${state.day - 1} 夜已守住 · 击退 ${state.kills} · 营地耐久 ${Math.ceil(state.health)}%。选择期间不消耗准备时间。`;
  $('#perk-options').replaceChildren(...Object.entries(PERKS).filter(([id]) => !state.perks.includes(id)).map(([id, perk]) => {
    const button = document.createElement('button'); button.dataset.perk = id;
    const title = document.createElement('strong'), text = document.createElement('span');
    title.textContent = perk.name; text.textContent = perk.currentText; button.append(title, text);
    button.addEventListener('click', () => {
      if (!choosePerk(state, id)) return;
      $('#perk-dialog').close(); setPause(manualPause); $('#world').focus();
      toast(`获得专长：${perk.name}`);
    });
    return button;
  }));
  $('#perk-dialog').showModal(); setPause(manualPause);
}
$('#perk-dialog').addEventListener('cancel', event => event.preventDefault());
$('#perk-dialog').addEventListener('close', () => { if (state.perkPending) openPerks(); else setPause(manualPause); });
function selectBuild(type) {
  if ((inside || rvTransition) && type) return;
  if (selected === type || !type) { selected = null; if (ghost) scene.remove(ghost); ghost = null; $('#world-label').style.display = 'none'; syncUI(); return; }
  if (!canBuild(state, type)) { toast(state.phase === 'night' ? '夜色太深了，等天亮再施工。' : '木材不足，靠近倒木按 E 收集。'); return; }
  if (ghost) scene.remove(ghost);
  selected = type; ghost = structure(type); ghost.traverse(o => { if (o.isMesh) { o.material = ghostMaterial; o.castShadow = false; } });
  ghost.rotation.y = ghostAngle; ghost.visible = false; scene.add(ghost); syncUI();
}
function rvCollision(x, z, padding = .4) { return Math.abs(x + 1) < 4.7 + padding && Math.abs(z + 1.6) < 1.65 + padding; }
function canPlace(x, z) {
  const radius = selected === 'tower' ? 1.5 : selected === 'fence' ? 1.25 : .4;
  return Math.hypot(x - doorPosition.x, z - doorPosition.z) > radius + 1.3 && walkable(x, z) && Math.hypot(x, z) < 18 && !rvCollision(x, z, radius) && !overlaps(x, z, obstacles.slice(1), radius) && !overlaps(x, z, world.trees, radius) && !overlaps(x, z, buildings, radius);
}
function updateGhost() {
  if (!ghost) return;
  ghost.visible = pointerInside;
  if (!pointerInside) { $('#world-label').style.display = 'none'; return; }
  const x = Math.round(cursor.x * 2) / 2, z = Math.round(cursor.z * 2) / 2;
  ghost.position.set(x, .04, z); validPlacement = canPlace(x, z) && canBuild(state, selected);
  ghostMaterial.color.set(validPlacement ? '#efd17c' : '#cb745c');
  v.set(x, selected === 'tower' ? 5.7 : 2, z).project(camera);
  const label = $('#world-label'); label.style.display = 'block'; label.style.left = `${(v.x + 1) * innerWidth / 2}px`; label.style.top = `${(1 - v.y) * innerHeight / 2}px`;
  label.textContent = validPlacement ? `${NAMES[selected]} · ▰ ${COSTS[selected]} · 点击建造` : '这里无法建造'; label.classList.toggle('invalid', !validPlacement);
}
function burst(x, y, z, count = 12) {
  let n = 0;
  for (const p of particles) if (p.life <= 0) { p.life = .5 + random() * .7; p.mesh.visible = true; p.mesh.position.set(x, y, z); p.mesh.scale.setScalar(.045 + random() * .09); p.vx = (random() - .5) * 3; p.vy = 1 + random() * 3; p.vz = (random() - .5) * 3; if (++n >= count) break; }
}
function place() {
  if (inside || !selected || !validPlacement || !buy(state, selected)) return;
  const type = selected, m = structure(type), p = ghost.position;
  m.position.set(p.x, 0, p.z); m.rotation.y = ghostAngle; m.scale.setScalar(.01); scene.add(m);
  const building = { mesh: m, type, x: p.x, z: p.z, r: type === 'tower' ? 1.2 : type === 'fence' ? 1 : .35, hp: type === 'fence' ? 150 : 220, growth: 0, cooldown: 0, light: null };
  if (type === 'lantern') { const light = new T.PointLight('#ffcf7e', 0, 9, 1.5); light.position.set(p.x, 2.6, p.z); scene.add(light); building.light = light; }
  buildings.push(building); burst(p.x, .5, p.z, 23); audio.effect('build'); toast(`${NAMES[type]}建造完成 · −${COSTS[type]} 木材`); selectBuild(null); syncUI();
}
function updatePointer(event) {
  pointer.x = event.clientX / innerWidth * 2 - 1; pointer.y = 1 - event.clientY / innerHeight * 2;
  raycaster.setFromCamera(pointer, camera); raycaster.ray.intersectPlane(groundPlane, cursor); pointerInside = true;
}
canvas.addEventListener('pointermove', event => { updatePointer(event); updateGhost(); });
canvas.addEventListener('pointerleave', () => { pointerInside = false; updateGhost(); });
canvas.addEventListener('pointerdown', event => { if (rvTransition || inside || state.paused || state.over) return; updatePointer(event); if (selected) { updateGhost(); place(); } else if (walkable(cursor.x, cursor.z)) movementTarget = cursor.clone(); });
canvas.addEventListener('contextmenu', event => { event.preventDefault(); selectBuild(null); });
canvas.addEventListener('wheel', event => { event.preventDefault(); if (inside || rvTransition) return; zoom = T.MathUtils.clamp(zoom + event.deltaY * .008, 12, 32); resize(); }, { passive: false });
document.querySelectorAll('[data-build]').forEach(button => button.addEventListener('click', () => selectBuild(button.dataset.build)));
function nearDoor() { return player.position.z > .45 && player.position.distanceTo(doorPosition) < 1.65; }
function enterOrExit() {
  if (rvTransition || state.paused || state.over) return;
  if (!inside && (!nearDoor() || state.phase !== 'day')) {
    if (nearDoor()) toast('夜晚留在外面守住营地，天亮后再进入房车。');
    return;
  }
  if (!interior) interior = makeInterior();
  selectBuild(null); movementTarget = null; keys.clear(); pointerInside = false;
  if (motionPreference.matches) { switchRV(); return; }
  rvTransition = { elapsed: 0, switched: false, center: cameraCenter.clone() };
  $('#rv-fade').hidden = false; $('#rv-door').hidden = true;
}
function switchRV() {
  if (inside) {
    inside = false; scene.add(player); player.position.copy(outsidePosition); player.rotation.y = outsideRotation;
  } else {
    if (!nearDoor()) return;
    if (state.phase !== 'day') { toast('夜晚留在外面守住营地，天亮后再进入房车。'); return; }
    selectBuild(null);
    if (!interior) interior = makeInterior();
    outsidePosition.copy(player.position); outsideRotation = player.rotation.y;
    inside = true; interior.scene.add(player); player.position.set(1.02, .06, .85); player.rotation.y = Math.PI;
  }
  movementTarget = null; keys.clear(); pointerInside = false;
  $('#app').classList.toggle('inside-rv', inside);
  $('#interior-panel').hidden = !inside;
  $('#rv-door').hidden = true;
  if (inside) $('#leave-rv').focus(); else $('#world').focus();
  resize(); syncUI();
}
$('#rv-door').addEventListener('click', enterOrExit);
$('#leave-rv').addEventListener('click', enterOrExit);
$('#rv-lamp').addEventListener('click', () => {
  if (!inside || rvTransition || state.paused || state.over) return;
  const on = interior.toggleLamp();
  $('#rv-lamp').setAttribute('aria-pressed', String(on));
  $('#rv-lamp').textContent = `床头灯 · ${on ? '已开启' : '已关闭'}`;
  toast(on ? '床头灯亮了。' : '床头灯已关闭，窗光仍照亮过道。');
});
function collect() {
  if (rvTransition || state.paused || state.over) return;
  if (inside || nearDoor()) { enterOrExit(); return; }
  const log = world.logs.find(log => Math.hypot(player.position.x - log.x, player.position.z - log.z) < 3);
  if (!log) { toast('靠近森林边缘的倒木，再按 E 收集。'); return; }
  if (!log.remaining) { toast('这段倒木已收集完，明天再来。'); return; }
  const amount = logYield(state);
  log.remaining--; state.wood += amount; burst(log.x, .6, log.z); audio.effect('collect'); toast(`收集木材 +${amount}`); syncUI();
}
function transition() {
  if (rvTransition) return;
  if (inside) { toast('先离开房车，再迎接夜晚。'); return; }
  if (state.paused || state.over) return;
  const cleared = state.phase === 'night' && remaining === 0 && !enemies.some(e => e.alive);
  if (!advance(state, cleared)) {
    toast(state.perkPending ? '请先选择黎明专长。' : '仍有敌人在林中，清除全部来袭者才能迎接黎明。');
    return;
  }
  audio.update(state, inside);
  if (state.over) { endGame(); syncUI(); return; }
  audio.effect(state.phase === 'night' ? 'night' : 'dawn');
  selectBuild(null);
  if (state.phase === 'night' && !state.over) { remaining = waveSize(state.day); spawnTimer = 1; toast(`第 ${state.day} 夜 · 松林里传来了脚步声`); }
  else if (!state.over) { world.logs.forEach(l => l.remaining = 4); shotTimer = 0; toast('天亮了。营地补给已送达。'); openPerks(); }
  syncUI();
}
$('#next-phase').addEventListener('click', transition);
function togglePhoto() { photoMode = !photoMode; $('#app').classList.toggle('photo-mode', photoMode); $('#photo-hint').hidden = !photoMode; }
$('#photo').addEventListener('click', togglePhoto);
$('#pause').addEventListener('click', () => setPause(!manualPause));
function openHelp() { $('#help-dialog').showModal(); state.paused = true; keys.clear(); syncUI(); }
function closeHelp() { $('#help-dialog').close(); setPause(manualPause); }
$('#help').addEventListener('click', openHelp); $('#help-start').addEventListener('click', closeHelp); $('#help-dialog .close').addEventListener('click', closeHelp);
$('#help-dialog').addEventListener('close', () => setPause(manualPause));
$('#restart').addEventListener('click', () => location.reload());
addEventListener('keydown', event => {
  if (event.target instanceof HTMLInputElement || $('#help-dialog').open || $('#end-dialog').open || $('#perk-dialog').open) return;
  const key = event.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) || (key === ' ' && !(event.target instanceof HTMLButtonElement))) event.preventDefault();
  if (rvTransition && key !== 'p') { event.preventDefault(); return; }
  keys.add(key); if (event.repeat) return;
  if ('123'.includes(key) && key.length === 1) selectBuild(['fence', 'tower', 'lantern'][Number(key) - 1]);
  if (key === 'escape') { if (inside) enterOrExit(); else selectBuild(null); }
  if (key === 'r' && ghost) { ghostAngle += Math.PI / 2; ghost.rotation.y = ghostAngle; }
  if (key === 'e') collect(); if (key === 'n') transition(); if (key === 'h') togglePhoto(); if (key === 'p') setPause(!manualPause);
});
addEventListener('keyup', event => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => { keys.clear(); movementTarget = null; });
document.addEventListener('visibilitychange', () => { last = performance.now(); if (document.hidden) keys.clear(); audio.update(state, inside); });
function blocked(x, z) { if (inside) return interiorBlocked(x, z); return !walkable(x, z) || rvCollision(x, z) || overlaps(x, z, obstacles.slice(1), .23) || overlaps(x, z, world.trees, .22) || overlaps(x, z, buildings, .22); }
function movePlayer(dt) {
  let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  let dz = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx || dz) movementTarget = null;
  else if (movementTarget) { dx = movementTarget.x - player.position.x; dz = movementTarget.z - player.position.z; if (Math.hypot(dx, dz) < .25) { movementTarget = null; dx = dz = 0; } }
  const length = Math.hypot(dx, dz), moving = length > .01;
  if (moving) {
    const speed = inside ? 2.2 : 5.1;
    dx = dx / length * dt * speed; dz = dz / length * dt * speed;
    const p = player.position;
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    player.rotation.y = Math.atan2(dx, dz);
  }
  player.userData.body.position.y = moving ? Math.abs(Math.sin(time * 13)) * .06 : Math.sin(time * 2) * .014;
  player.userData.legs.forEach((leg, i) => leg.rotation.x = moving ? Math.sin(time * 13 + i * Math.PI) * .6 : 0);
  marker.position.x = player.position.x; marker.position.z = player.position.z;
}
function spawn() {
  const enemy = enemies.find(e => !e.alive); if (!enemy) return;
  const side = remaining % 3, p = enemy.mesh.position;
  if (side === 0) p.set(-2 + random() * 3, 0, -29);
  else if (side === 1) p.set(-28, 0, -.5 + random() * 3);
  else p.set(18, 0, 9 + random() * 2);
  enemy.alive = true; enemy.hp = 3 + Math.floor(state.day / 3); enemy.attack = 0; enemy.speed = .8 + random() * .35 + Math.min(state.day, 10) * .055; enemy.mesh.visible = true; remaining--;
}
function fire(from, target, damage = 1) {
  const shot = shots.find(s => s.life <= 0);
  if (shot) { const end = target.mesh.position; v.set(end.x - from.x, .85 - from.y, end.z - from.z); shot.mesh.position.set(from.x + v.x / 2, from.y + v.y / 2, from.z + v.z / 2); shot.mesh.scale.set(.035, v.length(), .035); shot.mesh.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP, v.normalize()); shot.mesh.visible = true; shot.life = .075; }
  target.hp -= attackDamage(state, damage, from.y > 2); burst(target.mesh.position.x, .9, target.mesh.position.z, 3);
  if (target.hp <= 0) { target.alive = false; target.mesh.visible = false; state.kills++; state.wood += 2; audio.effect('kill'); syncUI(); }
  audio.effect(from.y > 2 ? 'tower' : 'shoot');
}
const shotFrom = new T.Vector3();
function nearest(x, z, range) { let result = null, best = range; for (const e of enemies) if (e.alive) { const d = Math.hypot(e.mesh.position.x - x, e.mesh.position.z - z); if (d < best) { best = d; result = e; } } return result; }
function combat(dt) {
  if (state.phase !== 'night') return;
  spawnTimer -= dt; if (remaining > 0 && spawnTimer <= 0) { spawn(); spawnTimer = .85; }
  shotTimer -= dt;
  const target = nearest(player.position.x, player.position.z, 9);
  if (target && shotTimer <= 0) { player.rotation.y = Math.atan2(target.mesh.position.x - player.position.x, target.mesh.position.z - player.position.z); shotFrom.copy(player.position); shotFrom.y = .93; fire(shotFrom, target); shotTimer = .42; }
  for (const b of buildings) if (b.type === 'tower' && b.growth >= 1) { b.cooldown -= dt; const enemy = nearest(b.x, b.z, 12); if (enemy && b.cooldown <= 0) { shotFrom.set(b.x, 4.3, b.z); fire(shotFrom, enemy, 2); b.cooldown = .9; } }
  for (const e of enemies) if (e.alive) {
    const p = e.mesh.position; let tx = -1, tz = -1.6;
    // Follow the clear paths before entering camp, rather than walking through the forest.
    if (p.z < -12) { tx = -1; tz = -10; } else if (p.x < -13) { tx = -10; tz = 4; }
    let dx = tx - p.x, dz = tz - p.z, length = Math.hypot(dx, dz);
    let speed = e.speed; if (buildings.some(b => b.type === 'lantern' && Math.hypot(b.x - p.x, b.z - p.z) < 5)) speed *= .55;
    const barrier = buildings.find(b => Math.hypot(b.x - p.x, b.z - p.z) < b.r + .65);
    e.attack -= dt;
    if (barrier) {
      if (e.attack <= 0) { barrier.hp -= 9; e.attack = .85; audio.effect('damage'); burst(p.x, .7, p.z, 2); if (barrier.hp <= 0) { audio.effect('destroy'); scene.remove(barrier.mesh); if (barrier.light) scene.remove(barrier.light); buildings.splice(buildings.indexOf(barrier), 1); } }
    } else if (rvCollision(p.x, p.z, .2)) {
      if (e.attack <= 0) { damageCamp(state, 3); audio.effect('damage'); e.attack = 1.1; syncUI(); if (state.over) endGame(); }
    } else if (length > .01) { p.x += dx / length * dt * speed; p.z += dz / length * dt * speed; }
    e.mesh.rotation.y = Math.atan2(dx, dz); e.mesh.userData.body.position.y = Math.abs(Math.sin(time * 7 + e.seed)) * .06;
    e.mesh.userData.legs.forEach((leg, i) => leg.rotation.x = Math.sin(time * 7 + e.seed + i * Math.PI) * .4);
  }
  if (!remaining && !enemies.some(e => e.alive) && state.elapsed > 5) transition();
}
function endGame() {
  if ($('#end-dialog').open) return;
  audio.update(state, inside); audio.effect(state.won ? 'victory' : 'defeat');
  keys.clear(); movementTarget = null; selectBuild(null);
  $('#end-dialog h2').textContent = state.won ? '天亮了，我们守住了。' : '余烬尚未冷却。';
  $('#end-dialog .eyebrow').textContent = state.won ? 'FIVE NIGHTS · A LIGHT SURVIVES' : 'THE FIRE WILL BURN AGAIN';
  $('#end-text').textContent = state.won
    ? `五个夜晚全部守住，累计击退 ${state.kills} 位来袭者。营地耐久 ${Math.ceil(state.health)}%，剩余木材 ${state.wood}。救援终于抵达松林。`
    : `你守住了 ${state.day - 1} 个夜晚，击退 ${state.kills} 位不速之客。带上经验，再点燃一次营火吧。`;
  $('#end-dialog').showModal();
}
$('#end-dialog').addEventListener('cancel', event => event.preventDefault());
function syncAudioUI() {
  const settings = audio.settings, locked = audio.stats.context === 'locked';
  const enabled = settings.enabled && !locked;
  $('#sound').setAttribute('aria-pressed', String(enabled));
  $('#sound').setAttribute('aria-label', enabled ? '静音' : '开启音乐与音效');
  $('#sound').title = enabled ? '静音 · 音量在旁边设置' : '点击开启 8-bit 音乐与音效';
  $('#audio-status').textContent = !settings.enabled ? '已静音' : locked ? '点击或按键后播放 · 设置自动保存' : '8-bit 原创配乐 · 设置自动保存';
  for (const key of ['master', 'music', 'sfx']) {
    $(`#audio-${key}`).value = Math.round(settings[key] * 100);
    $(`#audio-${key}-value`).textContent = `${Math.round(settings[key] * 100)}%`;
  }
}
let audioErrorShown = false;
async function unlockAudio() {
  try { await audio.unlock(); }
  catch { if (!audioErrorShown) toast('声音未能开启，请点击 ♫ 重试或检查浏览器声音权限。'); audioErrorShown = true; }
  syncAudioUI();
}
// Browsers require a user gesture. Do not force autoplay or override saved mute.
for (const eventName of ['pointerdown', 'keydown']) addEventListener(eventName, event => {
  if (event.target.closest?.('#sound') || (eventName === 'keydown' && event.repeat)) return;
  if (audio.settings.enabled && ['locked', 'suspended'].includes(audio.stats.context)) void unlockAudio();
}, { capture: true });
$('#sound').addEventListener('click', () => {
  audio.configure('enabled', audio.stats.context === 'locked' ? true : !audio.settings.enabled);
  if (audio.settings.enabled) void unlockAudio();
  syncAudioUI();
});
for (const key of ['master', 'music', 'sfx']) $(`#audio-${key}`).addEventListener('input', event => {
  audio.configure(key, Number(event.target.value) / 100); syncAudioUI();
});
syncAudioUI();
const daySun = new T.Color('#fff0ce'), nightSun = new T.Color('#92b9dc');
const daySky = new T.Color('#d4e2e2'), nightSky = new T.Color('#7593b6');
function ambience(dt) {
  daylight = T.MathUtils.damp(daylight, state.phase === 'day' ? 1 : 0, .55, dt);
  sun.color.copy(nightSun).lerp(daySun, daylight); sun.intensity = .32 + daylight * 2.15;
  sky.color.copy(nightSky).lerp(daySky, daylight); sky.intensity = .43 + daylight * 1.57; fill.intensity = .08 + daylight * .2;
  renderer.toneMappingExposure = .9 + daylight * .14;
  const motion = motionPreference.matches ? 0 : 1;
  ambientTime += dt * motion;
  const t = ambientTime, breath = Math.sin(t * 1.1) * motion;
  world.wind.time.value = t; world.wind.strength.value = motion;
  world.waterMat.uniforms.time.value = t; world.waterMat.uniforms.day.value = daylight;
  world.fireLight.intensity = (28 + (1 - daylight) * 32) * (1 + breath * .08 + Math.sin(t * 8.3) * .035 * motion);
  world.halo.material.opacity = (.24 + (1 - daylight) * .63) * (1 + breath * .08);
  world.halo.scale.setScalar(6 + breath * .3);
  world.flames.children.forEach((flame, i) => { flame.scale.y = .65 + Math.sin(t * 6 + i * 2.1) * .23 * motion; flame.position.y = .4 + flame.scale.y * .15; flame.rotation.y = t * .7 + i; });
  // Fixed ends, gently moving middle; pendants and wire share the same curve.
  const wire = world.lightWire.geometry.attributes.position;
  for (let i = 0; i < wire.count; i++) {
    const u = i / (wire.count - 1);
    wire.setZ(i, 2 + Math.sin(Math.PI * u) * Math.sin(t * .9 + u * 1.7) * .16 * motion);
  }
  wire.needsUpdate = true;
  for (const pendant of world.pendants) {
    const u = pendant.userData.fraction;
    pendant.position.z = 2 + Math.sin(Math.PI * u) * Math.sin(t * .9 + u * 1.7) * .16 * motion;
    pendant.rotation.x = Math.sin(t * 1.15 + u * 2) * .1 * motion;
  }
  fireflyMat.opacity = motion * (.26 + (1 - daylight) * .65);
  fireflyMat.size = .065 + (1 - daylight) * .045;
  for (let i = 0; i < fireflyCount; i++) {
    const f = fireflySeeds[i], brightness = .12 + .88 * Math.pow(.5 + .5 * Math.sin(t * (1.1 + i % 5 * .13) + f.phase), 2);
    fireflyPositions[i * 3] = f.x + Math.sin(t * .23 + f.phase) * 1.6;
    fireflyPositions[i * 3 + 1] = f.y + Math.sin(t * .6 + f.phase) * .4;
    fireflyPositions[i * 3 + 2] = f.z + Math.cos(t * .2 + f.phase) * .9;
    fireflyColors[i * 3] = brightness; fireflyColors[i * 3 + 1] = brightness; fireflyColors[i * 3 + 2] = brightness;
  }
  fireflyGeo.attributes.position.needsUpdate = true; fireflyGeo.attributes.color.needsUpdate = true;
  smoke.forEach((m, i) => { const age = (t * .16 + i / smoke.length) % 1; m.position.set(.1 + age * 1.7 + Math.sin(t * .85 + age * 2) * age * .5, 1.1 + age * 4, 5.6 - age * .45 + Math.sin(t * .68) * age * .35); m.scale.setScalar(.13 + age * .45); m.rotation.y = i + t * .1; m.material.opacity = Math.sin(age * Math.PI) * .09 * motion; });
  if (motion && random() < dt * 20) burst(.1, .5, 5.6, 1);
  for (const b of buildings) { if (b.growth < 1) { b.growth = Math.min(1, b.growth + dt * 1.5); b.mesh.scale.setScalar(1 - Math.pow(1 - b.growth, 3)); } if (b.light) b.light.intensity = 4 + (1 - daylight) * 20; }
  for (const s of shots) if (s.life > 0) { s.life -= dt; if (s.life <= 0) s.mesh.visible = false; }
  for (const p of particles) if (p.life > 0) { p.life -= dt; p.mesh.visible = p.life > 0; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.vy -= dt * 2; p.mesh.scale.multiplyScalar(Math.exp(-dt * .8)); }
}
function resize() {
  const aspect = innerWidth / innerHeight, size = innerWidth < 650 ? zoom * 1.2 : zoom;
  camera.left = -size * aspect; camera.right = size * aspect; camera.top = size; camera.bottom = -size; camera.updateProjectionMatrix();
  const pixelScale = innerWidth < 650 ? 1.1 : 1.45;
  renderer.setSize(Math.round(innerWidth / pixelScale), Math.round(innerHeight / pixelScale), false);
  if (interior) {
    const height = Math.max(4.3, 6.2 / aspect), c = interior.camera;
    c.left = -height * aspect; c.right = height * aspect; c.top = height; c.bottom = -height; c.updateProjectionMatrix();
  }
  updateGhost();
}
addEventListener('resize', resize); resize(); syncUI();
let uiTimer = 0;
renderer.setAnimationLoop(now => {
  const dt = Math.max(0, Math.min((now - last) / 1000, .05)); last = now;
  if (rvTransition) {
    if (!state.paused && !document.hidden) rvTransition.elapsed += dt;
    const p = motionPreference.matches ? 1 : Math.min(1, rvTransition.elapsed / .9);
    if (p >= .5 && !rvTransition.switched) { switchRV(); rvTransition.switched = true; }
    const approach = p < .5 ? p * 2 : (1 - p) * 2;
    const ease = approach * approach * (3 - 2 * approach);
    $('#rv-fade').style.opacity = String(ease);
    if (inside) { interior.camera.zoom = 1 + ease * .12; interior.camera.updateProjectionMatrix(); }
    else {
      camera.zoom = 1 + ease * .55; camera.updateProjectionMatrix();
      v.copy(rvTransition.center).lerp(doorPosition, ease * .65);
      camera.position.set(v.x + 2, 46, v.z + 37); camera.lookAt(v.x, 0, v.z - .3);
    }
    renderer.render(inside ? interior.scene : scene, inside ? interior.camera : camera);
    if (p === 1) {
      camera.zoom = 1; camera.updateProjectionMatrix(); interior.camera.zoom = 1; interior.camera.updateProjectionMatrix();
      $('#rv-fade').hidden = true; rvTransition = null; keys.clear();
    }
    return;
  }
  if (!state.paused && !state.over && !document.hidden) {
    time += dt;
    if (inside) movePlayer(dt);
    else {
      state.elapsed += dt; ambience(dt); movePlayer(dt); combat(dt);
      if (state.phase === 'day' && state.elapsed > DAY_LENGTH && !state.perkPending) transition();
    }
    uiTimer += dt; if (uiTimer > .5) { syncUI(); uiTimer = 0; }
  }
  if (inside) { renderer.render(interior.scene, interior.camera); return; }
  const focus = cameraFocus(player.position.x, player.position.z, camera.right, camera.top);
  cameraCenter.x = T.MathUtils.damp(cameraCenter.x, focus.x, 4, dt);
  cameraCenter.z = T.MathUtils.damp(cameraCenter.z, focus.z, 4, dt);
  camera.position.set(cameraCenter.x + 2, 46, cameraCenter.z + 37);
  camera.lookAt(cameraCenter.x, 0, cameraCenter.z - .3);
  camera.updateMatrixWorld();
  sun.position.set(cameraCenter.x - 26, 35, cameraCenter.z - 22);
  sun.target.position.set(cameraCenter.x, 0, cameraCenter.z);
  if (pointerInside && ghost) { raycaster.setFromCamera(pointer, camera); raycaster.ray.intersectPlane(groundPlane, cursor); updateGhost(); }
  const doorButton = $('#rv-door');
  doorButton.hidden = photoMode || !nearDoor() || state.paused || state.over;
  if (!doorButton.hidden) {
    v.copy(doorPosition).setY(1.5).project(camera);
    doorButton.style.left = `${(v.x + 1) * innerWidth / 2}px`; doorButton.style.top = `${(1 - v.y) * innerHeight / 2}px`;
    doorButton.textContent = state.phase === 'day' ? 'E · 进入房车' : '夜间守营 · 天亮后进入';
  }
  renderer.render(scene, camera);
});
async function boot() {
  setLoadingProgress(52, '准备松林电台');
  const audioReady = audio.prepare();
  setLoadingProgress(64, audioReady ? '松林电台已就绪' : '声音将在首次操作后启用');
  setLoadingProgress(70, '载入界面字体');
  try { await document.fonts?.ready; } catch { /* Fallback fonts are enough to start. */ }
  setLoadingProgress(82, '预热光影');
  try {
    await renderer.compileAsync(scene, camera);
  } catch (error) {
    console.error(error);
    toast('部分渲染效果未能预热，将使用后备模式。');
  }
  setLoadingProgress(100, '松林已准备好');
  await new Promise(resolve => requestAnimationFrame(resolve));
  loading.classList.add('done');
}
void boot();
// Read-only diagnostics for browser smoke tests and performance inspection.
window.__pinefall = { get audio() { return audio.stats; }, get loading() { return { progress: loadingProgress, ready: loading.classList.contains('done') }; }, get state() { return { ...state, perks: [...state.perks], unlocked: [...state.unlocked] }; }, get stats() { return { inside, transitioning: !!rvTransition, lampOn: interior ? interior.lampOn : null, viewZoom: inside ? interior.camera.zoom : camera.zoom, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, enemies: enemies.filter(e => e.alive).length, remaining, ambientTime, windStrength: world.wind.strength.value, wireZ: world.lightWire.geometry.attributes.position.getZ(20), fireIntensity: world.fireLight.intensity, buildings: buildings.length, camera: cameraCenter.toArray(), player: player.position.toArray() }; } };
