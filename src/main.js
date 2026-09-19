import './style.css';
import './ui-polish.css';
import './home.css';
import * as T from 'three';
import { cameraFocus } from './map.js';
import { addOcclusionSilhouette } from './occlusion.js';
import { createAudio, threatLevel } from './audio.js';
import { makeInterior, interiorBlocked } from './interior.js';
import {
  makeWorld,
  character,
  structure,
  walkable,
  seeded,
  enemyModel,
  mesh,
  enemyMaterials,
} from './world.js';
import { createTrauma, createHitStop, hitStopFor, killTraumaFor, easeOutBack } from './feel.js';
import { createRv, updateRvGlow } from './rv.js';
import { startCampaign, phaseValue, overlayValue, isInterior } from './machine.js';
import { createHome } from './home.js';
import { applySave, readSave, resetCampaign, saveSummary, writeSave } from './save.js';
import {
  COSTS,
  NAMES,
  newGame,
  canBuild,
  buy,
  damageCamp,
  overlaps,
  PERKS,
  attackDamage,
  logYield,
  DAY_LENGTH,
  ENEMY_TYPES,
  WAVES,
  WEAPONS,
  EXPEDITIONS,
  LANES,
  applyArmor,
  DASH,
  FLARE,
  MEDKIT_HEAL,
  MAX_LEVEL,
  REPAIR_WOOD,
  equipWeapon,
  unlockWeapon,
  expedition,
  heal,
  damagePlayer,
  playerDown,
  tickSurvival,
  upgradeCost,
  refundValue,
  upgrade,
  repair,
  wavePlan,
  maxHp,
  useFlare,
  siegeGoal,
  rangedGoal,
  revealed,
  hasFurniture,
  rvSlots,
  weaponDamage,
  weaponRange,
  maxMedkits,
  dawnRating,
} from './rules.js';

const $ = (selector) => document.querySelector(selector);
const loading = $('#loading'),
  loadingBar = $('#loading-progress-bar'),
  loadingPercent = $('#loading-percent'),
  loadingMessage = $('#loading-message-text');
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
const renderer = new T.WebGLRenderer({
  canvas,
  antialias: false,
  stencil: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new T.Scene();
scene.background = new T.Color('#6d7f61');
const camera = new T.OrthographicCamera(-27, 27, 21, -21, 0.1, 260);
const cameraCenter = new T.Vector3();
camera.position.set(2, 46, 37);
camera.lookAt(0, 0, -0.3);
const sun = new T.DirectionalLight('#fff0ce', 2.5);
sun.position.set(-26, 35, -22);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 43, bottom: -43, near: 1, far: 115 });
sun.shadow.normalBias = 0.055;
sun.shadow.bias = -0.00015;
scene.add(sun, sun.target);
// Cool moonlight and a carried lamp keep night lanes readable without flattening the dark.
const moon = new T.DirectionalLight('#9fc4e8', 0);
moon.position.set(24, 30, 20);
scene.add(moon, moon.target);
const sky = new T.HemisphereLight('#d4e2e2', '#92906f', 2.1);
scene.add(sky);
const fill = new T.AmbientLight('#b0c7b8', 0.28);
scene.add(fill);
const playerLight = new T.PointLight('#ffd9a0', 0, 8, 1.5);
scene.add(playerLight);
const muzzleLight = new T.PointLight('#ffd08a', 0, 6.5, 1.6);
scene.add(muzzleLight);
const world = makeWorld(scene);
setLoadingProgress(32, '营地材质已就绪');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let ambientTime = 0;
const state = newGame();
world.logs.forEach((log, index) => {
  log.id = `log-${index + 1}`;
});
state.logs = world.logs;
let inside = false,
  interior = null,
  rvTransition = null;
const outsidePosition = new T.Vector3();
let outsideRotation = 0;
const doorPosition = new T.Vector3(0, 0.2, 0.95);
const random = seeded(3241);
const player = character();
player.position.set(1, 0, -6.1);
scene.add(player);
addOcclusionSilhouette(player);
const marker = new T.Mesh(
  new T.RingGeometry(0.47, 0.53, 24),
  new T.MeshBasicMaterial({
    color: '#ead59a',
    transparent: true,
    opacity: 0.75,
    side: T.DoubleSide,
  }),
);
marker.rotation.x = -Math.PI / 2;
marker.position.y = 0.035;
scene.add(marker);
const obstacles = [
  { x: -1, z: -1.6, r: 0 },
  { x: -5.5, z: 4.1, r: 1.5 },
  { x: 5.2, z: 4.3, r: 1.5 },
  { x: 0.1, z: 5.6, r: 0.9 },
  { x: -8.5, z: -2.5, r: 1.4 },
];
const buildings = [],
  enemies = [],
  enemyPools = {},
  shots = [],
  particles = [],
  keys = new Set();
// Authoritative building data lives in `state.buildings`; meshes/lights are a scene-only view map.
state.buildings = buildings;
const buildingViews = new Map();
const viewOf = (b) => buildingViews.get(b.id);
function attachBuildingView(b, mesh, light = null) {
  mesh.userData.building = b;
  buildingViews.set(b.id, { mesh, light, growth: 0, cooldown: 0, hit: 0 });
  scene.add(mesh);
  if (light) scene.add(light);
}
function detachBuildingView(b) {
  const view = buildingViews.get(b.id);
  if (!view) return;
  scene.remove(view.mesh);
  if (view.light) scene.remove(view.light);
  buildingViews.delete(b.id);
}
function syncBuildingScene() {
  for (const view of buildingViews.values()) {
    scene.remove(view.mesh);
    if (view.light) scene.remove(view.light);
  }
  buildingViews.clear();
  for (const b of buildings) {
    const m = structure(b.type, b.level);
    m.position.set(b.x, 0, b.z);
    m.rotation.y = b.angle || 0;
    m.userData.building = b;
    let light = null;
    if (b.type === 'lantern') {
      light = new T.PointLight('#ffcf7e', 0, 9, 1.5);
      light.position.set(b.x, 2.6, b.z);
    }
    attachBuildingView(b, m, light);
    const view = viewOf(b);
    view.growth = 1;
  }
}
const raycaster = new T.Raycaster(),
  pointer = new T.Vector2(),
  cursor = new T.Vector3();
const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0),
  v = new T.Vector3();
let selected = null,
  ghost = null,
  ghostAngle = 0,
  validPlacement = false,
  pointerInside = false;
let selectedBuilding = null;
let daylight = 1,
  time = 0,
  last = performance.now(),
  zoom = 23,
  shotTimer = 0,
  remaining = 0,
  toastTimer,
  hurtTimer;
let movementTarget = null,
  photoMode = false,
  homeMode = false,
  nightClock = 0,
  spawnQueue = [],
  dash = null,
  playerInvuln = 0;
// Per-night telemetry feeds the dawn rating; it never changes combat rules.
let nightRun = { startHealth: 100, clearHealth: 100, downs: 0, buildingsLost: 0, seconds: 0 },
  lastRating = null;
let muzzleFlashes = 0,
  hitFlashes = 0,
  deaths = 0,
  knockbacks = 0,
  recoils = 0,
  spitCount = 0;
const trauma = createTrauma();
const hitStop = createHitStop();
const enemyFlashMaterial = new T.MeshStandardMaterial({
  color: '#ffdcae',
  flatShading: true,
  roughness: 1,
});
const SHAKE_STORAGE = 'pinefall.feel.v1';
let shakeEnabled = !motionPreference.matches;
try {
  const saved = localStorage.getItem(SHAKE_STORAGE);
  if (saved !== null) shakeEnabled = saved === 'true';
} catch {
  /* storage may be blocked */
}
const audio = createAudio();
const ghostMaterial = new T.MeshBasicMaterial({
  color: '#ead176',
  wireframe: true,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});
const sparkMaterial = new T.MeshBasicMaterial({ color: '#ffcf76', transparent: true });
const cube = new T.BoxGeometry(1, 1, 1);
// Fixed-size pools cover this small camp. Increase pool sizes before adding larger maps/waves.
const POOL_SIZE = { walker: 40, runner: 30, brute: 14, spitter: 8, stalker: 18, alpha: 3 };
for (const [type, count] of Object.entries(POOL_SIZE)) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    const model = enemyModel(type);
    model.scale.setScalar(ENEMY_TYPES[type].scale);
    model.visible = false;
    scene.add(model);
    const record = {
      mesh: model,
      type,
      alive: false,
      hp: 0,
      maxHp: 0,
      attack: 0,
      slow: 0,
      slowFactor: 1,
      seed: random() * 20,
      kx: 0,
      kz: 0,
    };
    pool.push(record);
    enemies.push(record);
  }
  enemyPools[type] = pool;
}
for (let i = 0; i < 64; i++) {
  const m = new T.Mesh(cube, new T.MeshBasicMaterial({ color: '#ffe6a1' }));
  m.visible = false;
  scene.add(m);
  shots.push({ mesh: m, life: 0 });
}
for (let i = 0; i < 100; i++) {
  const m = new T.Mesh(cube, sparkMaterial);
  m.visible = false;
  scene.add(m);
  particles.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0 });
}
// Bright mesh flashes keep muzzle fire readable in daylight, where the point light washes out.
const muzzles = [],
  muzzleGeometry = new T.OctahedronGeometry(0.5, 0);
const muzzleMaterial = new T.MeshBasicMaterial({
  color: '#ffe7ab',
  transparent: true,
  opacity: 0.92,
  blending: T.AdditiveBlending,
  depthWrite: false,
});
for (let i = 0; i < 14; i++) {
  const m = new T.Mesh(muzzleGeometry, muzzleMaterial);
  m.visible = false;
  scene.add(m);
  muzzles.push({ mesh: m, life: 0 });
}
// Corrosive spit from the ranged enemy: a visible arc gives the player time to dodge.
const spits = [],
  spitMaterial = new T.MeshBasicMaterial({
    color: '#b6d06a',
    transparent: true,
    opacity: 0.92,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
for (let i = 0; i < 24; i++) {
  const m = new T.Mesh(new T.IcosahedronGeometry(0.15, 0), spitMaterial);
  m.visible = false;
  scene.add(m);
  spits.push({
    mesh: m,
    life: 0,
    total: 1,
    kind: '',
    ref: null,
    damage: 0,
    from: new T.Vector3(),
    to: new T.Vector3(),
  });
}
const fireflyCount = 110,
  fireflyPositions = new Float32Array(fireflyCount * 3),
  fireflyColors = new Float32Array(fireflyCount * 3),
  fireflySeeds = [];
for (let i = 0; i < fireflyCount; i++)
  fireflySeeds.push({
    x: (random() - 0.5) * 45,
    z: (random() - 0.5) * 39,
    y: 0.3 + random() * 2.3,
    phase: random() * 6.28,
  });
const fireflyGeo = new T.BufferGeometry();
fireflyGeo.setAttribute('position', new T.BufferAttribute(fireflyPositions, 3));
fireflyGeo.setAttribute('color', new T.BufferAttribute(fireflyColors, 3));
// Positions drift within this fixed volume; don't retain the first frame's bounds.
fireflyGeo.boundingSphere = new T.Sphere(new T.Vector3(), 35);
const fireflyMat = new T.PointsMaterial({
  color: '#e9d58f',
  size: 0.09,
  transparent: true,
  opacity: 0,
  vertexColors: true,
  depthWrite: false,
  blending: T.AdditiveBlending,
});
scene.add(new T.Points(fireflyGeo, fireflyMat));
// Small drifting smoke diamonds: no external art assets or opaque particle planes.
const smoke = [];
for (let i = 0; i < 13; i++) {
  const m = new T.Mesh(
    new T.IcosahedronGeometry(1, 0),
    new T.MeshBasicMaterial({
      color: '#bac0a5',
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
    }),
  );
  scene.add(m);
  smoke.push(m);
}
// Two flare markers are enough: cooldown 25s, duration 5s.
const flarePool = [];
function flareVisual() {
  let flare = flarePool.find((f) => !f.active);
  if (!flare) {
    const group = new T.Group();
    const orb = mesh(group, new T.SphereGeometry(0.26, 8, 6), '#ffc07a', 0, 0.6, 0, 1, 1, 1, true);
    const ring = new T.Mesh(
      new T.RingGeometry(FLARE.radius - 0.2, FLARE.radius, 44),
      new T.MeshBasicMaterial({
        color: '#ff9a52',
        transparent: true,
        opacity: 0.35,
        side: T.DoubleSide,
        depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    group.add(ring);
    const light = new T.PointLight('#ff9a52', 0, 15, 1.5);
    light.position.y = 1.2;
    group.add(light);
    group.visible = false;
    scene.add(group);
    flare = { group, light, orb, active: false, life: 0, x: 0, z: 0 };
    flarePool.push(flare);
  }
  return flare;
}
const selectionRing = new T.Mesh(
  new T.RingGeometry(1.05, 1.24, 30),
  new T.MeshBasicMaterial({
    color: '#f0d59a',
    transparent: true,
    opacity: 0.75,
    side: T.DoubleSide,
    depthWrite: false,
  }),
);
selectionRing.rotation.x = -Math.PI / 2;
selectionRing.position.y = 0.045;
selectionRing.visible = false;
scene.add(selectionRing);
const rv = createRv({ state, getInterior: () => interior, audio, toast, syncUI });
setLoadingProgress(46, '环境细节已就绪');
function toast(text) {
  $('#toast').textContent = text;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3200);
}
function flashHurt() {
  if (motionPreference.matches) return;
  const el = $('#hurt-flash');
  el.classList.add('show');
  clearTimeout(hurtTimer);
  hurtTimer = setTimeout(() => el.classList.remove('show'), 90);
}
function syncShakeUI() {
  const button = $('#shake');
  button.setAttribute('aria-pressed', String(shakeEnabled));
  button.title = shakeEnabled ? '打击反馈 · 镜头震动已开启' : '打击反馈 · 镜头震动已关闭';
}
$('#shake').addEventListener('click', () => {
  shakeEnabled = !shakeEnabled;
  try {
    localStorage.setItem(SHAKE_STORAGE, String(shakeEnabled));
  } catch {
    /* no persistence */
  }
  syncShakeUI();
  toast(shakeEnabled ? '镜头震动已开启。' : '镜头震动已关闭。');
});
syncShakeUI();
function setEnemyMaterial(enemy, material) {
  enemy.mesh.traverse((part) => {
    if (part.isMesh && part.material !== enemyMaterials.glow) part.material = material;
  });
}
function syncPlayerHud() {
  const max = maxHp(state),
    hp = Math.max(0, state.playerHp);
  $('#player-hp').style.width = `${(hp / max) * 100}%`;
  $('#player-hp-text').textContent = String(Math.ceil(hp));
  $('#player-stamina').style.width = `${state.stamina}%`;
  $('#weapon-chip').textContent = WEAPONS[state.weapon].name;
  $('#medkit-chip').textContent = `✚ ${state.medkits}/${maxMedkits(state)}`;
  const flare = $('#flare-chip');
  if (state.flareCooldown <= 0) {
    flare.textContent = '✦ 就绪';
    flare.className = 'ready';
  } else {
    flare.textContent = `✦ ${Math.ceil(state.flareCooldown)}s`;
    flare.className = 'cooling';
  }
}
function syncUI() {
  audio.update(state, inside, threatLevel(enemies, player.position.x, player.position.z));
  $('#owned-perks').textContent = state.perks.length
    ? `专长 · ${state.perks.map((id) => PERKS[id].name).join(' / ')}`
    : '专长 · 守过首夜后选择';
  $('#wood').textContent = state.wood;
  $('#scrap').textContent = state.scrap;
  $('#health').textContent = Math.ceil(state.health);
  $('#kills').textContent = state.kills;
  $('#health-bar').style.width = `${state.health}%`;
  $('#day-label').textContent =
    `${state.phase === 'day' ? 'DAY' : 'NIGHT'} ${String(state.day).padStart(2, '0')}`;
  $('#phase-icon').textContent = state.phase === 'day' ? '☀' : '☾';
  $('#phase-label').textContent = state.paused
    ? '时光暂停'
    : state.phase === 'day'
      ? '午后 · 营地建设'
      : `守夜 · 剩余敌人 ${remaining + enemies.filter((e) => e.alive).length}`;
  $('#day-progress').style.width = `${Math.min(100, (state.elapsed / DAY_LENGTH) * 100)}%`;
  $('#day-progress').style.opacity = state.phase === 'day' ? 1 : 0;
  $('#note-number').textContent = String(state.day).padStart(2, '0');
  $('#note-title').textContent =
    state.phase === 'day' ? '天黑之前，先安个家。' : '别让最后一束光熄灭。';
  $('#note-body').textContent =
    state.phase === 'day'
      ? '在空地建起防线。按 Tab 打开营地手册：工坊、远征与战前情报。'
      : `第 ${state.day} 夜 · 自动射击已就绪，守住房车直到黎明。`;
  $('#next-phase').innerHTML =
    state.phase === 'day' ? '迎接夜晚 <span>→</span>' : '等待黎明 <span>→</span>';
  $('#build-hint').textContent =
    state.phase === 'night'
      ? '夜间无法建造 · 守住营地'
      : selected
        ? 'R 旋转 · Esc 取消'
        : '选择建筑 · 点击空地放置';
  document.querySelectorAll('[data-build]').forEach((button) => {
    button.disabled = inside || !canBuild(state, button.dataset.build);
    button.classList.toggle('selected', selected === button.dataset.build);
  });
  $('#pause').textContent = state.paused ? '▷' : 'Ⅱ';
  $('#pause').setAttribute('aria-pressed', String(state.paused));
  if (selectedBuilding) renderBuildingPanel();
  rv.updateAlert(spawnQueue, nightClock);
  syncPlayerHud();
}
function togglePause() {
  if (rvTransition) return;
  actor.send({ type: overlayValue(actor.getSnapshot()) === 'paused' ? 'RESUME' : 'PAUSE' });
  keys.clear();
  movementTarget = null;
}
function openPerks() {
  if (!state.perkPending || state.over || $('#perk-dialog').open) return;
  selectBuild(null);
  keys.clear();
  movementTarget = null;
  const campLost = Math.max(0, Math.ceil(nightRun.startHealth - nightRun.clearHealth));
  const rating = dawnRating({
    campLost,
    downs: nightRun.downs,
    buildingsLost: nightRun.buildingsLost,
    nightSeconds: nightRun.seconds,
  });
  lastRating = {
    ...rating,
    day: state.day - 1,
    campLost,
    downs: nightRun.downs,
    buildingsLost: nightRun.buildingsLost,
    seconds: Math.round(nightRun.seconds),
  };
  $('#perk-summary').textContent =
    `第 ${state.day - 1} 夜已守住 · 评分 ${rating.grade}（${rating.score}）· 击退 ${state.kills} · 营地 −${campLost}% · 耗时 ${Math.round(nightRun.seconds)} 秒。选择期间不消耗准备时间。`;
  $('#perk-options').replaceChildren(
    ...Object.entries(PERKS)
      .filter(([id]) => !state.perks.includes(id))
      .map(([id, perk]) => {
        const button = document.createElement('button');
        button.dataset.perk = id;
        const title = document.createElement('strong'),
          text = document.createElement('span');
        title.textContent = perk.name;
        text.textContent = perk.currentText;
        button.append(title, text);
        button.addEventListener('click', () => actor.send({ type: 'CHOOSE_PERK', perkId: id }));
        return button;
      }),
  );
  $('#perk-dialog').showModal();
}
$('#perk-dialog').addEventListener('cancel', (event) => event.preventDefault());
$('#perk-dialog').addEventListener('close', () => {
  if (state.perkPending) openPerks();
});
function selectBuild(type) {
  if ((inside || rvTransition) && type) return;
  if (selected === type || !type) {
    selected = null;
    if (ghost) scene.remove(ghost);
    ghost = null;
    $('#world-label').style.display = 'none';
    syncUI();
    return;
  }
  if (!canBuild(state, type)) {
    toast(state.phase === 'night' ? '夜色太深了，等天亮再施工。' : '木材不足，靠近倒木按 E 收集。');
    return;
  }
  if (ghost) scene.remove(ghost);
  selected = type;
  ghost = structure(type);
  ghost.traverse((o) => {
    if (o.isMesh) {
      o.material = ghostMaterial;
      o.castShadow = false;
    }
  });
  ghost.rotation.y = ghostAngle;
  ghost.visible = false;
  scene.add(ghost);
  syncUI();
}
function rvCollision(x, z, padding = 0.4) {
  return Math.abs(x + 1) < 4.7 + padding && Math.abs(z + 1.6) < 1.65 + padding;
}
function canPlace(x, z) {
  const radius = selected === 'tower' ? 1.5 : selected === 'fence' ? 1.25 : 0.4;
  return (
    Math.hypot(x - doorPosition.x, z - doorPosition.z) > radius + 1.3 &&
    walkable(x, z) &&
    Math.hypot(x, z) < 18 &&
    !rvCollision(x, z, radius) &&
    !overlaps(x, z, obstacles.slice(1), radius) &&
    !overlaps(x, z, world.trees, radius) &&
    !overlaps(x, z, buildings, radius)
  );
}
function updateGhost() {
  if (!ghost) return;
  ghost.visible = pointerInside;
  if (!pointerInside) {
    $('#world-label').style.display = 'none';
    return;
  }
  const x = Math.round(cursor.x * 2) / 2,
    z = Math.round(cursor.z * 2) / 2;
  ghost.position.set(x, 0.04, z);
  validPlacement = canPlace(x, z) && canBuild(state, selected);
  ghostMaterial.color.set(validPlacement ? '#efd17c' : '#cb745c');
  v.set(x, selected === 'tower' ? 5.7 : 2, z).project(camera);
  const label = $('#world-label');
  label.style.display = 'block';
  label.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
  label.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
  label.textContent = validPlacement
    ? `${NAMES[selected]} · ▰ ${COSTS[selected]} · 点击建造`
    : '这里无法建造';
  label.classList.toggle('invalid', !validPlacement);
}
function burst(x, y, z, count = 12) {
  let n = 0;
  for (const p of particles)
    if (p.life <= 0) {
      p.life = 0.5 + random() * 0.7;
      p.mesh.visible = true;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(0.045 + random() * 0.09);
      p.vx = (random() - 0.5) * 3;
      p.vy = 1 + random() * 3;
      p.vz = (random() - 0.5) * 3;
      if (++n >= count) break;
    }
}
function place() {
  if (inside || !selected || !validPlacement || !buy(state, selected)) return;
  const type = selected,
    m = structure(type),
    p = ghost.position;
  m.position.set(p.x, 0, p.z);
  m.rotation.y = ghostAngle;
  m.scale.setScalar(0.01);
  const building = {
    id: state.nextBuildId++,
    type,
    x: p.x,
    z: p.z,
    angle: ghostAngle,
    r: type === 'tower' ? 1.2 : type === 'fence' ? 1 : 0.35,
    level: 1,
    maxHp: type === 'fence' ? 150 : 220,
    hp: type === 'fence' ? 150 : 220,
    invested: { wood: COSTS[type], scrap: 0 },
  };
  let light = null;
  if (type === 'lantern') {
    light = new T.PointLight('#ffcf7e', 0, 9, 1.5);
    light.position.set(p.x, 2.6, p.z);
  }
  attachBuildingView(building, m, light);
  buildings.push(building);
  burst(p.x, 0.5, p.z, 23);
  audio.effect('build');
  toast(`${NAMES[type]}建造完成 · −${COSTS[type]} 木材`);
  selectBuild(null);
  syncUI();
}
const towerStats = (b) => ({
  damage: 2 + (b.level - 1),
  range: 12 + (b.level - 1) * 1.6,
  cooldown: Math.max(0.55, 0.9 - (b.level - 1) * 0.12),
});
const lanternRadius = (b) => 5 + (b.level - 1) * 1.4;
const lanternSlow = (b) => Math.max(0.4, 0.55 - (b.level - 1) * 0.07);
function refitBuilding(b) {
  const view = viewOf(b);
  const m = structure(b.type, b.level);
  m.position.set(b.x, 0, b.z);
  m.rotation.y = view.mesh.rotation.y;
  m.scale.setScalar(0.6);
  m.userData.building = b;
  scene.remove(view.mesh);
  view.mesh = m;
  view.growth = 0.4;
  scene.add(m);
}
function renderBuildingPanel() {
  const panel = $('#building-panel'),
    b = selectedBuilding;
  if (!b || !buildings.includes(b)) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const day = state.phase === 'day';
  const cost = upgradeCost(b),
    refund = refundValue(b);
  $('#building-name').textContent = NAMES[b.type];
  $('#building-level').textContent = `Lv.${b.level}`;
  $('#building-hp').style.width = `${Math.max(0, (b.hp / b.maxHp) * 100)}%`;
  const stats =
    b.type === 'tower'
      ? `伤害 ${towerStats(b).damage} · 射程 ${towerStats(b).range}`
      : b.type === 'lantern'
        ? `减速半径 ${lanternRadius(b).toFixed(1)}`
        : `阻挡单路 · 为火力争取时间`;
  $('#building-stats').textContent = `${stats} · 耐久 ${Math.ceil(b.hp)} / ${b.maxHp}`;
  const upgradeBtn = $('#building-upgrade');
  upgradeBtn.textContent =
    b.level >= MAX_LEVEL ? '已满级' : `升级 Lv.${b.level + 1} · ▰${cost.wood} ⚙${cost.scrap}`;
  upgradeBtn.disabled =
    b.level >= MAX_LEVEL || !day || state.wood < cost.wood || state.scrap < cost.scrap;
  const repairBtn = $('#building-repair');
  repairBtn.textContent = `维修 · ▰${REPAIR_WOOD}`;
  repairBtn.disabled = !day || b.hp >= b.maxHp || state.wood < REPAIR_WOOD;
  $('#building-dismantle').textContent = `拆除 · 返还 ▰${refund.wood} ⚙${refund.scrap}`;
  $('#building-dismantle').disabled = !day;
  $('#building-note').textContent = day ? '' : '夜间无法施工、维修或拆除。';
}
function selectBuilding(b) {
  selectedBuilding = b && buildings.includes(b) ? b : null;
  selectionRing.visible = !!selectedBuilding;
  if (selectedBuilding) {
    selectionRing.position.set(selectedBuilding.x, 0.045, selectedBuilding.z);
    selectBuild(null);
  }
  renderBuildingPanel();
}
function buildingAt(object) {
  let node = object;
  while (node) {
    if (node.userData?.building) return node.userData.building;
    node = node.parent;
  }
  return null;
}
function upgradeBuilding() {
  const b = selectedBuilding;
  if (!b) return;
  if (!upgrade(state, b)) {
    toast(state.phase === 'night' ? '夜间无法施工。' : '资源不足，无法升级。');
    return;
  }
  refitBuilding(b);
  burst(b.x, 1, b.z, 18);
  audio.effect('build');
  toast(`${NAMES[b.type]}升级至 Lv.${b.level}`);
  renderBuildingPanel();
  syncUI();
}
function repairBuilding() {
  const b = selectedBuilding;
  if (!b) return;
  if (!repair(state, b)) {
    toast(state.phase === 'night' ? '夜间无法维修。' : '木材不足或结构完好。');
    return;
  }
  burst(b.x, 0.7, b.z, 10);
  audio.effect('build');
  toast(`${NAMES[b.type]}维修完成 · −${REPAIR_WOOD} 木材`);
  renderBuildingPanel();
  syncUI();
}
function dismantleBuilding() {
  const b = selectedBuilding;
  if (!b) return;
  if (state.phase !== 'day') {
    toast('夜间无法拆除。');
    return;
  }
  const refund = refundValue(b);
  state.wood += refund.wood;
  state.scrap += refund.scrap;
  detachBuildingView(b);
  buildings.splice(buildings.indexOf(b), 1);
  burst(b.x, 0.7, b.z, 22);
  audio.effect('destroy');
  toast(`已拆除 ${NAMES[b.type]} · 返还 ▰${refund.wood} ⚙${refund.scrap}`);
  selectBuilding(null);
  syncUI();
}
$('#building-close').addEventListener('click', () => selectBuilding(null));
$('#building-upgrade').addEventListener('click', upgradeBuilding);
$('#building-repair').addEventListener('click', repairBuilding);
$('#building-dismantle').addEventListener('click', dismantleBuilding);
function updatePointer(event) {
  pointer.x = (event.clientX / innerWidth) * 2 - 1;
  pointer.y = 1 - (event.clientY / innerHeight) * 2;
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(groundPlane, cursor);
  pointerInside = true;
}
canvas.addEventListener('pointermove', (event) => {
  updatePointer(event);
  updateGhost();
});
canvas.addEventListener('pointerleave', () => {
  pointerInside = false;
  updateGhost();
});
canvas.addEventListener('pointerdown', (event) => {
  if (homeMode || rvTransition || inside || state.paused || state.over) return;
  updatePointer(event);
  if (selected) {
    updateGhost();
    place();
    return;
  }
  const hit = raycaster.intersectObjects(
    buildings.map((b) => viewOf(b).mesh),
    true,
  )[0];
  const building = hit ? buildingAt(hit.object) : null;
  if (building) {
    selectBuilding(building);
    return;
  }
  selectBuilding(null);
  if (walkable(cursor.x, cursor.z)) movementTarget = cursor.clone();
});
canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  selectBuild(null);
  selectBuilding(null);
});
canvas.addEventListener(
  'wheel',
  (event) => {
    event.preventDefault();
    if (inside || rvTransition) return;
    zoom = T.MathUtils.clamp(zoom + event.deltaY * 0.008, 12, 32);
    resize();
  },
  { passive: false },
);
document
  .querySelectorAll('[data-build]')
  .forEach((button) => button.addEventListener('click', () => selectBuild(button.dataset.build)));
function nearDoor() {
  return player.position.z > 0.45 && player.position.distanceTo(doorPosition) < 1.65;
}
function enterOrExit() {
  if (rvTransition || state.paused || state.over) return;
  if (!inside && (!nearDoor() || state.phase !== 'day')) {
    if (nearDoor()) toast('夜晚留在外面守住营地，天亮后再进入房车。');
    return;
  }
  if (!interior) interior = makeInterior();
  selectBuild(null);
  selectBuilding(null);
  movementTarget = null;
  keys.clear();
  pointerInside = false;
  if (motionPreference.matches) {
    switchRV();
    return;
  }
  rvTransition = { elapsed: 0, switched: false, center: cameraCenter.clone() };
  $('#rv-fade').hidden = false;
  $('#rv-door').hidden = true;
}
function switchRV() {
  if (inside) {
    inside = false;
    scene.add(player);
    player.position.copy(outsidePosition);
    player.rotation.y = outsideRotation;
  } else {
    if (!nearDoor()) return;
    if (state.phase !== 'day') {
      toast('夜晚留在外面守住营地，天亮后再进入房车。');
      return;
    }
    selectBuild(null);
    if (!interior) interior = makeInterior();
    outsidePosition.copy(player.position);
    outsideRotation = player.rotation.y;
    inside = true;
    interior.scene.add(player);
    player.position.set(1.02, 0.06, 0.85);
    player.rotation.y = Math.PI;
  }
  actor.send({ type: inside ? 'ENTER_RV' : 'EXIT_RV' });
  movementTarget = null;
  keys.clear();
  pointerInside = false;
  $('#app').classList.toggle('inside-rv', inside);
  $('#interior-panel').hidden = !inside;
  $('#rv-door').hidden = true;
  if (inside) {
    rv.render();
    $('#leave-rv').focus();
  } else $('#world').focus();
  resize();
  syncUI();
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
  if (inside || nearDoor()) {
    enterOrExit();
    return;
  }
  const log = world.logs.find(
    (log) => Math.hypot(player.position.x - log.x, player.position.z - log.z) < 3,
  );
  if (!log) {
    toast('靠近森林边缘的倒木，再按 E 收集。');
    return;
  }
  if (!log.remaining) {
    toast('这段倒木已收集完，明天再来。');
    return;
  }
  const amount = logYield(state);
  log.remaining--;
  state.wood += amount;
  burst(log.x, 0.6, log.z);
  audio.effect('collect');
  toast(`收集木材 +${amount}`);
  syncUI();
}
function beginNight() {
  spawnQueue = wavePlan(state.day);
  remaining = spawnQueue.length;
  nightClock = 0;
  nightRun = {
    startHealth: state.health,
    clearHealth: state.health,
    downs: 0,
    buildingsLost: 0,
    seconds: 0,
  };
  toast(`第 ${state.day} 夜 · ${WAVES[state.day - 1].name}`);
}
function transition() {
  if (rvTransition) return;
  if (inside) {
    toast('先离开房车，再迎接夜晚。');
    return;
  }
  if (state.paused || state.over) return;
  if (phaseValue(actor.getSnapshot()) === 'night') {
    if (remaining !== 0 || spawnQueue.length || enemies.some((e) => e.alive)) {
      toast('仍有敌人在林中，清除全部来袭者才能迎接黎明。');
      return;
    }
    nightRun.clearHealth = state.health;
    nightRun.seconds = nightClock;
    actor.send({ type: 'CLEARED' });
    return;
  }
  actor.send({ type: 'START_NIGHT' });
}
$('#next-phase').addEventListener('click', transition);
function togglePhoto() {
  photoMode = !photoMode;
  $('#app').classList.toggle('photo-mode', photoMode);
  $('#photo-hint').hidden = !photoMode;
}
$('#photo').addEventListener('click', togglePhoto);
$('#pause').addEventListener('click', togglePause);
function openHelp() {
  actor.send({ type: 'OPEN_HELP' });
  $('#help-dialog').showModal();
  keys.clear();
}
function closeHelp() {
  $('#help-dialog').close();
}
$('#help').addEventListener('click', openHelp);
$('#help-start').addEventListener('click', closeHelp);
$('#help-dialog .close').addEventListener('click', closeHelp);
$('#help-dialog').addEventListener('close', () => actor.send({ type: 'CLOSE_HELP' }));
$('#restart').addEventListener('click', () => location.reload());
// ——— Camp manual: workshop, expeditions, pre-night intel ———
let manualTab = 'workshop';
function manualCard({
  title,
  tag,
  body,
  stats,
  action,
  actionText,
  disabled,
  disabledText,
  owned,
}) {
  const card = document.createElement('section');
  card.className = `manual-card${owned ? ' owned' : ''}`;
  const head = document.createElement('div');
  head.className = 'card-head';
  const name = document.createElement('strong');
  name.textContent = title;
  const label = document.createElement('span');
  label.className = 'tag';
  label.textContent = tag;
  head.append(name, label);
  card.append(head);
  const text = document.createElement('p');
  text.textContent = body;
  card.append(text);
  if (stats) {
    const grid = document.createElement('div');
    grid.className = 'manual-stat-grid';
    stats.forEach((s) => {
      const item = document.createElement('span');
      item.textContent = s;
      grid.append(item);
    });
    card.append(grid);
  }
  if (actionText) {
    const button = document.createElement('button');
    button.className = action ? 'primary' : 'ghost';
    button.textContent = actionText;
    button.disabled = !!disabled;
    if (action) button.addEventListener('click', action);
    card.append(button);
  }
  if (disabled && disabledText) {
    const note = document.createElement('p');
    note.textContent = disabledText;
    card.append(note);
  }
  return card;
}
function renderManual() {
  document
    .querySelectorAll('[data-manual-tab]')
    .forEach((tab) =>
      tab.setAttribute('aria-selected', String(tab.dataset.manualTab === manualTab)),
    );
  const page = $('#manual-page'),
    cards = [];
  if (manualTab === 'workshop') {
    const bench = hasFurniture(state, 'workbench');
    for (const [id, weapon] of Object.entries(WEAPONS)) {
      const unlocked = state.unlocked.includes(id),
        equipped = state.weapon === id;
      cards.push(
        manualCard({
          title: weapon.name,
          tag: equipped ? '使用中' : unlocked ? '已解锁' : '未解锁',
          owned: equipped,
          body: weapon.text,
          stats: [
            `伤害 ${weaponDamage(state, id)}`,
            `射程 ${weaponRange(state, id)}`,
            `间隔 ${weapon.interval}s`,
          ],
          actionText: equipped ? '已装备' : unlocked ? '装备' : '解锁并装备 · ⚙10',
          disabled:
            equipped || (!unlocked && (!bench || state.scrap < 10 || state.phase !== 'day')),
          disabledText:
            !unlocked && !bench
              ? '需要便携工作台：进入房车安装后才能解锁武器。'
              : !unlocked && state.phase !== 'day'
                ? '只能在白天解锁武器。'
                : !unlocked && state.scrap < 10
                  ? '零件不足（需要 ⚙10）· 远征可获得零件。'
                  : '',
          action: () => {
            const ok = unlocked ? equipWeapon(state, id) : unlockWeapon(state, id);
            if (!ok) {
              toast('无法更换武器。');
              return;
            }
            audio.effect('build');
            toast(`${unlocked ? '装备' : '解锁'}武器 · ${weapon.name}`);
            renderManual();
            syncUI();
          },
        }),
      );
    }
    if (state.phase !== 'day')
      cards.push(
        Object.assign(document.createElement('p'), {
          className: 'empty',
          textContent: '夜间无法在工坊解锁与更换武器，天亮后再来。',
        }),
      );
  } else if (manualTab === 'expedition') {
    if (state.phase !== 'day') {
      cards.push(
        Object.assign(document.createElement('p'), {
          className: 'empty',
          textContent: '远征只能在白天出发。夜晚必须留在营地防守。',
        }),
      );
    } else {
      for (const trip of EXPEDITIONS) {
        const done = state.expeditionDay === state.day;
        const noTime = state.elapsed + trip.time >= DAY_LENGTH;
        const hurt = state.playerHp <= trip.injury;
        const reason = done
          ? '今天已经出发过一次，明天再来。'
          : noTime
            ? '剩余白天时间不足，无法完成这次行动。'
            : hurt
              ? '生命不足，先恢复再出发。'
              : '';
        cards.push(
          manualCard({
            title: trip.name,
            tag: trip.tag,
            body: trip.text.replace(`耗时 ${trip.time} 秒`, `白天时间 −${trip.time} 秒`),
            actionText: done ? '今日已完成' : '出发',
            disabled: !!reason,
            disabledText: reason,
            action: () => {
              if (!expedition(state, trip.id)) {
                toast('现在无法出发。');
                return;
              }
              audio.effect('collect');
              toast(`远征归来 · ${trip.name}`);
              renderManual();
              syncUI();
            },
          }),
        );
      }
    }
  } else {
    const wave = WAVES[state.day - 1];
    const when = state.phase === 'day' ? '今晚' : '当前';
    cards.push(
      manualCard({
        title: `第 ${state.day} 夜 · ${wave.name}`,
        tag: when,
        body: wave.lesson,
        stats: [
          `木材 ▰${state.wood}`,
          `零件 ⚙${state.scrap}`,
          `营地 ${Math.ceil(state.health)}%`,
          `生命 ${Math.ceil(state.playerHp)}/${maxHp(state)}`,
          `瞭望塔 ${buildings.filter((b) => b.type === 'tower').length}`,
          `医疗包 ✚${state.medkits}`,
        ],
      }),
    );
    if (wave.fog)
      cards.push(
        manualCard({
          title: `浓雾 · 能见度 ${Math.round((1 - wave.fog) * 100)}%`,
          tag: '环境',
          body: '灯光与信号弹的照亮范围缩小；潜行者在灯外几乎不可见，腐吐者借雾远程腐蚀建筑。',
        }),
      );
    cards.push(manualCard({ title: '应对建议', tag: '战术', body: wave.advice }));
    wave.groups.forEach(([type, count, lane, , intent]) => {
      const def = ENEMY_TYPES[type];
      cards.push(
        manualCard({
          title: `${def.name} ×${count}`,
          tag: `${LANES[lane]} · ${intent || '来袭'}`,
          body: `${def.note} · 生命 ${def.hp} · 速度 ${def.speed}${def.armor ? ` · 护甲 ${def.armor}` : ''}`,
        }),
      );
    });
    if (hasFurniture(state, 'radio')) {
      for (const card of rv.timelineCards(state.day))
        cards.push(manualCard({ title: card.title, tag: card.tag, stats: card.rows }));
    } else {
      cards.push(
        manualCard({
          title: '短波电台',
          tag: '房车 · 未安装',
          body: '安装短波电台后，这里会显示今晚的生成时间轴，并在夜战 HUD 标出下一路来敌与倒计时。',
        }),
      );
    }
  }
  page.replaceChildren(...cards);
}
function openManual() {
  if (inside) {
    toast('先离开房车，再查看营地手册。');
    return;
  }
  if (state.over || rvTransition || $('#manual-dialog').open) return;
  renderManual();
  actor.send({ type: 'OPEN_MANUAL' });
  $('#manual-dialog').showModal();
}
function closeManual() {
  if ($('#manual-dialog').open) $('#manual-dialog').close();
}
document.querySelectorAll('[data-manual-tab]').forEach((tab) =>
  tab.addEventListener('click', () => {
    manualTab = tab.dataset.manualTab;
    renderManual();
  }),
);
$('#manual-close').addEventListener('click', closeManual);
$('#manual-dialog').addEventListener('close', () => actor.send({ type: 'CLOSE_MANUAL' }));
function cycleWeapon() {
  if (state.unlocked.length < 2) {
    toast('在营地手册（Tab）的工坊解锁更多武器。');
    return;
  }
  const index = state.unlocked.indexOf(state.weapon);
  equipWeapon(state, state.unlocked[(index + 1) % state.unlocked.length]);
  toast(`切换武器 · ${WEAPONS[state.weapon].name}`);
  syncUI();
}
function tryDash() {
  if (inside || rvTransition || state.paused || state.over) return;
  if (state.stamina < DASH.cost) {
    toast('体力不足，稍作休息。');
    return;
  }
  state.stamina -= DASH.cost;
  state.staminaDelay = DASH.delay;
  playerInvuln = Math.max(playerInvuln, DASH.invulnerable);
  const angle = player.rotation.y;
  dash = { time: DASH.duration, dx: Math.sin(angle), dz: Math.cos(angle) };
  audio.effect('dash');
  burst(player.position.x, 0.5, player.position.z, 5);
}
function tryFlare() {
  if (inside || rvTransition || state.paused || state.over) return;
  if (!useFlare(state)) {
    toast(`信号弹冷却中 · ${Math.ceil(state.flareCooldown)} 秒`);
    return;
  }
  const angle = player.rotation.y;
  const x = player.position.x + Math.sin(angle) * 1.2,
    z = player.position.z + Math.cos(angle) * 1.2;
  const flare = flareVisual();
  flare.active = true;
  flare.life = FLARE.duration;
  flare.x = x;
  flare.z = z;
  flare.group.position.set(x, 0, z);
  flare.group.visible = true;
  flare.light.intensity = 36;
  burst(x, 0.8, z, 14);
  audio.effect('flare');
  toast('信号弹升空 · 范围内的敌人被压制减速。');
}
function tryHeal() {
  if (inside || rvTransition || state.paused || state.over) return;
  if (heal(state)) {
    audio.effect('heal');
    burst(player.position.x, 0.8, player.position.z, 10);
    toast(`医疗包 · 生命 +${MEDKIT_HEAL}`);
    syncUI();
  } else toast(state.medkits < 1 ? '没有医疗包了。' : '生命已满，不必使用医疗包。');
}
function hurtPlayer(amount) {
  if (playerInvuln > 0 || state.over || state.paused) return;
  const downed = damagePlayer(state, amount);
  flashHurt();
  if (downed) {
    playerDown(state);
    nightRun.downs++;
    playerInvuln = 2.5;
    dash = null;
    movementTarget = null;
    player.position.set(0, 0, 3.2);
    toast('你被击倒了 · 营地损失 15 耐久，在篝火旁醒来。');
    actor.send({ type: 'CAMP_DESTROYED' });
  } else audio.effect('damage');
  syncUI();
}
addEventListener('keydown', (event) => {
  if (homeMode) return;
  const key = event.key.toLowerCase();
  if ($('#manual-dialog').open) {
    if (key === 'tab') {
      event.preventDefault();
      closeManual();
    }
    return;
  }
  if (
    event.target instanceof HTMLInputElement ||
    $('#help-dialog').open ||
    $('#end-dialog').open ||
    $('#perk-dialog').open
  )
    return;
  if (
    ['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key) ||
    key === 'tab' ||
    (key === ' ' && !(event.target instanceof HTMLButtonElement))
  )
    event.preventDefault();
  if (rvTransition && key !== 'p') {
    event.preventDefault();
    return;
  }
  keys.add(key);
  if (event.repeat) return;
  if ('123'.includes(key) && key.length === 1)
    selectBuild(['fence', 'tower', 'lantern'][Number(key) - 1]);
  if (key === 'tab') openManual();
  if (key === 'escape') {
    if (selectedBuilding) selectBuilding(null);
    else if (inside) enterOrExit();
    else selectBuild(null);
  }
  if (key === 'r' && ghost) {
    ghostAngle += Math.PI / 2;
    ghost.rotation.y = ghostAngle;
  }
  if (key === 'e') collect();
  if (key === 'n') transition();
  if (key === 'h') togglePhoto();
  if (key === 'p') togglePause();
  if (key === 'shift') tryDash();
  if (key === 'q') tryFlare();
  if (key === 'f') tryHeal();
  if (key === 'x') cycleWeapon();
});
addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));
addEventListener('blur', () => {
  keys.clear();
  movementTarget = null;
});
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) keys.clear();
  audio.update(state, inside);
});
function blocked(x, z) {
  if (inside) return interiorBlocked(x, z);
  return (
    !walkable(x, z) ||
    rvCollision(x, z) ||
    overlaps(x, z, obstacles.slice(1), 0.23) ||
    overlaps(x, z, world.trees, 0.22) ||
    overlaps(x, z, buildings, 0.22)
  );
}
function movePlayer(dt) {
  let dx =
    Number(keys.has('d') || keys.has('arrowright')) -
    Number(keys.has('a') || keys.has('arrowleft'));
  let dz =
    Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
  if (dx || dz) movementTarget = null;
  else if (movementTarget) {
    dx = movementTarget.x - player.position.x;
    dz = movementTarget.z - player.position.z;
    if (Math.hypot(dx, dz) < 0.25) {
      movementTarget = null;
      dx = dz = 0;
    }
  }
  let length = Math.hypot(dx, dz);
  const dashing = !inside && dash;
  if (dashing) {
    dx = dash.dx;
    dz = dash.dz;
    length = 1;
  }
  const moving = length > 0.01;
  if (moving) {
    const speed = dashing ? DASH.speed : inside ? 2.2 : 5.1;
    dx = (dx / length) * dt * speed;
    dz = (dz / length) * dt * speed;
    const p = player.position;
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    if (!dashing) player.rotation.y = Math.atan2(dx, dz);
  }
  if (dashing) {
    dash.time -= dt;
    if (dash.time <= 0) dash = null;
  }
  player.userData.body.position.y = moving
    ? Math.abs(Math.sin(time * 13)) * 0.06
    : Math.sin(time * 2) * 0.014;
  player.userData.legs.forEach(
    (leg, i) => (leg.rotation.x = moving ? Math.sin(time * 13 + i * Math.PI) * 0.6 : 0),
  );
  marker.position.x = player.position.x;
  marker.position.z = player.position.z;
}
const LANE_START = [
  [-2, -29],
  [-28, -0.5],
  [18, 9],
];
function spawn(entry) {
  const record = enemyPools[entry.type].find((e) => !e.alive);
  if (!record) return false;
  const def = ENEMY_TYPES[entry.type],
    [x, z] = LANE_START[entry.lane] || LANE_START[0];
  record.mesh.position.set(x + (random() - 0.5) * 3, 0, z + (random() - 0.5) * 3);
  record.mesh.rotation.set(0, 0, 0);
  record.mesh.userData.body.rotation.x = 0;
  record.hp = record.maxHp = def.hp;
  record.attack = 0;
  record.slow = 0;
  record.slowFactor = 1;
  record.flash = 0;
  record.dying = 0;
  record.kx = 0;
  record.kz = 0;
  setEnemyMaterial(record, enemyMaterials.skin);
  record.alive = true;
  record.mesh.visible = true;
  if (entry.type === 'alpha') toast('林中巨影出现了 · 集火它！');
  return true;
}
function tracer(from, target, color = '#ffe6a1') {
  const shot = shots.find((s) => s.life <= 0);
  if (!shot) return;
  const end = target.mesh.position;
  v.set(end.x - from.x, 0.85 - from.y, end.z - from.z);
  shot.mesh.position.set(from.x + v.x / 2, from.y + v.y / 2, from.z + v.z / 2);
  shot.mesh.scale.set(0.035, v.length(), 0.035);
  shot.mesh.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP, v.normalize());
  shot.mesh.material.color.set(color);
  shot.mesh.visible = true;
  shot.life = 0.075;
}
function spawnMuzzle(x, y, z, dx, dz) {
  const flash = muzzles.find((f) => f.life <= 0);
  if (!flash) return;
  const m = flash.mesh;
  m.position.set(x, y, z);
  m.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP, v.set(dx, 0.05, dz).normalize());
  m.scale.set(0.15 + random() * 0.06, 0.22 + random() * 0.12, 0.15 + random() * 0.06);
  m.visible = true;
  flash.life = 0.055;
}
function damageBuilding(b, amount) {
  const view = viewOf(b);
  b.hp -= amount;
  view.hit = 0.16;
  if (b.hp > 0) {
    audio.effect('damage');
    trauma.add(0.05);
    return false;
  }
  audio.effect('destroy');
  trauma.add(0.5);
  burst(b.x, 1, b.z, 16);
  detachBuildingView(b);
  buildings.splice(buildings.indexOf(b), 1);
  if (selectedBuilding === b) selectBuilding(null);
  toast(`${NAMES[b.type]}被摧毁了。`);
  return true;
}
// Reveal rule for stalkers: lamps, flares and close range cut through fog.
function enemyVisible(e) {
  if (!ENEMY_TYPES[e.type].stealth) return true;
  const p = e.mesh.position;
  const lanterns = buildings
    .filter((b) => b.type === 'lantern')
    .map((b) => ({ x: b.x, z: b.z, radius: lanternRadius(b) }));
  const flares = flarePool.map((f) => ({ active: f.active, x: f.x, z: f.z, radius: FLARE.radius }));
  return revealed(p.x, p.z, player.position.x, player.position.z, lanterns, flares, currentFog());
}
const currentFog = () => WAVES[state.day - 1]?.fog || 0;
function fireSpit(enemy, goal, def) {
  const spit = spits.find((s) => s.life <= 0);
  if (!spit) return;
  const p = enemy.mesh.position;
  spit.from.set(p.x, 0.95, p.z);
  spit.to.set(
    goal.kind === 'building' ? goal.building.x : player.position.x,
    0.8,
    goal.kind === 'building' ? goal.building.z : player.position.z,
  );
  spit.total = Math.max(0.28, spit.from.distanceTo(spit.to) / 9);
  spit.life = spit.total;
  spit.kind = goal.kind;
  spit.ref = goal.building || null;
  spit.damage = def.damage;
  spit.mesh.position.copy(spit.from);
  spit.mesh.visible = true;
  spitCount++;
}
function applySpitHit(spit) {
  burst(spit.mesh.position.x, spit.mesh.position.y, spit.mesh.position.z, 4);
  if (spit.kind === 'building') {
    if (buildings.includes(spit.ref)) damageBuilding(spit.ref, spit.damage + 3);
    return;
  }
  if (Math.hypot(player.position.x - spit.to.x, player.position.z - spit.to.z) < 1.3)
    hurtPlayer(spit.damage);
}
function damageEnemy(enemy, damage, fromX, fromZ) {
  const def = ENEMY_TYPES[enemy.type];
  enemy.hp -= damage;
  const p = enemy.mesh.position;
  burst(p.x, 0.9, p.z, damage >= 4 ? 6 : 3);
  if (enemy.hp > 0) {
    enemy.flash = 0.12;
    setEnemyMaterial(enemy, enemyFlashMaterial);
    hitFlashes++;
    // Living targets flinch away from the shooter; the alpha holds its ground.
    if (Number.isFinite(fromX) && Number.isFinite(fromZ) && enemy.type !== 'alpha') {
      const dx = p.x - fromX,
        dz = p.z - fromZ,
        d = Math.hypot(dx, dz) || 1;
      const power = Math.min(3.2, 1.2 + damage * 0.45) * (enemy.type === 'brute' ? 0.35 : 1);
      enemy.kx += (dx / d) * power;
      enemy.kz += (dz / d) * power;
      knockbacks++;
    }
    return;
  }
  enemy.alive = false;
  enemy.dying = 0.5;
  enemy.flash = 0;
  state.kills++;
  state.wood += def.bounty;
  deaths++;
  audio.effect('kill');
  hitStop.trigger(hitStopFor(def.hp));
  trauma.add(killTraumaFor(def.hp));
  burst(p.x, 1, p.z, enemy.type === 'alpha' ? 30 : 8);
  if (enemy.type === 'alpha') toast('林中巨影倒下了。');
  syncUI();
}
// Knockback fall plays after the enemy already left the combat simulation.
function updateEnemyEffects(dt) {
  for (const e of enemies) {
    if (e.flash > 0) {
      e.flash = Math.max(0, e.flash - dt);
      e.mesh.userData.body.rotation.x = (-e.flash / 0.12) * 0.3;
      if (!e.flash) {
        setEnemyMaterial(e, enemyMaterials.skin);
        e.mesh.userData.body.rotation.x = 0;
      }
    }
    if (e.dying > 0) {
      e.dying -= dt;
      const t = 1 - Math.max(0, e.dying) / 0.5;
      e.mesh.userData.body.rotation.x = 0;
      e.mesh.rotation.x = -1.35 * t;
      e.mesh.position.y = -0.3 * t;
      if (e.dying <= 0) {
        e.mesh.visible = false;
        e.mesh.rotation.x = 0;
        e.mesh.position.y = 0;
        setEnemyMaterial(e, enemyMaterials.skin);
      }
    }
  }
}
const shotFrom = new T.Vector3();
function inRange(x, z, range, count) {
  const list = [];
  for (const e of enemies)
    if (e.alive && enemyVisible(e)) {
      const d = Math.hypot(e.mesh.position.x - x, e.mesh.position.z - z);
      if (d <= range) list.push({ e, d });
    }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, count).map((t) => t.e);
}
function towerFire(b, target) {
  const stats = towerStats(b);
  const def = ENEMY_TYPES[target.type];
  shotFrom.set(b.x, 4.3, b.z);
  tracer(shotFrom, target);
  spawnMuzzle(b.x, 4.36, b.z, target.mesh.position.x - b.x, target.mesh.position.z - b.z);
  muzzleLight.position.set(b.x, 4.4, b.z);
  muzzleLight.color.set('#ffe6a1');
  muzzleLight.intensity = 20;
  muzzleFlashes++;
  damageEnemy(
    target,
    applyArmor(attackDamage(state, stats.damage, true), def.armor, 0.25),
    b.x,
    b.z,
  );
  audio.effect('tower');
}
function playerAttack(dt) {
  const weapon = WEAPONS[state.weapon];
  shotTimer -= dt;
  if (shotTimer > 0) return;
  const targets = inRange(
    player.position.x,
    player.position.z,
    weaponRange(state, state.weapon),
    weapon.targets,
  );
  if (!targets.length) return;
  const first = targets[0].mesh.position;
  player.rotation.y = Math.atan2(first.x - player.position.x, first.z - player.position.z);
  for (const target of targets) {
    const def = ENEMY_TYPES[target.type];
    const base = attackDamage(state, weaponDamage(state, state.weapon));
    tracer(shotFrom.set(player.position.x, 1, player.position.z), target, weapon.color);
    damageEnemy(
      target,
      applyArmor(base, def.armor, weapon.armorPen),
      player.position.x,
      player.position.z,
    );
  }
  shotTimer = weapon.interval;
  muzzleFlashes++;
  recoils++;
  player.userData.recoil = 1;
  spawnMuzzle(
    player.position.x,
    1.05,
    player.position.z,
    first.x - player.position.x,
    first.z - player.position.z,
  );
  muzzleLight.position.set(player.position.x, 1.1, player.position.z);
  muzzleLight.color.set(weapon.color);
  muzzleLight.intensity = 26;
  audio.effect('shoot');
}
function combat(dt) {
  if (state.phase !== 'night') return;
  nightClock += dt;
  while (spawnQueue.length && spawnQueue[0].at <= nightClock) {
    if (!spawn(spawnQueue[0])) break;
    spawnQueue.shift();
    remaining--;
  }
  playerAttack(dt);
  for (const b of buildings)
    if (b.type === 'tower' && viewOf(b).growth >= 1) {
      const view = viewOf(b);
      view.cooldown -= dt;
      if (view.cooldown > 0) continue;
      const enemy = inRange(b.x, b.z, towerStats(b).range, 1)[0];
      if (enemy) {
        towerFire(b, enemy);
        view.cooldown = towerStats(b).cooldown;
      }
    }
  for (const e of enemies)
    if (e.alive) {
      const def = ENEMY_TYPES[e.type],
        p = e.mesh.position;
      e.mesh.visible = enemyVisible(e);
      let tx = -1,
        tz = -1.6;
      // Siege enemies ignore the lanes and go straight for a tower; the rest follow clear paths.
      if (def.siege) {
        const tower = siegeGoal(p.x, p.z, buildings, def.siege);
        if (tower) {
          tx = tower.x;
          tz = tower.z;
        }
      } else if (p.z < -12) {
        tx = -1;
        tz = -10;
      } else if (p.x < -13) {
        tx = -10;
        tz = 4;
      }
      const dx = tx - p.x,
        dz = tz - p.z,
        length = Math.hypot(dx, dz);
      let speed = def.speed;
      for (const b of buildings)
        if (b.type === 'lantern' && Math.hypot(b.x - p.x, b.z - p.z) < lanternRadius(b))
          speed *= lanternSlow(b);
      for (const flare of flarePool)
        if (flare.active && Math.hypot(flare.x - p.x, flare.z - p.z) < FLARE.radius) {
          e.slow = 0.25;
          e.slowFactor = e.type === 'alpha' ? FLARE.bossSlow : FLARE.slow;
        }
      if (e.slow > 0) speed *= e.slowFactor;
      e.slow = Math.max(0, e.slow - dt);
      e.attack -= dt;
      const barrier = buildings.find((b) => Math.hypot(b.x - p.x, b.z - p.z) < b.r + 0.65);
      const playerNear = Math.hypot(p.x - player.position.x, p.z - player.position.z) < 1.1;
      const ranged =
        def.ranged && e.attack <= 0
          ? rangedGoal(p.x, p.z, player.position.x, player.position.z, buildings, def.range)
          : null;
      if (ranged) {
        e.attack = def.attackRate;
        fireSpit(e, ranged, def);
        e.mesh.rotation.y = Math.atan2(
          (ranged.building ? ranged.building.x : player.position.x) - p.x,
          (ranged.building ? ranged.building.z : player.position.z) - p.z,
        );
      } else if (barrier) {
        if (e.attack <= 0) {
          e.attack = def.attackRate;
          burst(p.x, 0.7, p.z, 2);
          damageBuilding(barrier, 9 * def.wallDamage);
        }
      } else if (playerNear && e.attack <= 0) {
        e.attack = def.attackRate;
        hurtPlayer(def.damage);
      } else if (rvCollision(p.x, p.z, 0.2)) {
        if (e.attack <= 0) {
          damageCamp(state, def.damage);
          audio.effect('damage');
          e.attack = def.attackRate * 1.2;
          trauma.add(0.45);
          flashHurt();
          syncUI();
          actor.send({ type: 'CAMP_DESTROYED' });
        }
      } else if (length > 0.01) {
        p.x += (dx / length) * dt * speed;
        p.z += (dz / length) * dt * speed;
      }
      if (e.kx || e.kz) {
        const nx = p.x + e.kx * dt,
          nz = p.z + e.kz * dt;
        if (!rvCollision(nx, nz, 0.1)) {
          p.x = nx;
          p.z = nz;
        }
        const damp = Math.exp(-dt * 11);
        e.kx *= damp;
        e.kz *= damp;
        if (Math.abs(e.kx) < 0.02) e.kx = 0;
        if (Math.abs(e.kz) < 0.02) e.kz = 0;
      }
      if (!ranged) e.mesh.rotation.y = Math.atan2(dx, dz);
      e.mesh.userData.body.position.y = Math.abs(Math.sin(time * 7 + e.seed)) * 0.06;
      e.mesh.userData.legs.forEach(
        (leg, i) => (leg.rotation.x = Math.sin(time * 7 + e.seed + i * Math.PI) * 0.4),
      );
    }
  if (!remaining && !spawnQueue.length && !enemies.some((e) => e.alive) && state.elapsed > 5)
    transition();
}
function updateBossBar() {
  const boss = enemies.find((e) => e.alive && e.type === 'alpha'),
    bar = $('#boss-bar');
  if (!boss) {
    if (!bar.hidden) bar.hidden = true;
    return;
  }
  bar.hidden = false;
  $('#boss-hp').style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%`;
}
function endGame() {
  if ($('#end-dialog').open) return;
  audio.update(state, inside);
  audio.effect(state.won ? 'victory' : 'defeat');
  keys.clear();
  movementTarget = null;
  selectBuild(null);
  selectBuilding(null);
  $('#end-dialog h2').textContent = state.won ? '天亮了，我们守住了。' : '余烬尚未冷却。';
  $('#end-dialog .eyebrow').textContent = state.won
    ? 'FIVE NIGHTS · A LIGHT SURVIVES'
    : 'THE FIRE WILL BURN AGAIN';
  $('#end-text').textContent = state.won
    ? `五个夜晚全部守住，累计击退 ${state.kills} 位来袭者。营地耐久 ${Math.ceil(state.health)}%，剩余木材 ${state.wood}。救援终于抵达松林。`
    : `你守住了 ${state.day - 1} 个夜晚，击退 ${state.kills} 位不速之客。带上经验，再点燃一次营火吧。`;
  $('#end-dialog').showModal();
}
$('#end-dialog').addEventListener('cancel', (event) => event.preventDefault());
function syncAudioUI() {
  const settings = audio.settings,
    locked = audio.stats.context === 'locked';
  const enabled = settings.enabled && !locked;
  $('#sound').setAttribute('aria-pressed', String(enabled));
  $('#sound').setAttribute('aria-label', enabled ? '静音' : '开启音乐与音效');
  $('#sound').title = enabled ? '静音 · 音量在旁边设置' : '点击开启 8-bit 音乐与音效';
  $('#audio-status').textContent = !settings.enabled
    ? '已静音'
    : locked
      ? '点击或按键后播放 · 设置自动保存'
      : '8-bit 原创配乐 · 设置自动保存';
  for (const key of ['master', 'music', 'sfx']) {
    $(`#audio-${key}`).value = Math.round(settings[key] * 100);
    $(`#audio-${key}-value`).textContent = `${Math.round(settings[key] * 100)}%`;
  }
}
let audioErrorShown = false;
async function unlockAudio() {
  try {
    await audio.unlock();
  } catch {
    if (!audioErrorShown) toast('声音未能开启，请点击 ♫ 重试或检查浏览器声音权限。');
    audioErrorShown = true;
  }
  syncAudioUI();
}
// Browsers require a user gesture. Do not force autoplay or override saved mute.
for (const eventName of ['pointerdown', 'keydown'])
  addEventListener(
    eventName,
    (event) => {
      if (event.target.closest?.('#sound') || (eventName === 'keydown' && event.repeat)) return;
      if (audio.settings.enabled && ['locked', 'suspended'].includes(audio.stats.context))
        void unlockAudio();
    },
    { capture: true },
  );
$('#sound').addEventListener('click', () => {
  audio.configure('enabled', audio.stats.context === 'locked' ? true : !audio.settings.enabled);
  if (audio.settings.enabled) void unlockAudio();
  syncAudioUI();
});
for (const key of ['master', 'music', 'sfx'])
  $(`#audio-${key}`).addEventListener('input', (event) => {
    audio.configure(key, Number(event.target.value) / 100);
    syncAudioUI();
  });
syncAudioUI();
const daySun = new T.Color('#fff0ce'),
  nightSun = new T.Color('#92b9dc');
const daySky = new T.Color('#d4e2e2'),
  nightSky = new T.Color('#7593b6');
function ambience(dt) {
  daylight = T.MathUtils.damp(daylight, homeMode ? 0.18 : state.phase === 'day' ? 1 : 0, 0.55, dt);
  sun.color.copy(nightSun).lerp(daySun, daylight);
  sun.intensity = 0.32 + daylight * 2.15;
  sky.color.copy(nightSky).lerp(daySky, daylight);
  sky.intensity = 0.43 + daylight * 1.57;
  fill.intensity = 0.08 + daylight * 0.2;
  moon.intensity = (1 - daylight) * 0.5;
  const fog = currentFog();
  moon.intensity = (1 - daylight) * 0.5 * (1 - fog * 0.55);
  world.doorLight.intensity = (1 - daylight) * 7;
  updateRvGlow(world, state.rv, daylight, interior ? interior.lampOn : true, ambientTime);
  playerLight.intensity = (1 - daylight) * 9 * (1 - fog * 0.45);
  playerLight.distance = 8 - fog * 3;
  playerLight.position.set(player.position.x, 1.6, player.position.z + 0.3);
  renderer.toneMappingExposure = 0.9 + daylight * 0.14 - (1 - daylight) * fog * 0.07;
  const motion = motionPreference.matches ? 0 : 1;
  ambientTime += dt * motion;
  const t = ambientTime,
    breath = Math.sin(t * 1.1) * motion;
  world.wind.time.value = t;
  world.wind.strength.value = motion;
  world.waterMat.uniforms.time.value = t;
  world.waterMat.uniforms.day.value = daylight;
  world.fireLight.intensity =
    (28 + (1 - daylight) * 32) * (1 + breath * 0.08 + Math.sin(t * 8.3) * 0.035 * motion);
  world.halo.material.opacity = (0.24 + (1 - daylight) * 0.63) * (1 + breath * 0.08);
  world.halo.scale.setScalar(6 + breath * 0.3);
  world.flames.children.forEach((flame, i) => {
    flame.scale.y = 0.65 + Math.sin(t * 6 + i * 2.1) * 0.23 * motion;
    flame.position.y = 0.4 + flame.scale.y * 0.15;
    flame.rotation.y = t * 0.7 + i;
  });
  muzzleLight.intensity *= Math.exp(-dt * 30);
  for (const s of spits)
    if (s.life > 0) {
      s.life -= dt;
      const k = 1 - Math.max(0, s.life) / s.total;
      s.mesh.position.lerpVectors(s.from, s.to, k);
      s.mesh.position.y = s.from.y + (s.to.y - s.from.y) * k + Math.sin(k * Math.PI) * 0.7;
      if (s.life <= 0) {
        s.mesh.visible = false;
        applySpitHit(s);
      }
    }
  for (const f of muzzles)
    if (f.life > 0) {
      f.life -= dt;
      f.mesh.visible = f.life > 0;
      f.mesh.scale.multiplyScalar(Math.exp(-dt * 9));
    }
  // Recoil kicks the rifle back, then the arm settles.
  player.userData.recoil = Math.max(0, (player.userData.recoil || 0) - dt * 6.5);
  if (player.userData.gun) player.userData.gun.position.z = 0.34 - player.userData.recoil * 0.07;
  player.userData.body.rotation.x = player.userData.recoil * 0.1;
  for (const flare of flarePool)
    if (flare.active) {
      flare.life -= dt;
      flare.light.intensity = flare.life > 0 ? 34 + Math.sin(t * 22) * 9 * motion : 0;
      flare.orb.scale.setScalar(1 + Math.sin(t * 18) * 0.16 * motion);
      if (flare.life <= 0) {
        flare.active = false;
        flare.group.visible = false;
      }
    }
  // Fixed ends, gently moving middle; pendants and wire share the same curve.
  const wire = world.lightWire.geometry.attributes.position;
  for (let i = 0; i < wire.count; i++) {
    const u = i / (wire.count - 1);
    wire.setZ(i, 2 + Math.sin(Math.PI * u) * Math.sin(t * 0.9 + u * 1.7) * 0.16 * motion);
  }
  wire.needsUpdate = true;
  for (const pendant of world.pendants) {
    const u = pendant.userData.fraction;
    pendant.position.z = 2 + Math.sin(Math.PI * u) * Math.sin(t * 0.9 + u * 1.7) * 0.16 * motion;
    pendant.rotation.x = Math.sin(t * 1.15 + u * 2) * 0.1 * motion;
  }
  fireflyMat.opacity = motion * (0.26 + (1 - daylight) * 0.65);
  fireflyMat.size = 0.065 + (1 - daylight) * 0.045;
  for (let i = 0; i < fireflyCount; i++) {
    const f = fireflySeeds[i],
      brightness =
        0.12 + 0.88 * Math.pow(0.5 + 0.5 * Math.sin(t * (1.1 + (i % 5) * 0.13) + f.phase), 2);
    fireflyPositions[i * 3] = f.x + Math.sin(t * 0.23 + f.phase) * 1.6;
    fireflyPositions[i * 3 + 1] = f.y + Math.sin(t * 0.6 + f.phase) * 0.4;
    fireflyPositions[i * 3 + 2] = f.z + Math.cos(t * 0.2 + f.phase) * 0.9;
    fireflyColors[i * 3] = brightness;
    fireflyColors[i * 3 + 1] = brightness;
    fireflyColors[i * 3 + 2] = brightness;
  }
  fireflyGeo.attributes.position.needsUpdate = true;
  fireflyGeo.attributes.color.needsUpdate = true;
  smoke.forEach((m, i) => {
    const age = (t * 0.16 + i / smoke.length) % 1;
    m.position.set(
      0.1 + age * 1.7 + Math.sin(t * 0.85 + age * 2) * age * 0.5,
      1.1 + age * 4,
      5.6 - age * 0.45 + Math.sin(t * 0.68) * age * 0.35,
    );
    m.scale.setScalar(0.13 + age * 0.45);
    m.rotation.y = i + t * 0.1;
    m.material.opacity = Math.sin(age * Math.PI) * 0.09 * motion;
  });
  if (motion && random() < dt * 20) burst(0.1, 0.5, 5.6, 1);
  for (const b of buildings) {
    const view = viewOf(b);
    if (view.growth < 1) {
      view.growth = Math.min(1, view.growth + dt * 1.5);
      view.mesh.scale.setScalar(easeOutBack(view.growth));
    }
    if (view.hit > 0) {
      view.hit = Math.max(0, view.hit - dt);
      view.mesh.rotation.z = Math.sin(time * 46) * 0.03 * (view.hit / 0.16);
      if (!view.hit) view.mesh.rotation.z = 0;
    }
    if (view.light) {
      view.light.intensity = (4 + (1 - daylight) * 20) * (1 - fog * 0.5);
      view.light.distance = 9 - fog * 3.5;
    }
  }
  for (const s of shots)
    if (s.life > 0) {
      s.life -= dt;
      if (s.life <= 0) s.mesh.visible = false;
    }
  for (const p of particles)
    if (p.life > 0) {
      p.life -= dt;
      p.mesh.visible = p.life > 0;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= dt * 2;
      p.mesh.scale.multiplyScalar(Math.exp(-dt * 0.8));
    }
}
function resize() {
  const aspect = innerWidth / innerHeight,
    size = innerWidth < 650 ? zoom * 1.2 : zoom;
  camera.left = -size * aspect;
  camera.right = size * aspect;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  const pixelScale = innerWidth < 650 ? 1.1 : 1.45;
  renderer.setSize(
    Math.round(innerWidth / pixelScale),
    Math.round(innerHeight / pixelScale),
    false,
  );
  if (interior) {
    const height = Math.max(4.3, 6.2 / aspect),
      c = interior.camera;
    c.left = -height * aspect;
    c.right = height * aspect;
    c.top = height;
    c.bottom = -height;
    c.updateProjectionMatrix();
  }
  updateGhost();
}
addEventListener('resize', resize);
resize();
syncUI();
let uiTimer = 0,
  titleAngle = 0;
function updateTitleCamera(dt) {
  titleAngle += dt * 0.06;
  const aspect = innerWidth / innerHeight,
    size = innerWidth < 650 ? 11 : 9;
  camera.left = -size * aspect;
  camera.right = size * aspect;
  camera.top = size;
  camera.bottom = -size;
  camera.updateProjectionMatrix();
  const radius = 14 + Math.sin(titleAngle * 0.3) * 1.5;
  const px = pointerInside ? pointer.x : 0;
  cameraCenter.set(-1, 0, 2);
  camera.position.set(
    -1 + Math.cos(titleAngle) * radius + px * 1.4,
    5.6 + Math.sin(titleAngle * 0.9) * 0.7,
    2.2 + Math.sin(titleAngle) * radius * 0.8,
  );
  camera.lookAt(-1 + px * 0.8, 1.5, 1.4);
  camera.updateMatrixWorld();
  sun.position.set(cameraCenter.x - 26, 35, cameraCenter.z - 22);
  sun.target.position.set(cameraCenter.x, 0, cameraCenter.z);
  moon.position.set(cameraCenter.x + 24, 30, cameraCenter.z + 20);
  moon.target.position.set(cameraCenter.x, 0, cameraCenter.z);
}
renderer.setAnimationLoop((now) => {
  const realDt = Math.max(0, Math.min((now - last) / 1000, 0.05));
  last = now;
  const shake = trauma.update(realDt);
  const dt = realDt * hitStop.update(realDt);
  if (homeMode) {
    time += dt;
    ambience(dt);
    updateTitleCamera(realDt);
    renderer.render(scene, camera);
    return;
  }
  if (rvTransition) {
    if (!state.paused && !document.hidden) rvTransition.elapsed += dt;
    const p = motionPreference.matches ? 1 : Math.min(1, rvTransition.elapsed / 0.9);
    if (p >= 0.5 && !rvTransition.switched) {
      switchRV();
      rvTransition.switched = true;
    }
    const approach = p < 0.5 ? p * 2 : (1 - p) * 2;
    const ease = approach * approach * (3 - 2 * approach);
    $('#rv-fade').style.opacity = String(ease);
    if (inside) {
      interior.camera.zoom = 1 + ease * 0.12;
      interior.camera.updateProjectionMatrix();
    } else {
      camera.zoom = 1 + ease * 0.55;
      camera.updateProjectionMatrix();
      v.copy(rvTransition.center).lerp(doorPosition, ease * 0.65);
      camera.position.set(v.x + 2, 46, v.z + 37);
      camera.lookAt(v.x, 0, v.z - 0.3);
    }
    renderer.render(inside ? interior.scene : scene, inside ? interior.camera : camera);
    if (p === 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      interior.camera.zoom = 1;
      interior.camera.updateProjectionMatrix();
      $('#rv-fade').hidden = true;
      rvTransition = null;
      keys.clear();
    }
    return;
  }
  if (!state.paused && !state.over && !document.hidden) {
    time += dt;
    if (inside) movePlayer(dt);
    else {
      state.elapsed += dt;
      tickSurvival(state, dt);
      ambience(dt);
      movePlayer(dt);
      combat(dt);
      updateEnemyEffects(dt);
      if (phaseValue(actor.getSnapshot()) === 'day' && state.elapsed > DAY_LENGTH) transition();
    }
    uiTimer += dt;
    if (uiTimer > 0.5) {
      syncUI();
      uiTimer = 0;
    }
  }
  playerInvuln = Math.max(0, playerInvuln - dt);
  player.userData.body.visible = playerInvuln <= 0 || Math.floor(time * 14) % 2 === 0;
  updateBossBar();
  syncPlayerHud();
  if (inside) {
    renderer.render(interior.scene, interior.camera);
    return;
  }
  const focus = cameraFocus(player.position.x, player.position.z, camera.right, camera.top);
  cameraCenter.x = T.MathUtils.damp(cameraCenter.x, focus.x, 4, dt);
  cameraCenter.z = T.MathUtils.damp(cameraCenter.z, focus.z, 4, dt);
  camera.position.set(cameraCenter.x + 2, 46, cameraCenter.z + 37);
  camera.lookAt(cameraCenter.x, 0, cameraCenter.z - 0.3);
  if (shakeEnabled) {
    camera.position.x += shake.x;
    camera.position.z += shake.z;
    camera.rotation.z += shake.roll;
  }
  camera.updateMatrixWorld();
  sun.position.set(cameraCenter.x - 26, 35, cameraCenter.z - 22);
  sun.target.position.set(cameraCenter.x, 0, cameraCenter.z);
  moon.position.set(cameraCenter.x + 24, 30, cameraCenter.z + 20);
  moon.target.position.set(cameraCenter.x, 0, cameraCenter.z);
  if (pointerInside && ghost) {
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(groundPlane, cursor);
    updateGhost();
  }
  const doorButton = $('#rv-door');
  doorButton.hidden = photoMode || !nearDoor() || state.paused || state.over;
  if (!doorButton.hidden) {
    v.copy(doorPosition).setY(1.5).project(camera);
    doorButton.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
    doorButton.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
    doorButton.textContent = state.phase === 'day' ? 'E · 进入房车' : '夜间守营 · 天亮后进入';
  }
  renderer.render(scene, camera);
});
// ——— Campaign state machine (ARC-02): phase and pause flags are machine-owned ———
const actor = startCampaign({
  state,
  canClear: () => remaining === 0 && !spawnQueue.length && !enemies.some((e) => e.alive),
  canEnterRV: () => nearDoor(),
  onNightStart: () => {
    beginNight();
    audio.update(state, inside);
    audio.effect('night');
    selectBuild(null);
    selectBuilding(null);
  },
  onDawn: () => {
    world.logs.forEach((l) => (l.remaining = 4));
    shotTimer = 0;
    toast('天亮了。营地补给已送达，按 Tab 查看工坊与远征。');
    audio.update(state, inside);
    audio.effect('dawn');
    selectBuild(null);
    selectBuilding(null);
    openPerks();
  },
  onVictory: () => endGame(),
  onDefeat: () => endGame(),
  onPerkChosen: (s, id) => {
    if ($('#perk-dialog').open) $('#perk-dialog').close();
    const saved = writeSave(state);
    toast(saved.ok ? `获得专长：${PERKS[id].name}` : `获得专长：${PERKS[id].name} · 存档写入失败`);
    $('#world').focus();
  },
});
actor.subscribe(() => syncUI());

// ——— Title screen entry (ARC-04): new campaign or the last dawn checkpoint ———
const homeEnabled = new URLSearchParams(location.search).has('home') || !navigator.webdriver;
const home = createHome({
  onStart: () => startNewCampaign(),
  onContinue: () => {
    const loaded = readSave();
    if (loaded.ok) continueCampaign(loaded.save);
  },
  onSpark: () => {
    burst(0.1, 1, 5.6, 9);
    audio.effect('collect');
  },
  onPointer: (clientX, clientY) => {
    pointer.set((clientX / innerWidth) * 2 - 1, 1 - (clientY / innerHeight) * 2);
    pointerInside = true;
  },
  onLeave: () => {
    pointerInside = false;
  },
});
function clearSession() {
  selectBuild(null);
  selectBuilding(null);
  keys.clear();
  movementTarget = null;
  shotTimer = 0;
  nightClock = 0;
  spawnQueue = [];
  remaining = 0;
}
function startNewCampaign() {
  resetCampaign(state);
  state.logs.forEach((log) => {
    log.remaining = 4;
  });
  syncBuildingScene();
  clearSession();
  enterGame();
  const saved = writeSave(state);
  toast(saved.ok ? '新的营地记录已建立。' : '无法写入存档，本局仍可正常游玩。');
}
function continueCampaign(save) {
  applySave(state, save);
  syncBuildingScene();
  clearSession();
  enterGame();
  toast(`继续第 ${state.day} 天 · 营地 ${Math.ceil(state.health)}%`);
}
function enterGame() {
  homeMode = false;
  home.hide();
  $('#app').classList.remove('home-mode');
  resize();
  $('#world').focus();
  syncUI();
}
function enterHome() {
  homeMode = true;
  $('#app').classList.add('home-mode');
  clearSession();
  const loaded = readSave();
  home.show({
    save: loaded.ok ? saveSummary(loaded.save) : null,
    broken: !loaded.ok && loaded.reason !== 'missing' && loaded.reason !== 'storage',
  });
  pointerInside = false;
  syncUI();
}

async function boot() {
  setLoadingProgress(52, '准备松林电台');
  const audioReady = audio.prepare();
  setLoadingProgress(64, audioReady ? '松林电台已就绪' : '声音将在首次操作后启用');
  setLoadingProgress(70, '载入界面字体');
  try {
    await document.fonts?.ready;
  } catch {
    /* Fallback fonts are enough to start. */
  }
  setLoadingProgress(82, '预热光影');
  try {
    await renderer.compileAsync(scene, camera);
  } catch (error) {
    console.error(error);
    toast('部分渲染效果未能预热，将使用后备模式。');
  }
  setLoadingProgress(100, '松林已准备好');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  loading.classList.add('done');
  if (homeEnabled) enterHome();
}
void boot();
// Read-only diagnostics for browser smoke tests and performance inspection.
window.__pinefall = {
  get audio() {
    return audio.stats;
  },
  get machine() {
    const snap = actor.getSnapshot();
    return {
      phase: phaseValue(snap),
      overlay: overlayValue(snap),
      interior: isInterior(snap),
      paused: snap.context.paused,
    };
  },
  get home() {
    return { visible: home.visible, mode: homeMode, enabled: homeEnabled };
  },
  startNew: () => startNewCampaign(),
  continueSave: () => {
    const loaded = readSave();
    if (loaded.ok) continueCampaign(loaded.save);
    return loaded.ok;
  },
  get loading() {
    return { progress: loadingProgress, ready: loading.classList.contains('done') };
  },
  get state() {
    return { ...state, perks: [...state.perks], unlocked: [...state.unlocked] };
  },
  get stats() {
    return {
      inside,
      transitioning: !!rvTransition,
      lampOn: interior ? interior.lampOn : null,
      manualOpen: $('#manual-dialog').open,
      viewZoom: inside ? interior.camera.zoom : camera.zoom,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      enemies: enemies.filter((e) => e.alive).length,
      remaining,
      ambientTime,
      windStrength: world.wind.strength.value,
      wireZ: world.lightWire.geometry.attributes.position.getZ(20),
      fireIntensity: world.fireLight.intensity,
      buildings: buildings.length,
      buildingLevels: buildings.map((b) => `${b.type}:${b.level}:${Math.ceil(b.hp)}`),
      selectedBuilding: selectedBuilding ? selectedBuilding.type : null,
      camera: cameraCenter.toArray(),
      player: player.position.toArray(),
      playerHp: state.playerHp,
      maxHp: maxHp(state),
      stamina: state.stamina,
      medkits: state.medkits,
      scrap: state.scrap,
      weapon: state.weapon,
      enemyTypes: enemies
        .filter((e) => e.alive)
        .reduce((counts, e) => ((counts[e.type] = (counts[e.type] || 0) + 1), counts), {}),
      flareActive: flarePool.some((f) => f.active),
      flareCooldown: state.flareCooldown,
      dashing: !!dash,
      invulnerable: playerInvuln > 0,
      shakeEnabled,
      trauma: trauma.value,
      shakeFrames: trauma.frames,
      muzzleFlashes,
      flashes: hitFlashes,
      dying: enemies.filter((e) => e.dying > 0).length,
      deaths,
      hitStops: hitStop.count,
      knockbacks,
      recoils,
      fog: currentFog(),
      hidden: enemies.filter((e) => e.alive && !enemyVisible(e)).length,
      spits: spitCount,
      sieging: enemies.filter(
        (e) =>
          e.alive &&
          ENEMY_TYPES[e.type].siege &&
          siegeGoal(e.mesh.position.x, e.mesh.position.z, buildings, ENEMY_TYPES[e.type].siege),
      ).length,
      rating: lastRating ? { ...lastRating } : null,
      rv: [...state.rv],
      rvSlots: rvSlots(state),
      weaponMod: state.weaponMod,
      maxMedkits: maxMedkits(state),
      playerDamage: weaponDamage(state, state.weapon),
      playerRange: weaponRange(state, state.weapon),
      radioAlert: $('#radio-alert').hidden ? null : $('#radio-alert').textContent,
      windowGlow: world.rvGlow.panes[0].material.opacity,
    };
  },
};
