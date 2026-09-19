import './style.css';
import './ui-polish.css';
import './home.css';
import './ui-fx.js';
import * as T from 'three';
import { $, maybe } from './dom.js';
import { cameraFocus, LANE_SPAWNS } from './map.js';
import { addOcclusionSilhouette } from './occlusion.js';
import { createAudio, threatLevel } from './audio.js';
import { createUiStore, installCommands, installStore } from './ui/store.js';
import { mountUi } from './ui/App.js';
import { BuildingViews, type BuildingView } from './building-view.js';
import { makeInterior, interiorBlocked } from './interior.js';
import {
  makeWorld,
  character,
  structure,
  walkable,
  enemyModel,
  enemyMaterials,
  setLogState,
  updateRvGlow,
} from './world.js';
import type { WorldLog } from './world.js';
import { mesh } from './gfx.js';
import { seeded } from './rng.js';
import { createTrauma, createHitStop, hitStopFor, killTraumaFor } from './feel.js';
import { radioAlert, refreshInterior } from './rv.js';
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
  // BLD-04/BLD-05: rotated footprints for placement, collision and the pre-build walk check.
  FOOTPRINTS,
  circleTouchesFootprint,
  footprintsOverlap,
  canReach,
  PERKS,
  attackDamage,
  GATHER,
  collectLog,
  freshLogSwings,
  guidanceStep,
  DAY_LENGTH,
  ENEMY_TYPES,
  WAVES,
  WEAPONS,
  EXPEDITIONS,
  applyArmor,
  DASH,
  FLARE,
  MEDKIT_HEAL,
  REPAIR_WOOD,
  equipWeapon,
  unlockWeapon,
  expedition,
  heal,
  damagePlayer,
  playerDown,
  tickSurvival,
  refundValue,
  upgrade,
  repair,
  wavePlan,
  maxHp,
  useFlare,
  nightWind,
  windDrift,
  windVector,
  siegeGoal,
  rangedGoal,
  revealed,
  rvSlots,
  weaponDamage,
  weaponRange,
  maxMedkits,
  dawnRating,
  BUILDING_STATS,
  towerStats,
  lanternRadius,
  lanternSlow,
  RV_FURNITURE,
  WEAPON_MODS,
  furnitureReason,
  installFurniture,
  uninstallFurniture,
  setWeaponMod,
} from './rules.js';
import type {
  Building,
  BuildingType,
  EnemyId,
  EnemySpec,
  Footprint,
  GameState,
  LogNode,
  PerkId,
  PerkSpec,
  SpawnEntry,
  WeaponId,
} from './rules.js';
import type { Interior } from './interior.js';
import type { CampaignSave } from './save.js';
import type { PinefallRating } from './global.js';

type BasicMaterialMesh = T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>;
type SpitGoal = NonNullable<ReturnType<typeof rangedGoal>>;

interface EnemyRecord {
  mesh: T.Group;
  type: EnemyId;
  alive: boolean;
  hp: number;
  maxHp: number;
  attack: number;
  slow: number;
  slowFactor: number;
  seed: number;
  kx: number;
  kz: number;
  flash: number;
  dying: number;
}

interface BuildingWithRadius extends Building {
  r: number;
}

interface GatherAction {
  log: WorldLog;
  time: number;
  hit: boolean;
}

interface RvTransition {
  elapsed: number;
  switched: boolean;
  center: T.Vector3;
}

interface ShotRecord {
  mesh: BasicMaterialMesh;
  life: number;
}

interface ParticleRecord {
  mesh: T.Mesh;
  life: number;
  vx: number;
  vy: number;
  vz: number;
}

interface MuzzleRecord {
  mesh: BasicMaterialMesh;
  life: number;
}

interface SpitRecord {
  mesh: BasicMaterialMesh;
  life: number;
  total: number;
  kind: string;
  ref: BuildingWithRadius | null;
  damage: number;
  from: T.Vector3;
  to: T.Vector3;
}

// NGT-06 diagnostics: the last spit keeps its pre-wind aim so tests can prove the drift.
interface SpitTrace {
  fromX: number;
  fromZ: number;
  total: number;
  aimX: number;
  aimZ: number;
  x: number;
  z: number;
  driftX: number;
  driftZ: number;
}

interface FlareRecord {
  group: T.Group;
  light: T.PointLight;
  orb: T.Mesh;
  active: boolean;
  life: number;
  x: number;
  z: number;
}

interface DashState {
  time: number;
  dx: number;
  dz: number;
}

interface NightRun {
  startHealth: number;
  clearHealth: number;
  downs: number;
  buildingsLost: number;
  seconds: number;
}

const loading = $('#loading'),
  loadingBar = $('#loading-progress-bar'),
  loadingPercent = $('#loading-percent'),
  loadingMessage = $('#loading-message-text');
let loadingProgress = 0;
function setLoadingProgress(value: number, message: string): void {
  loadingProgress = Math.max(0, Math.min(100, Math.round(value)));
  loadingBar.style.width = `${loadingProgress}%`;
  loadingPercent.textContent = `${loadingProgress}%`;
  loadingMessage.textContent = message;
  loading
    .querySelector('.loading-progress')!
    .setAttribute('aria-valuenow', String(loadingProgress));
}
setLoadingProgress(0, '正在整理资源');
const canvas = $<HTMLCanvasElement>('#world');
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
const state: GameState = newGame();
world.logs.forEach((log, index) => {
  (log as LogNode).id = `log-${index + 1}`;
});
state.logs = world.logs as LogNode[];
let inside = false,
  interior: Interior | null = null,
  rvTransition: RvTransition | null = null;
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
const buildings: BuildingWithRadius[] = [],
  enemies: EnemyRecord[] = [],
  enemyPools: Partial<Record<EnemyId, EnemyRecord[]>> = {},
  shots: ShotRecord[] = [],
  particles: ParticleRecord[] = [],
  keys = new Set<string>();
// Authoritative building data lives in `state.buildings`; buildingViews owns the scene side.
state.buildings = buildings;
const buildingViews = new BuildingViews(scene);
const viewOf = (b: Building): BuildingView => buildingViews.of(b);
const raycaster = new T.Raycaster(),
  pointer = new T.Vector2(),
  cursor = new T.Vector3();
const groundPlane = new T.Plane(new T.Vector3(0, 1, 0), 0),
  v = new T.Vector3();
let selected: BuildingType | null = null,
  ghost: T.Group | null = null,
  ghostOutline: T.LineLoop | null = null,
  ghostAngle = 0,
  validPlacement = false,
  placeReason: string | null = null,
  pointerInside = false,
  // Last client position: showModal fires pointerleave, so hover is re-checked when a dialog closes.
  pointerClient = { x: -1, y: -1 };
// BLD-05 flood-fill cache and epoch: buildings change rarely, ghost cells change per frame.
let navEpoch = 0,
  navCache = { key: '', sealed: false };
let selectedBuilding: BuildingWithRadius | null = null;
// Gathering action and first-day guidance are session-local; nothing here reaches the save.
let collecting: GatherAction | null = null,
  collectCooldown = 0,
  guidanceSkipped = false,
  nightHintShown = false,
  nightPrompted = false;
let daylight = 1,
  time = 0,
  last = performance.now(),
  zoom = 23,
  shotTimer = 0,
  remaining = 0,
  toastTimer: ReturnType<typeof setTimeout> | undefined,
  hurtTimer: ReturnType<typeof setTimeout> | undefined;
let movementTarget: T.Vector3 | null = null,
  photoMode = false,
  homeMode = false,
  nightClock = 0,
  spawnQueue: SpawnEntry[] = [],
  dash: DashState | null = null,
  playerInvuln = 0;
// Test/diagnostic time scale (window.__pinefall.setSpeed). 1 is the shipping game speed.
let simSpeed = 1;
// Per-night telemetry feeds the dawn rating; it never changes combat rules.
let nightRun: NightRun = {
    startHealth: 100,
    clearHealth: 100,
    downs: 0,
    buildingsLost: 0,
    seconds: 0,
  },
  lastRating: PinefallRating | null = null;
let muzzleFlashes = 0,
  hitFlashes = 0,
  deaths = 0,
  knockbacks = 0,
  recoils = 0,
  spitCount = 0;
// NGT-06: tonight's wind is fixed per night; refresh the shared direction when `day` changes.
let windDay = 0;
let lastSpit: SpitTrace | null = null;
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
const uiStore = createUiStore(state);
installStore(uiStore);
function pushAudio(): void {
  uiStore.set({
    audio: {
      enabled: audio.settings.enabled,
      master: audio.settings.master,
      music: audio.settings.music,
      sfx: audio.settings.sfx,
      locked: audio.stats.context === 'locked',
    },
  });
}
const ghostMaterial = new T.MeshBasicMaterial({
  color: '#ead176',
  wireframe: true,
  transparent: true,
  opacity: 0.6,
  depthWrite: false,
});
const sparkMaterial = new T.MeshBasicMaterial({ color: '#ffcf76', transparent: true });
// Wood chips reuse the particle pool; only the material differs from combat sparks.
const woodChipMaterial = new T.MeshBasicMaterial({ color: '#c08d52', transparent: true });
const cube = new T.BoxGeometry(1, 1, 1);
// Fixed-size pools cover this small camp. Increase pool sizes before adding larger maps/waves.
const POOL_SIZE: Record<EnemyId, number> = {
  walker: 40,
  runner: 30,
  brute: 14,
  spitter: 8,
  stalker: 18,
  alpha: 3,
};
for (const [type, count] of Object.entries(POOL_SIZE) as [EnemyId, number][]) {
  const pool: EnemyRecord[] = [];
  for (let i = 0; i < count; i++) {
    const model = enemyModel(type);
    model.scale.setScalar(ENEMY_TYPES[type].scale);
    model.visible = false;
    scene.add(model);
    const record: EnemyRecord = {
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
      flash: 0,
      dying: 0,
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
const muzzles: MuzzleRecord[] = [],
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
const spits: SpitRecord[] = [],
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
  fireflySeeds: { x: number; z: number; y: number; phase: number }[] = [];
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
const smoke: BasicMaterialMesh[] = [];
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
const flarePool: FlareRecord[] = [];
function flareVisual(): FlareRecord {
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
// One reusable pulse ring marks the guidance log; never create per-frame meshes.
const gatherRing = new T.Mesh(
  new T.RingGeometry(0.95, 1.2, 30),
  new T.MeshBasicMaterial({
    color: '#ffe08a',
    transparent: true,
    opacity: 0.6,
    side: T.DoubleSide,
    depthWrite: false,
  }),
);
gatherRing.rotation.x = -Math.PI / 2;
gatherRing.position.y = 0.05;
gatherRing.visible = false;
scene.add(gatherRing);
function refreshSuite(): void {
  refreshInterior(interior, state);
}
setLoadingProgress(46, '环境细节已就绪');
let toastToken = 0;
function toast(text: string): void {
  const token = ++toastToken;
  uiStore.set({ toast: { text, token, visible: true } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (uiStore.getSnapshot().toast.token === token)
      uiStore.set({ toast: { text, token, visible: false } });
  }, 3200);
}
function flashHurt(): void {
  if (motionPreference.matches) return;
  const el = $('#hurt-flash');
  el.classList.add('show');
  clearTimeout(hurtTimer);
  hurtTimer = setTimeout(() => el.classList.remove('show'), 90);
}
function toggleShake(): void {
  shakeEnabled = !shakeEnabled;
  try {
    localStorage.setItem(SHAKE_STORAGE, String(shakeEnabled));
  } catch {
    /* no persistence */
  }
  uiStore.set({ shakeEnabled });
  toast(shakeEnabled ? '镜头震动已开启。' : '镜头震动已关闭。');
}
uiStore.set({ shakeEnabled });
function setEnemyMaterial(enemy: EnemyRecord, material: T.Material): void {
  enemy.mesh.traverse((part) => {
    const meshPart = part as T.Mesh;
    if (meshPart.isMesh && meshPart.material !== enemyMaterials.glow) meshPart.material = material;
  });
}
function syncUI() {
  audio.update(state, inside, threatLevel(enemies, player.position.x, player.position.z));
  uiStore.set({
    state,
    inside,
    selectedBuild: selected,
    selectedBuilding,
    remaining,
    enemiesAlive: enemies.filter((e) => e.alive).length,
    radioAlert: radioAlert(state, spawnQueue, nightClock),
    guidance: { skipped: guidanceSkipped },
  });
}
function pushVitals(): void {
  const max = maxHp(state);
  uiStore.setPlayer({
    hp: Math.max(0, Math.ceil(state.playerHp)),
    maxHp: max,
    stamina: Math.round(state.stamina),
    weaponName: WEAPONS[state.weapon].name,
    medkits: state.medkits,
    maxMedkits: maxMedkits(state),
    flareReady: state.flareCooldown <= 0,
    flareSeconds: Math.ceil(state.flareCooldown),
  });
  const boss = enemies.find((e) => e.alive && e.type === 'alpha');
  uiStore.setBoss(boss ? { hp: boss.hp, maxHp: boss.maxHp } : null);
}
function togglePause(): void {
  if (rvTransition) return;
  actor.send({ type: overlayValue(actor.getSnapshot()) === 'paused' ? 'RESUME' : 'PAUSE' });
  keys.clear();
  movementTarget = null;
}
function openPerks(): void {
  if (!state.perkPending || state.over || $<HTMLDialogElement>('#perk-dialog').open) return;
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
  uiStore.set({
    perk: {
      open: true,
      summary: `第 ${state.day - 1} 夜已守住 · 评分 ${rating.grade}（${rating.score}）· 击退 ${state.kills} · 营地 −${campLost}% · 耗时 ${Math.round(nightRun.seconds)} 秒。选择期间不消耗准备时间。`,
      options: (Object.entries(PERKS) as [PerkId, PerkSpec][])
        .filter(([id]) => !state.perks.includes(id))
        .map(([id, perk]) => ({ id, name: perk.name, text: perk.currentText })),
    },
  });
}
// Player probe radius matches the 0.22 collision circle used by blocked().
const PLAYER_RADIUS = 0.22;
// BLD-05 goal: the camp heart beside the bonfire (the day-1 respawn point is one step south).
// The RV door sits in the same courtyard, so the fire covers both without a second probe.
const CAMP_GOAL = { x: 0.1, z: 4.3 };
const NAV_CELL = 0.5;
function clearGhost(): void {
  if (ghost) scene.remove(ghost);
  ghost = null;
  ghostOutline = null;
  $('#world-label').style.display = 'none';
}
// BLD-04: draw the same rotated footprint the collision/placement math uses, not the model box.
function footprintOutline(fp: Footprint): T.LineLoop {
  const points: T.Vector3[] = [];
  if (fp.kind === 'circle') {
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      points.push(new T.Vector3(Math.cos(a) * fp.r, 0, Math.sin(a) * fp.r));
    }
  } else {
    points.push(
      new T.Vector3(-fp.hx, 0, -fp.hz),
      new T.Vector3(fp.hx, 0, -fp.hz),
      new T.Vector3(fp.hx, 0, fp.hz),
      new T.Vector3(-fp.hx, 0, fp.hz),
    );
  }
  const outline = new T.LineLoop(
    new T.BufferGeometry().setFromPoints(points),
    new T.LineBasicMaterial({
      color: '#efd17c',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
  );
  outline.position.y = 0.01;
  return outline;
}
// T15: a single visibility rule for the ghost preview and its label.
function ghostPermitted(): boolean {
  return (
    !!ghost &&
    state.phase === 'day' &&
    !state.paused &&
    !state.over &&
    !photoMode &&
    !homeMode &&
    !inside &&
    !rvTransition &&
    !dialogOpen() &&
    !(maybe<HTMLDialogElement>('#confirm-dialog')?.open ?? false)
  );
}
function selectBuild(type: BuildingType | null): void {
  if ((inside || rvTransition) && type) return;
  if (selected === type || !type) {
    selected = null;
    clearGhost();
    syncUI();
    return;
  }
  if (!canBuild(state, type)) {
    // T15: a refused selection must not leave the previous ghost behind.
    selected = null;
    clearGhost();
    toast(state.phase === 'night' ? '夜色太深了，等天亮再施工。' : '木材不足，靠近倒木按 E 收集。');
    syncUI();
    return;
  }
  clearGhost();
  selected = type;
  ghost = structure(type);
  ghost.traverse((o) => {
    const meshPart = o as T.Mesh;
    if (meshPart.isMesh) {
      meshPart.material = ghostMaterial;
      meshPart.castShadow = false;
    }
  });
  ghostOutline = footprintOutline(FOOTPRINTS[type]);
  ghost.add(ghostOutline);
  ghost.rotation.y = ghostAngle;
  ghost.visible = false;
  scene.add(ghost);
  syncUI();
}
function rvCollision(x: number, z: number, padding = 0.4): boolean {
  return Math.abs(x + 1) < 4.7 + padding && Math.abs(z + 1.6) < 1.65 + padding;
}
// BLD-04: rotated footprint vs camp obstacles, trees and other buildings. `placeRadius`
// stays as the spacing margin to obstacles/door, but the shape test is no longer a circle.
function footprintFits(x: number, z: number, type: BuildingType): boolean {
  const fp = FOOTPRINTS[type],
    spec = BUILDING_STATS[type],
    margin = Math.max(0, spec.placeRadius - spec.r);
  if (
    !(Math.hypot(x - doorPosition.x, z - doorPosition.z) > spec.placeRadius + 1.3) ||
    !walkable(x, z) ||
    !(Math.hypot(x, z) < 18) ||
    rvCollision(x, z, spec.placeRadius)
  )
    return false;
  if (
    obstacles
      .slice(1)
      .some((o) => circleTouchesFootprint(fp, ghostAngle, x, z, o.x, o.z, o.r + margin)) ||
    world.trees.some((t) => circleTouchesFootprint(fp, ghostAngle, x, z, t.x, t.z, t.r + margin))
  )
    return false;
  return !buildings.some((b) =>
    footprintsOverlap(fp, ghostAngle, x, z, FOOTPRINTS[b.type], b.angle, b.x, b.z),
  );
}
function canPlace(x: number, z: number): boolean {
  return !!selected && footprintFits(x, z, selected);
}
// BLD-05: would this placement cut the player off from the camp heart? Enemies can break
// walls, so only the player path matters. Cached per grid cell/angle/building epoch.
function sealsPlayer(x: number, z: number): boolean {
  if (!selected) return false;
  const key = `${selected}|${x}|${z}|${ghostAngle}|${navEpoch}|${buildings.length}|${Math.round(
    player.position.x / NAV_CELL,
  )}|${Math.round(player.position.z / NAV_CELL)}`;
  if (navCache.key === key) return navCache.sealed;
  const blockers = buildings.map((b) => ({
    fp: FOOTPRINTS[b.type],
    angle: b.angle,
    x: b.x,
    z: b.z,
  }));
  blockers.push({ fp: FOOTPRINTS[selected], angle: ghostAngle, x, z });
  const staticCircles = obstacles.slice(1).concat(world.trees);
  const blockedAt = (px: number, pz: number): boolean => {
    if (!walkable(px, pz) || rvCollision(px, pz, PLAYER_RADIUS)) return true;
    if (staticCircles.some((o) => Math.hypot(px - o.x, pz - o.z) < o.r + PLAYER_RADIUS))
      return true;
    return blockers.some((b) =>
      circleTouchesFootprint(b.fp, b.angle, b.x, b.z, px, pz, PLAYER_RADIUS),
    );
  };
  const margin = 6,
    sealed = !canReach(
      { x: player.position.x, z: player.position.z },
      CAMP_GOAL,
      {
        minX: Math.min(-20, player.position.x - margin),
        maxX: Math.max(20, player.position.x + margin),
        minZ: Math.min(-20, player.position.z - margin),
        maxZ: Math.max(20, player.position.z + margin),
      },
      blockedAt,
      NAV_CELL,
    );
  navCache = { key, sealed };
  return sealed;
}
function updateGhost(): void {
  if (!ghost) return;
  if (!ghostPermitted() || !pointerInside) {
    ghost.visible = false;
    $('#world-label').style.display = 'none';
    placeReason = null;
    return;
  }
  ghost.visible = true;
  const x = Math.round(cursor.x * 2) / 2,
    z = Math.round(cursor.z * 2) / 2;
  ghost.position.set(x, 0.04, z);
  const fits = canPlace(x, z) && canBuild(state, selected!),
    sealed = fits && sealsPlayer(x, z);
  validPlacement = fits && !sealed;
  placeReason = sealed ? '会把自己封死' : fits ? null : '这里无法建造';
  ghostMaterial.color.set(validPlacement ? '#efd17c' : '#cb745c');
  if (ghostOutline)
    (ghostOutline.material as T.LineBasicMaterial).color.set(
      validPlacement ? '#efd17c' : '#cb745c',
    );
  v.set(x, selected === 'tower' ? 5.7 : 2, z).project(camera);
  const label = $('#world-label');
  label.style.display = 'block';
  label.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
  label.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
  label.textContent = validPlacement
    ? `${NAMES[selected!]} · ▰ ${COSTS[selected!]} · 点击建造`
    : placeReason || '这里无法建造';
  label.classList.toggle('invalid', !validPlacement);
}
// World-space guidance/level markers: one reusable ring plus DOM chips projected each frame.
function updateWorldMarkers(): void {
  const guideActive = !guidanceSkipped && state.phase === 'day' && guidanceStep(state) !== 'done';
  const target = collecting?.log ?? (guideActive ? nearestLog(Infinity, true) : null);
  const prompt = maybe<HTMLElement>('#gather-prompt');
  if (target && !photoMode) {
    const pulse = motionPreference.matches ? 0 : Math.sin(time * 4.2) * 0.5 + 0.5;
    gatherRing.visible = true;
    gatherRing.position.set(target.x, 0.05, target.z);
    gatherRing.scale.setScalar(1 + pulse * 0.1);
    (gatherRing.material as T.MeshBasicMaterial).opacity = 0.5 + pulse * 0.4;
    if (prompt) {
      if (!selected) {
        v.set(target.x, 1.05, target.z).project(camera);
        prompt.hidden = false;
        prompt.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
        prompt.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
        prompt.textContent = `E 采集木材 · 剩余 ${Math.max(0, target.remaining)}`;
      } else prompt.hidden = true;
    }
  } else {
    gatherRing.visible = false;
    if (prompt) prompt.hidden = true;
  }
  const dots = maybe<HTMLElement>('#building-level-dots');
  const showDots = !!selectedBuilding && !photoMode && state.phase === 'day';
  if (!dots) return;
  dots.hidden = !showDots;
  if (showDots && selectedBuilding) {
    dots.textContent = '●'.repeat(selectedBuilding.level);
    const y =
      selectedBuilding.type === 'tower' ? 6.7 : selectedBuilding.type === 'lantern' ? 3.4 : 1.7;
    v.set(selectedBuilding.x, y, selectedBuilding.z).project(camera);
    dots.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
    dots.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
  }
}
function burst(
  x: number,
  y: number,
  z: number,
  count = 12,
  material: T.Material = sparkMaterial,
): void {
  let n = 0;
  for (const p of particles)
    if (p.life <= 0) {
      p.life = 0.5 + random() * 0.7;
      p.mesh.visible = true;
      p.mesh.material = material;
      p.mesh.position.set(x, y, z);
      p.mesh.scale.setScalar(0.045 + random() * 0.09);
      p.vx = (random() - 0.5) * 3;
      p.vy = 1 + random() * 3;
      p.vz = (random() - 0.5) * 3;
      if (++n >= count) break;
    }
}
function place(): void {
  if (inside || !selected || !validPlacement || !buy(state, selected)) return;
  const type = selected,
    p = ghost!.position,
    spec = BUILDING_STATS[type];
  // BLD-05: re-check at commit time, not just while hovering.
  if (sealsPlayer(p.x, p.z)) {
    toast('会把自己封死，换个位置。');
    return;
  }
  const building: BuildingWithRadius = {
    id: state.nextBuildId++,
    type,
    x: p.x,
    z: p.z,
    angle: ghostAngle,
    r: spec.r,
    level: 1,
    maxHp: spec.hp,
    hp: spec.hp,
    invested: { wood: COSTS[type], scrap: 0 },
  };
  buildingViews.create(building, 0);
  buildings.push(building);
  navEpoch++;
  burst(p.x, 0.5, p.z, 23);
  audio.effect('build');
  toast(`${NAMES[type]}建造完成 · −${COSTS[type]} 木材`);
  selectBuild(null);
  syncUI();
}
function selectBuilding(b: BuildingWithRadius | null): void {
  selectedBuilding = b && buildings.includes(b) ? b : null;
  selectionRing.visible = !!selectedBuilding;
  if (selectedBuilding) {
    selectionRing.position.set(selectedBuilding.x, 0.045, selectedBuilding.z);
    selectBuild(null);
  }
  syncUI();
}
function buildingAt(object: T.Object3D | null): BuildingWithRadius | null {
  let node: T.Object3D | null = object;
  while (node) {
    if (node.userData?.building) return node.userData.building as BuildingWithRadius;
    node = node.parent;
  }
  return null;
}
function upgradeBuilding(): void {
  const b = selectedBuilding;
  if (!b) return;
  if (!upgrade(state, b)) {
    toast(state.phase === 'night' ? '夜间无法施工。' : '资源不足，无法升级。');
    return;
  }
  buildingViews.refit(b);
  burst(b.x, 1, b.z, 18);
  audio.effect('build');
  toast(`${NAMES[b.type]}升级至 Lv.${b.level}`);
  syncUI();
}
function repairBuilding(): void {
  const b = selectedBuilding;
  if (!b) return;
  if (!repair(state, b)) {
    toast(state.phase === 'night' ? '夜间无法维修。' : '木材不足或结构完好。');
    return;
  }
  burst(b.x, 0.7, b.z, 10);
  audio.effect('build');
  toast(`${NAMES[b.type]}维修完成 · −${REPAIR_WOOD} 木材`);
  syncUI();
}
function dismantleBuilding(): void {
  const b = selectedBuilding;
  if (!b) return;
  if (state.phase !== 'day') {
    toast('夜间无法拆除。');
    return;
  }
  const refund = refundValue(b);
  state.wood += refund.wood;
  state.scrap += refund.scrap;
  buildingViews.detach(b);
  buildings.splice(buildings.indexOf(b), 1);
  navEpoch++;
  burst(b.x, 0.7, b.z, 22);
  audio.effect('destroy');
  toast(`已拆除 ${NAMES[b.type]} · 返还 ▰${refund.wood} ⚙${refund.scrap}`);
  selectBuilding(null);
  syncUI();
}
function updatePointer(event: PointerEvent): void {
  pointerClient.x = event.clientX;
  pointerClient.y = event.clientY;
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
    if (!validPlacement && placeReason === '会把自己封死') {
      toast('会把自己封死，换个位置。');
      return;
    }
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
  .querySelectorAll<HTMLButtonElement>('[data-build]')
  .forEach((button) =>
    button.addEventListener('click', () => selectBuild(button.dataset.build as BuildingType)),
  );
function nearDoor(): boolean {
  return player.position.z > 0.45 && player.position.distanceTo(doorPosition) < 1.65;
}
function enterOrExit(): void {
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
function switchRV(): void {
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
    cancelGather();
    inside = true;
    interior!.scene.add(player);
    player.position.set(1.02, 0.06, 0.85);
    player.rotation.y = Math.PI;
  }
  actor.send({ type: inside ? 'ENTER_RV' : 'EXIT_RV' });
  movementTarget = null;
  keys.clear();
  pointerInside = false;
  $('#app').classList.toggle('inside-rv', inside);
  const doorButton = $('#rv-door');
  if (doorButton) doorButton.hidden = true;
  if (inside) {
    refreshSuite();
    requestAnimationFrame(() => $('#leave-rv')?.focus());
  } else $('#world').focus();
  resize();
  syncUI();
}
function toggleLamp(): void {
  if (!inside || rvTransition || state.paused || state.over || !interior) return;
  const on = interior.toggleLamp();
  uiStore.set({ rvLampOn: on });
  toast(on ? '床头灯亮了。' : '床头灯已关闭，窗光仍照亮过道。');
}
function refreshLogs(): void {
  world.logs.forEach((log) => setLogState(log, log.remaining));
}
function nearestLog(maxDistance: number, onlyWooded = false): WorldLog | null {
  let best: WorldLog | null = null,
    bestDistance = maxDistance;
  for (const log of world.logs) {
    if (onlyWooded && log.remaining <= 0) continue;
    const distance = Math.hypot(player.position.x - log.x, player.position.z - log.z);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = log;
    }
  }
  return best;
}
function dialogOpen(): boolean {
  return (
    $<HTMLDialogElement>('#manual-dialog').open ||
    $<HTMLDialogElement>('#help-dialog').open ||
    $<HTMLDialogElement>('#end-dialog').open ||
    $<HTMLDialogElement>('#perk-dialog').open ||
    $<HTMLDialogElement>('#confirm-dialog').open
  );
}
function restoreGatherPose(): void {
  const body = player.userData.body as T.Group;
  body.rotation.set(0, 0, 0);
  body.position.y = 0;
}
function cancelGather(): void {
  if (!collecting) return;
  collecting = null;
  restoreGatherPose();
}
// FBK-01: the swing settles at hitAt, movement stays locked until the full swing ends.
function updateGather(dt: number): void {
  collectCooldown = Math.max(0, collectCooldown - dt);
  const action = collecting;
  if (!action) return;
  if (state.paused || state.over || document.hidden || dialogOpen()) return;
  action.time += dt;
  if (!action.hit && action.time >= GATHER.hitAt) {
    action.hit = true;
    const amount = collectLog(state, action.log as LogNode);
    setLogState(action.log, action.log.remaining);
    audio.effect('chop');
    burst(action.log.x, 0.55, action.log.z, motionPreference.matches ? 8 : 18, woodChipMaterial);
    if (amount > 0) toast(`收集木材 +${amount}`);
    syncUI();
  }
  const softness = motionPreference.matches ? 0.3 : 1,
    body = player.userData.body as T.Group,
    t = Math.min(1, action.time / GATHER.swing),
    arc = Math.sin(t * Math.PI);
  body.rotation.x = arc * 0.34 * softness;
  body.rotation.y = Math.sin(t * Math.PI * 2) * 0.34 * softness;
  body.rotation.z = Math.sin(t * Math.PI) * 0.16 * softness;
  body.position.y = -arc * 0.09 * softness;
  if (action.time >= GATHER.swing) {
    collecting = null;
    collectCooldown = GATHER.cooldown;
    restoreGatherPose();
  }
}
function collect(): void {
  if (rvTransition || state.paused || state.over) return;
  if (inside || nearDoor()) {
    enterOrExit();
    return;
  }
  if (collecting) return;
  const log = nearestLog(GATHER.reach);
  if (!log) {
    toast('靠近森林边缘的倒木，再按 E 收集。');
    return;
  }
  if (!log.remaining) {
    toast('这段倒木已收集完，明天再来。');
    return;
  }
  if (collectCooldown > 0) {
    toast('稍等一下再砍。');
    return;
  }
  collecting = { log, time: 0, hit: false };
  dash = null;
  movementTarget = null;
}
function beginNight(): void {
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
  if (state.day === 1 && !nightHintShown) {
    nightHintShown = true;
    setTimeout(() => toast('站到北径路口，别让它们靠近营地。'), 3600);
  }
}
function transition(): void {
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
function skipGuidance(): void {
  guidanceSkipped = true;
  syncUI();
}
function togglePhoto(): void {
  photoMode = !photoMode;
  $('#app').classList.toggle('photo-mode', photoMode);
  uiStore.set({ photoMode });
}
function openHelp(): void {
  actor.send({ type: 'OPEN_HELP' });
  keys.clear();
}
function closeHelp(): void {
  actor.send({ type: 'CLOSE_HELP' });
}
function openManual(): void {
  if (inside) {
    toast('先离开房车，再查看营地手册。');
    return;
  }
  if (state.over || rvTransition || overlayValue(actor.getSnapshot()) === 'manual') return;
  actor.send({ type: 'OPEN_MANUAL' });
}
function closeManual(): void {
  actor.send({ type: 'CLOSE_MANUAL' });
}
// NGT-05: the day timer expiring opens the pre-night briefing; N and the HUD button still
// start the night directly. Cancel keeps the flag for the rest of the day so it never re-opens.
function requestNightConfirm(): void {
  if (nightPrompted || inside || rvTransition || state.over || state.perkPending) return;
  const snap = actor.getSnapshot();
  if (phaseValue(snap) !== 'day' || overlayValue(snap) !== 'none') return;
  nightPrompted = true;
  actor.send({ type: 'OPEN_CONFIRM' });
  keys.clear();
  movementTarget = null;
}
function confirmNight(): void {
  if (overlayValue(actor.getSnapshot()) !== 'confirm') return;
  keys.clear();
  movementTarget = null;
  actor.send({ type: 'CONFIRM_NIGHT' });
}
function cancelNight(): void {
  if (overlayValue(actor.getSnapshot()) !== 'confirm') return;
  actor.send({ type: 'CLOSE_CONFIRM' });
  toast('已返回白天 · 准备好后按 N 或「迎接夜晚」直接开战。');
}
function unlockWeaponCommand(id: WeaponId): void {
  if (!unlockWeapon(state, id)) {
    toast('无法更换武器。');
    return;
  }
  audio.effect('build');
  toast(`解锁武器 · ${WEAPONS[id].name}`);
  syncUI();
}
function equipWeaponCommand(id: WeaponId): void {
  if (!equipWeapon(state, id)) {
    toast('无法更换武器。');
    return;
  }
  audio.effect('build');
  toast(`装备武器 · ${WEAPONS[id].name}`);
  syncUI();
}
function runExpeditionCommand(id: string): void {
  const trip = EXPEDITIONS.find((e) => e.id === id);
  if (!trip || !expedition(state, id)) {
    toast('现在无法出发。');
    return;
  }
  audio.effect('collect');
  toast(`远征归来 · ${trip.name}`);
  syncUI();
}
function cycleWeapon(): void {
  if (state.unlocked.length < 2) {
    toast('在营地手册（Tab）的工坊解锁更多武器。');
    return;
  }
  const index = state.unlocked.indexOf(state.weapon);
  equipWeapon(state, state.unlocked[(index + 1) % state.unlocked.length]);
  toast(`切换武器 · ${WEAPONS[state.weapon].name}`);
  syncUI();
}
function tryDash(): void {
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
function tryFlare(): void {
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
function tryHeal(): void {
  if (inside || rvTransition || state.paused || state.over) return;
  if (heal(state)) {
    audio.effect('heal');
    burst(player.position.x, 0.8, player.position.z, 10);
    toast(`医疗包 · 生命 +${MEDKIT_HEAL}`);
    syncUI();
  } else toast(state.medkits < 1 ? '没有医疗包了。' : '生命已满，不必使用医疗包。');
}
function hurtPlayer(amount: number): void {
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
  if (maybe<HTMLDialogElement>('#manual-dialog')?.open) {
    if (key === 'tab') {
      event.preventDefault();
      closeManual();
    }
    return;
  }
  if (
    event.target instanceof HTMLInputElement ||
    maybe<HTMLDialogElement>('#help-dialog')?.open ||
    maybe<HTMLDialogElement>('#end-dialog')?.open ||
    maybe<HTMLDialogElement>('#confirm-dialog')?.open ||
    maybe<HTMLDialogElement>('#perk-dialog')?.open
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
    selectBuild((['fence', 'tower', 'lantern'] as const)[Number(key) - 1]);
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
function blocked(x: number, z: number): boolean {
  if (inside) return interiorBlocked(x, z);
  if (
    !walkable(x, z) ||
    rvCollision(x, z) ||
    overlaps(x, z, obstacles.slice(1), 0.23) ||
    overlaps(x, z, world.trees, 0.22)
  )
    return true;
  // BLD-04: the player collides with the same rotated footprint the preview shows.
  return buildings.some((b) =>
    circleTouchesFootprint(FOOTPRINTS[b.type], b.angle, b.x, b.z, x, z, PLAYER_RADIUS),
  );
}
function movePlayer(dt: number): void {
  if (collecting) {
    dash = null;
    movementTarget = null;
    player.userData.legs.forEach((leg: T.Object3D) => (leg.rotation.x = 0));
    marker.position.x = player.position.x;
    marker.position.z = player.position.z;
    return;
  }
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
    dx = dash!.dx;
    dz = dash!.dz;
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
    dash!.time -= dt;
    if (dash!.time <= 0) dash = null;
  }
  player.userData.body.position.y = moving
    ? Math.abs(Math.sin(time * 13)) * 0.06
    : Math.sin(time * 2) * 0.014;
  player.userData.legs.forEach(
    (leg: T.Object3D, i: number) =>
      (leg.rotation.x = moving ? Math.sin(time * 13 + i * Math.PI) * 0.6 : 0),
  );
  marker.position.x = player.position.x;
  marker.position.z = player.position.z;
}
function spawn(entry: SpawnEntry): boolean {
  const record = enemyPools[entry.type]!.find((e) => !e.alive);
  if (!record) return false;
  const def = ENEMY_TYPES[entry.type],
    [x, z] = LANE_SPAWNS[entry.lane] || LANE_SPAWNS[0];
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
function tracer(from: T.Vector3, target: EnemyRecord, color = '#ffe6a1'): void {
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
function spawnMuzzle(x: number, y: number, z: number, dx: number, dz: number): void {
  const flash = muzzles.find((f) => f.life <= 0);
  if (!flash) return;
  const m = flash.mesh;
  m.position.set(x, y, z);
  m.quaternion.setFromUnitVectors(T.Object3D.DEFAULT_UP, v.set(dx, 0.05, dz).normalize());
  m.scale.set(0.15 + random() * 0.06, 0.22 + random() * 0.12, 0.15 + random() * 0.06);
  m.visible = true;
  flash.life = 0.055;
}
function damageBuilding(b: BuildingWithRadius, amount: number): boolean {
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
  buildingViews.detach(b);
  buildings.splice(buildings.indexOf(b), 1);
  navEpoch++;
  if (selectedBuilding === b) selectBuilding(null);
  toast(`${NAMES[b.type]}被摧毁了。`);
  return true;
}
// Reveal rule for stalkers: lamps, flares and close range cut through fog.
function enemyVisible(e: EnemyRecord): boolean {
  if (!ENEMY_TYPES[e.type].stealth) return true;
  const p = e.mesh.position;
  const lanterns = buildings
    .filter((b) => b.type === 'lantern')
    .map((b) => ({ x: b.x, z: b.z, radius: lanternRadius(b.level) }));
  const flares = flarePool.map((f) => ({ active: f.active, x: f.x, z: f.z, radius: FLARE.radius }));
  return revealed(p.x, p.z, player.position.x, player.position.z, lanterns, flares, currentFog());
}
const currentFog = (): number => WAVES[state.day - 1]?.fog || 0;
function fireSpit(enemy: EnemyRecord, goal: SpitGoal, def: EnemySpec): void {
  const spit = spits.find((s) => s.life <= 0);
  if (!spit) return;
  const p = enemy.mesh.position;
  const aimX = goal.kind === 'building' ? goal.building.x : player.position.x,
    aimZ = goal.kind === 'building' ? goal.building.z : player.position.z;
  // NGT-06: only the horizontal impact point moves; damage and flight speed are unchanged.
  // The arc interpolation below runs straight to the drifted `to`, so what the player sees is
  // exactly where the glob lands, and standing still under a crosswind can mean a miss.
  const flight = Math.hypot(aimX - p.x, aimZ - p.z) / 9;
  const wind = nightWind(state.day);
  const drift = windDrift(wind, aimX - p.x, aimZ - p.z, flight);
  spit.from.set(p.x, 0.95, p.z);
  spit.to.set(aimX + drift.x, 0.8, aimZ + drift.z);
  spit.total = Math.max(0.28, spit.from.distanceTo(spit.to) / 9);
  spit.life = spit.total;
  spit.kind = goal.kind;
  spit.ref = goal.kind === 'building' ? (goal.building as BuildingWithRadius) : null;
  spit.damage = def.damage;
  spit.mesh.position.copy(spit.from);
  spit.mesh.visible = true;
  spitCount++;
  lastSpit = {
    fromX: spit.from.x,
    fromZ: spit.from.z,
    total: spit.total,
    aimX,
    aimZ,
    x: spit.to.x,
    z: spit.to.z,
    driftX: drift.x,
    driftZ: drift.z,
  };
}
function applySpitHit(spit: SpitRecord): void {
  burst(spit.mesh.position.x, spit.mesh.position.y, spit.mesh.position.z, 4);
  if (spit.kind === 'building') {
    const target = spit.ref;
    // NGT-06: the drifted landing point decides the hit, so a strong crosswind can graze past.
    if (
      target &&
      buildings.includes(target) &&
      circleTouchesFootprint(
        FOOTPRINTS[target.type],
        target.angle,
        target.x,
        target.z,
        spit.to.x,
        spit.to.z,
        0.35,
      )
    )
      damageBuilding(target, spit.damage + 3);
    return;
  }
  if (Math.hypot(player.position.x - spit.to.x, player.position.z - spit.to.z) < 1.3)
    hurtPlayer(spit.damage);
}
function damageEnemy(enemy: EnemyRecord, damage: number, fromX: number, fromZ: number): void {
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
function updateEnemyEffects(dt: number): void {
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
function inRange(x: number, z: number, range: number, count: number): EnemyRecord[] {
  const list: { e: EnemyRecord; d: number }[] = [];
  for (const e of enemies)
    if (e.alive && enemyVisible(e)) {
      const d = Math.hypot(e.mesh.position.x - x, e.mesh.position.z - z);
      if (d <= range) list.push({ e, d });
    }
  list.sort((a, b) => a.d - b.d);
  return list.slice(0, count).map((t) => t.e);
}
function towerFire(b: Building, target: EnemyRecord): void {
  const stats = towerStats(b.level);
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
function playerAttack(dt: number): void {
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
function combat(dt: number): void {
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
      const enemy = inRange(b.x, b.z, towerStats(b.level).range, 1)[0];
      if (enemy) {
        towerFire(b, enemy);
        view.cooldown = towerStats(b.level).cooldown;
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
        if (b.type === 'lantern' && Math.hypot(b.x - p.x, b.z - p.z) < lanternRadius(b.level))
          speed *= lanternSlow(b.level);
      for (const flare of flarePool)
        if (flare.active && Math.hypot(flare.x - p.x, flare.z - p.z) < FLARE.radius) {
          e.slow = 0.25;
          e.slowFactor = e.type === 'alpha' ? FLARE.bossSlow : FLARE.slow;
        }
      if (e.slow > 0) speed *= e.slowFactor;
      e.slow = Math.max(0, e.slow - dt);
      e.attack -= dt;
      // BLD-04: enemies reach the rotated wall shape, not a circle around its center.
      const barrier = buildings.find((b) =>
        circleTouchesFootprint(FOOTPRINTS[b.type], b.angle, b.x, b.z, p.x, p.z, 0.65),
      );
      const playerNear = Math.hypot(p.x - player.position.x, p.z - player.position.z) < 1.1;
      const ranged =
        def.ranged && e.attack <= 0
          ? rangedGoal(p.x, p.z, player.position.x, player.position.z, buildings, def.range!)
          : null;
      if (ranged) {
        e.attack = def.attackRate;
        fireSpit(e, ranged, def);
        e.mesh.rotation.y = Math.atan2(
          (ranged.kind === 'building' ? ranged.building.x : player.position.x) - p.x,
          (ranged.kind === 'building' ? ranged.building.z : player.position.z) - p.z,
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
        (leg: T.Object3D, i: number) =>
          (leg.rotation.x = Math.sin(time * 7 + e.seed + i * Math.PI) * 0.4),
      );
    }
  if (!remaining && !spawnQueue.length && !enemies.some((e) => e.alive) && state.elapsed > 5)
    transition();
}
function endGame(): void {
  if (uiStore.getSnapshot().end.open) return;
  audio.update(state, inside);
  audio.effect(state.won ? 'victory' : 'defeat');
  keys.clear();
  movementTarget = null;
  selectBuild(null);
  selectBuilding(null);
  uiStore.set({
    end: {
      open: true,
      won: state.won,
      eyebrow: state.won ? 'FIVE NIGHTS · A LIGHT SURVIVES' : 'THE FIRE WILL BURN AGAIN',
      title: state.won ? '天亮了，我们守住了。' : '余烬尚未冷却。',
      text: state.won
        ? `五个夜晚全部守住，累计击退 ${state.kills} 位来袭者。营地耐久 ${Math.ceil(state.health)}%，剩余木材 ${state.wood}。救援终于抵达松林。`
        : `你守住了 ${state.day - 1} 个夜晚，击退 ${state.kills} 位不速之客。带上经验，再点燃一次营火吧。`,
    },
  });
}
let audioErrorShown = false;
async function unlockAudio(): Promise<void> {
  try {
    await audio.unlock();
  } catch {
    if (!audioErrorShown) toast('声音未能开启，请点击 ♫ 重试或检查浏览器声音权限。');
    audioErrorShown = true;
  }
  pushAudio();
}
// Browsers require a user gesture. Do not force autoplay or override saved mute.
for (const eventName of ['pointerdown', 'keydown'] as const)
  addEventListener(
    eventName,
    (event) => {
      if (
        (event.target as Element).closest?.('#sound') ||
        (eventName === 'keydown' && (event as KeyboardEvent).repeat)
      )
        return;
      if (audio.settings.enabled && ['locked', 'suspended'].includes(audio.stats.context))
        void unlockAudio();
    },
    { capture: true },
  );
function toggleSound(): void {
  audio.configure('enabled', audio.stats.context === 'locked' ? true : !audio.settings.enabled);
  if (audio.settings.enabled) void unlockAudio();
  pushAudio();
}
function setAudio(key: 'master' | 'music' | 'sfx', value: number): void {
  audio.configure(key, value);
  pushAudio();
}
pushAudio();
const daySun = new T.Color('#fff0ce'),
  nightSun = new T.Color('#92b9dc');
const daySky = new T.Color('#d4e2e2'),
  nightSky = new T.Color('#7593b6');
function ambience(dt: number): void {
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
  updateRvGlow(world.rvGlow, state.rv, daylight, interior ? interior.lampOn : true, ambientTime);
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
  // NGT-06: reuse the ENV-01 wind channel for gameplay direction; one refresh per campaign day.
  if (windDay !== state.day) {
    windDay = state.day;
    const v = windVector(nightWind(state.day));
    world.wind.dir.x = v.x;
    world.wind.dir.z = v.z;
  }
  const windX = world.wind.dir.x,
    windZ = world.wind.dir.z;
  world.waterMat.uniforms.time.value = t;
  world.waterMat.uniforms.day.value = daylight;
  world.fireLight.intensity =
    (28 + (1 - daylight) * 32) * (1 + breath * 0.08 + Math.sin(t * 8.3) * 0.035 * motion);
  world.halo.material.opacity = (0.24 + (1 - daylight) * 0.63) * (1 + breath * 0.08);
  world.halo.scale.setScalar(6 + breath * 0.3);
  world.flames.children.forEach((flame, i) => {
    flame.scale.y = 0.65 + Math.sin(t * 6 + i * 2.1) * 0.23 * motion;
    // NGT-06: campfire flames lean along tonight's wind instead of standing perfectly upright.
    const lean = flame.scale.y * 0.6;
    flame.position.x = (flame.userData.baseX as number) + windX * lean;
    flame.position.z = (flame.userData.baseZ as number) + windZ * lean;
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
      // NGT-06: the flare flame and its light bend downwind, matching the campfire smoke.
      flare.orb.position.set(windX * 1.1, 0.6, windZ * 1.1);
      flare.light.position.set(windX * 1.8, 1.2, windZ * 1.8);
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
    // NGT-06: campfire smoke trails along tonight's wind; strong nights visibly press it downwind.
    const spread = age * 1.7;
    m.position.set(
      world.fireAt.x + windX * spread + Math.sin(t * 0.85 + age * 2) * age * 0.5,
      1.1 + age * 4,
      world.fireAt.z + windZ * spread + Math.sin(t * 0.68) * age * 0.35,
    );
    m.scale.setScalar(0.13 + age * 0.45);
    m.rotation.y = i + t * 0.1;
    m.material.opacity = Math.sin(age * Math.PI) * 0.09 * motion;
  });
  if (motion && random() < dt * 20) burst(0.1, 0.5, 5.6, 1);
  buildingViews.animate(dt, time, daylight, fog);
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
function resize(): void {
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
function updateTitleCamera(dt: number): void {
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
      interior!.camera.zoom = 1 + ease * 0.12;
      interior!.camera.updateProjectionMatrix();
    } else {
      camera.zoom = 1 + ease * 0.55;
      camera.updateProjectionMatrix();
      v.copy(rvTransition.center).lerp(doorPosition, ease * 0.65);
      camera.position.set(v.x + 2, 46, v.z + 37);
      camera.lookAt(v.x, 0, v.z - 0.3);
    }
    renderer.render(inside ? interior!.scene : scene, inside ? interior!.camera : camera);
    if (p === 1) {
      camera.zoom = 1;
      camera.updateProjectionMatrix();
      interior!.camera.zoom = 1;
      interior!.camera.updateProjectionMatrix();
      $('#rv-fade').hidden = true;
      rvTransition = null;
      keys.clear();
    }
    return;
  }
  if (!state.paused && !state.over && !document.hidden) {
    // Time-scaled simulation runs in sub-steps so each slice stays within the 0.05s frame clamp.
    const simDt = dt * simSpeed;
    const steps = Math.max(1, Math.ceil(simDt / 0.05));
    const step = simDt / steps;
    for (let i = 0; i < steps; i++) {
      time += step;
      if (inside) movePlayer(step);
      else {
        state.elapsed += step;
        tickSurvival(state, step);
        ambience(step);
        movePlayer(step);
        updateGather(step);
        combat(step);
        updateEnemyEffects(step);
        if (
          phaseValue(actor.getSnapshot()) === 'day' &&
          state.elapsed > DAY_LENGTH &&
          !nightPrompted
        )
          requestNightConfirm();
      }
      playerInvuln = Math.max(0, playerInvuln - step);
      if (state.paused || state.over || document.hidden) break;
    }
    uiTimer += dt;
    if (uiTimer > 0.5) {
      syncUI();
      uiTimer = 0;
    }
  } else playerInvuln = Math.max(0, playerInvuln - dt);
  player.userData.body.visible = playerInvuln <= 0 || Math.floor(time * 14) % 2 === 0;
  pushVitals();
  if (inside) {
    renderer.render(interior!.scene, interior!.camera);
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
  updateWorldMarkers();
  // T15: run every frame while a ghost exists so phase/pause/modal changes hide it immediately.
  if (ghost) {
    if (pointerInside) {
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(groundPlane, cursor);
    }
    updateGhost();
  }
  const doorButton = maybe<HTMLButtonElement>('#rv-door');
  if (doorButton) {
    doorButton.hidden = photoMode || !nearDoor() || state.paused || state.over;
    if (!doorButton.hidden) {
      v.copy(doorPosition).setY(1.5).project(camera);
      doorButton.style.left = `${((v.x + 1) * innerWidth) / 2}px`;
      doorButton.style.top = `${((1 - v.y) * innerHeight) / 2}px`;
      doorButton.textContent = state.phase === 'day' ? 'E · 进入房车' : '夜间守营 · 天亮后进入';
    }
  }
  renderer.render(scene, camera);
});
// ——— Campaign state machine (ARC-02): phase and pause flags are machine-owned ———
const actor = startCampaign({
  state,
  canClear: () => remaining === 0 && !spawnQueue.length && !enemies.some((e) => e.alive),
  canEnterRV: () => nearDoor(),
  onNightStart: () => {
    nightPrompted = false;
    beginNight();
    audio.update(state, inside);
    audio.effect('night');
    selectBuild(null);
    selectBuilding(null);
  },
  onDawn: () => {
    nightPrompted = false;
    world.logs.forEach((l) => (l.remaining = freshLogSwings()));
    refreshLogs();
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
    uiStore.set({ perk: { open: false, summary: '', options: [] } });
    const saved = writeSave(state);
    toast(saved.ok ? `获得专长：${PERKS[id].name}` : `获得专长：${PERKS[id].name} · 存档写入失败`);
    $('#world').focus();
  },
});
let overlayBefore = 'none';
actor.subscribe(() => {
  syncUI();
  // showModal makes the canvas inert and fires pointerleave; restore the hover preview once
  // the closing dialog is gone from the DOM (React removes it after this subscription runs).
  const overlay = overlayValue(actor.getSnapshot());
  if (overlay === 'none' && overlayBefore !== 'none') {
    const restore = (): void => {
      if (!pointerInside && document.elementFromPoint(pointerClient.x, pointerClient.y) === canvas)
        pointerInside = true;
    };
    requestAnimationFrame(() => {
      restore();
      if (!pointerInside) setTimeout(restore, 90);
    });
  }
  overlayBefore = overlay;
});
mountUi(actor);
installCommands({
  selectBuild,
  selectBuilding,
  closeBuildingPanel: () => selectBuilding(null),
  upgradeBuilding,
  repairBuilding,
  dismantleBuilding,
  openManual,
  closeManual,
  unlockWeapon: unlockWeaponCommand,
  equipWeapon: equipWeaponCommand,
  runExpedition: runExpeditionCommand,
  choosePerk: (id) => actor.send({ type: 'CHOOSE_PERK', perkId: id }),
  nextPhase: transition,
  skipGuidance,
  togglePause,
  openHelp,
  closeHelp,
  openNightConfirm: requestNightConfirm,
  confirmNight,
  cancelNight,
  restart: () => location.reload(),
  togglePhoto,
  toggleShake,
  toggleSound,
  setAudio,
  enterRv: enterOrExit,
  leaveRv: enterOrExit,
  rvBuild: (id) => {
    if (!installFurniture(state, id)) {
      toast(`无法安装 · ${furnitureReason(state, id) || '未知原因'}`);
      return;
    }
    audio.effect('build');
    toast(`已安装 ${RV_FURNITURE[id].name}`);
    refreshSuite();
    syncUI();
  },
  rvDrop: (id) => {
    if (!uninstallFurniture(state, id)) {
      toast('只能在白天拆除家具。');
      return;
    }
    const furniture = RV_FURNITURE[id];
    audio.effect('destroy');
    toast(
      `已拆除 ${furniture.name} · 返还 ▰${Math.floor(furniture.wood * 0.6)}${furniture.scrap ? ` ⚙${Math.floor(furniture.scrap * 0.6)}` : ''}`,
    );
    refreshSuite();
    syncUI();
  },
  rvMod: (id) => {
    if (!setWeaponMod(state, state.weaponMod === id ? null : id)) {
      toast('需要先安装便携工作台。');
      return;
    }
    toast(state.weaponMod ? `今晚改装 · ${WEAPON_MODS[state.weaponMod].name}` : '已取消改装');
    syncUI();
  },
  toggleLamp,
});

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
function clearSession(): void {
  nightPrompted = false;
  selectBuild(null);
  selectBuilding(null);
  navEpoch++;
  navCache = { key: '', sealed: false };
  cancelGather();
  collectCooldown = 0;
  keys.clear();
  movementTarget = null;
  shotTimer = 0;
  nightClock = 0;
  spawnQueue = [];
  remaining = 0;
}
function startNewCampaign(): void {
  resetCampaign(state);
  state.logs.forEach((log) => {
    log.remaining = freshLogSwings();
  });
  refreshLogs();
  guidanceSkipped = false;
  nightHintShown = false;
  buildingViews.rebuildAll(buildings);
  clearSession();
  enterGame();
  const saved = writeSave(state);
  toast(saved.ok ? '新的营地记录已建立。' : '无法写入存档，本局仍可正常游玩。');
}
function continueCampaign(save: CampaignSave): void {
  applySave(state, save);
  refreshLogs();
  buildingViews.rebuildAll(buildings);
  clearSession();
  enterGame();
  toast(`继续第 ${state.day} 天 · 营地 ${Math.ceil(state.health)}%`);
}
function enterGame(): void {
  homeMode = false;
  home.hide();
  $('#app').classList.remove('home-mode');
  resize();
  $('#world').focus();
  syncUI();
}
function enterHome(): void {
  homeMode = true;
  $('#app').classList.add('home-mode');
  clearSession();
  gatherRing.visible = false;
  const prompt = maybe<HTMLElement>('#gather-prompt');
  if (prompt) prompt.hidden = true;
  const dots = maybe<HTMLElement>('#building-level-dots');
  if (dots) dots.hidden = true;
  const loaded = readSave();
  home.show({
    save: loaded.ok ? saveSummary(loaded.save) : null,
    broken: !loaded.ok && loaded.reason !== 'missing' && loaded.reason !== 'storage',
  });
  pointerInside = false;
  syncUI();
}

async function boot(): Promise<void> {
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
// Dev-only balance panel; the guarded dynamic import is removed from production builds.
if (import.meta.env.DEV) void import('./dev-tune.js').then((mod) => mod.mountDevTuner());
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
  setSpeed: (multiplier: number) => {
    simSpeed = T.MathUtils.clamp(multiplier, 0.1, 20);
    return simSpeed;
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
      manualOpen: maybe<HTMLDialogElement>('#manual-dialog')?.open ?? false,
      overlay: overlayValue(actor.getSnapshot()),
      viewZoom: inside ? interior!.camera.zoom : camera.zoom,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      enemies: enemies.filter((e) => e.alive).length,
      remaining,
      ambientTime,
      windStrength: world.wind.strength.value,
      windDir: nightWind(state.day).dir,
      windTier: nightWind(state.day).tier,
      windX: world.wind.dir.x,
      windZ: world.wind.dir.z,
      lastSpit,
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
        .reduce<Partial<Record<EnemyId, number>>>(
          (counts, e) => ((counts[e.type] = (counts[e.type] || 0) + 1), counts),
          {},
        ),
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
          siegeGoal(e.mesh.position.x, e.mesh.position.z, buildings, ENEMY_TYPES[e.type].siege!),
      ).length,
      rating: lastRating ? { ...lastRating } : null,
      rv: [...state.rv],
      rvSlots: rvSlots(state),
      weaponMod: state.weaponMod,
      maxMedkits: maxMedkits(state),
      playerDamage: weaponDamage(state, state.weapon),
      playerRange: weaponRange(state, state.weapon),
      radioAlert: uiStore.getSnapshot().radioAlert,
      windowGlow: world.rvGlow.panes[0].material.opacity,
      guidance: guidanceStep(state),
      collecting: collecting !== null,
      collectCooldown,
      logsRemaining: world.logs.reduce((n, l) => n + l.remaining, 0),
      levelDots: selectedBuilding ? selectedBuilding.level : 0,
      ghost: ghost
        ? {
            visible: ghost.visible,
            outline: !!ghostOutline,
            x: ghost.position.x,
            z: ghost.position.z,
            valid: validPlacement,
            reason: placeReason,
            angle: ghostAngle,
          }
        : null,
      nightPrompted,
    };
  },
};
