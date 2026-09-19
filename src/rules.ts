// Campaign tuning is kept here so economy and encounter rules can run without WebGL.
export type Phase = 'day' | 'night' | 'interior' | 'victory' | 'defeat';
export type BuildingType = 'fence' | 'tower' | 'lantern';
export type WeaponId = 'carbine' | 'shotgun' | 'rifle';
export type PerkId = 'marksman' | 'engineer' | 'scavenger' | 'survivor';
export type FurnitureId = 'workbench' | 'radio' | 'medcab' | 'plant' | 'quilt' | 'photos';
export type WeaponModId = 'power' | 'range';
export type EnemyId = 'walker' | 'runner' | 'brute' | 'spitter' | 'stalker' | 'alpha';
export type FurnitureKind = 'function' | 'decor';

export interface Building {
  id: number;
  type: BuildingType;
  x: number;
  z: number;
  angle: number;
  level: number;
  hp: number;
  maxHp: number;
  invested: { wood: number; scrap: number };
}

export interface LogNode {
  id: string;
  x: number;
  z: number;
  remaining: number;
}

export interface GameState {
  day: number;
  phase: Phase;
  elapsed: number;
  wood: number;
  scrap: number;
  health: number;
  playerHp: number;
  stamina: number;
  staminaDelay: number;
  medkits: number;
  kills: number;
  paused: boolean;
  manualPause: boolean;
  over: boolean;
  won: boolean;
  weapon: WeaponId;
  unlocked: WeaponId[];
  perks: PerkId[];
  perkPending: boolean;
  expeditionDay: number;
  flareCooldown: number;
  rv: FurnitureId[];
  weaponMod: WeaponModId | null;
  buildings: Building[];
  logs: LogNode[];
  nextBuildId: number;
}

export interface EnemySpec {
  name: string;
  note: string;
  hp: number;
  speed: number;
  damage: number;
  scale: number;
  bounty: number;
  armor: number;
  attackRate: number;
  wallDamage: number;
  siege?: number;
  range?: number;
  ranged?: boolean;
  stealth?: boolean;
}

export interface WeaponSpec {
  name: string;
  range: number;
  damage: number;
  interval: number;
  armorPen: number;
  targets: number;
  color: string;
  text: string;
}

export interface PerkSpec {
  name: string;
  damageMultiplier?: number;
  logBonus?: number;
  currentText: string;
  text: string;
}

export interface FurnitureSpec {
  name: string;
  kind: FurnitureKind;
  tag: string;
  wood: number;
  scrap: number;
  text: string;
}

export interface WaveGroup {
  type: EnemyId;
  count: number;
  lane: number;
  spacing: number;
  intent: string;
}

export interface Wave {
  name: string;
  lesson: string;
  hint: string;
  advice: string;
  fog?: number;
  groups: [EnemyId, number, number, number, string][];
}

export interface Expedition {
  id: string;
  name: string;
  tag: string;
  time: number;
  text: string;
  wood?: number;
  scrap?: number;
  medkits?: number;
  injury: number;
}

export interface SpawnEntry {
  type: EnemyId;
  lane: number;
  at: number;
}
export interface TimelineRow {
  type: EnemyId;
  lane: number;
  at: number;
  end: number;
  count: number;
}
export interface RatingInput {
  campLost?: number;
  downs?: number;
  buildingsLost?: number;
  nightSeconds?: number;
}

export const COSTS: Record<BuildingType, number> = { fence: 15, tower: 35, lantern: 10 };
export const NAMES: Record<BuildingType, string> = {
  fence: '木栅栏',
  tower: '瞭望塔',
  lantern: '营地灯',
};
export const DAY_LENGTH = 150;
export const LANES = ['北径', '西径', '东岸'];
export const ARMOR_CAP = 0.7;
export const DASH = {
  cost: 30,
  speed: 15,
  duration: 0.22,
  invulnerable: 0.42,
  regen: 22,
  delay: 0.5,
};
// FIX-01 余火守望: 50% faster stamina regen and a 40% shorter post-dash delay.
export const SURVIVOR_STAMINA = { regen: DASH.regen * 1.5, delay: DASH.delay * 0.6 };
export const staminaRegen = (s: GameState): number =>
  s.perks.includes('survivor') ? SURVIVOR_STAMINA.regen : DASH.regen;
export const staminaDelay = (s: GameState): number =>
  s.perks.includes('survivor') ? SURVIVOR_STAMINA.delay : DASH.delay;
export const FLARE = { radius: 5, duration: 5, cooldown: 25, slow: 0.38, bossSlow: 0.78 };
export const MEDKIT_HEAL = 60;
export const MEDKIT_BASE = 2;
export const MEDKIT_CAP = 3;
export const MAX_LEVEL = 3;
export const GATHER = { reach: 3, swing: 0.45, hitAt: 0.28, cooldown: 0.35, perSwing: 10 };
// ECO-01: a fallen log offers LOG_SWINGS swings (3 x 10 wood) before it is spent.
export const LOG_SWINGS = 3;
export const freshLogSwings = (): number => LOG_SWINGS;
// ECO-01 "cannot have everything": 25 wood cannot buy a tower (35) at spawn.
export const START_SUPPLIES = { wood: 25, scrap: 6 };
// Dawn convoy base income; the scavenger perk adds its own bonus on top.
export const DAWN_SUPPLIES = { wood: 25, scrap: 5, scavengerWood: 10, scavengerScrap: 3 };
// RV layout: function slots open across days 1/2/3; decoration is available from the start.
export const RV = { functionSlots: 3, decorSlots: 3, slotDays: [1, 2, 3] };
export const RV_FURNITURE: Record<FurnitureId, FurnitureSpec> = {
  workbench: {
    name: '便携工作台',
    kind: 'function',
    tag: '工坊',
    wood: 25,
    scrap: 4,
    text: '解锁与更换武器的前置；每晚可为当前武器选一项改装，黎明重置。',
  },
  radio: {
    name: '短波电台',
    kind: 'function',
    tag: '情报',
    wood: 10,
    scrap: 6,
    text: '情报页增加今晚生成时间轴；夜战 HUD 提示下一路的来敌与倒计时。',
  },
  medcab: {
    name: '医疗柜',
    kind: 'function',
    tag: '医疗',
    wood: 15,
    scrap: 3,
    text: '医疗包上限 +1（最多 3），安装时补 1；每个黎明免费补 1。',
  },
  plant: {
    name: '窗台绿植',
    kind: 'decor',
    tag: '装饰',
    wood: 10,
    scrap: 0,
    text: '厨房台面多一盆松苗，夜里在窗外投出暖绿剪影。',
  },
  quilt: {
    name: '拼布暖毯',
    kind: 'decor',
    tag: '装饰',
    wood: 10,
    scrap: 0,
    text: '床尾多一条拼布毯，窗内暖色更厚。',
  },
  photos: {
    name: '旅途照片绳',
    kind: 'decor',
    tag: '装饰',
    wood: 15,
    scrap: 0,
    text: '北墙挂起远征照片，夜里从窗内能看到暖点。',
  },
};
export const WEAPON_MODS: Record<
  WeaponModId,
  { name: string; damage: number; range: number; text: string }
> = {
  power: { name: '加压弹', damage: 1, range: 0, text: '当前武器伤害 +1' },
  range: { name: '加长枪管', damage: 0, range: 1, text: '当前武器射程 +1' },
};
export const UPGRADE = { wood: 20, scrap: 4 };
export const REPAIR_WOOD = 10;
export const DISMANTLE_REFUND = 0.6;
// Footprint (collision/attack), placement spacing and base durability per building.
export interface BuildingSpec {
  r: number;
  placeRadius: number;
  hp: number;
}
export const BUILDING_STATS: Record<BuildingType, BuildingSpec> = {
  fence: { r: 1, placeRadius: 1.25, hp: 150 },
  tower: { r: 1.2, placeRadius: 1.5, hp: 220 },
  lantern: { r: 0.35, placeRadius: 0.4, hp: 220 },
};
// BLD-04: blocking footprint in local space, rotated by the building's `angle`. Placement
// preview, player collision, enemy wall attacks and build spacing all share these shapes.
export type Footprint = { kind: 'box'; hx: number; hz: number } | { kind: 'circle'; r: number };
export const FOOTPRINTS: Record<BuildingType, Footprint> = {
  // Fence rails span 3.25 with posts to ±1.32; the rails stick out to z ≈ -0.27.
  fence: { kind: 'box', hx: 1.7, hz: 0.2 },
  // Tower base corner posts reach x ±1.25 and z ±1.15 (stairs excluded on purpose).
  tower: { kind: 'box', hx: 1.25, hz: 1.15 },
  lantern: { kind: 'circle', r: 0.4 },
};
// Matches Three.js `rotation.y`: world (x, z) = (c*lx + s*lz, -s*lx + c*lz); this is the inverse.
export function localFromWorld(angle: number, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return { x: c * x - s * z, z: s * x + c * z };
}
export function pointInFootprint(
  fp: Footprint,
  angle: number,
  x: number,
  z: number,
  px: number,
  pz: number,
): boolean {
  const l = localFromWorld(angle, px - x, pz - z);
  return fp.kind === 'circle'
    ? l.x * l.x + l.z * l.z <= fp.r * fp.r
    : Math.abs(l.x) <= fp.hx && Math.abs(l.z) <= fp.hz;
}
// Nearest distance from a point to the footprint surface; 0 while inside.
export function distanceToFootprint(
  fp: Footprint,
  angle: number,
  x: number,
  z: number,
  px: number,
  pz: number,
): number {
  const l = localFromWorld(angle, px - x, pz - z);
  if (fp.kind === 'circle') return Math.max(0, Math.hypot(l.x, l.z) - fp.r);
  const dx = Math.max(Math.abs(l.x) - fp.hx, 0),
    dz = Math.max(Math.abs(l.z) - fp.hz, 0);
  return Math.hypot(dx, dz);
}
export function circleTouchesFootprint(
  fp: Footprint,
  angle: number,
  x: number,
  z: number,
  cx: number,
  cz: number,
  radius: number,
): boolean {
  return distanceToFootprint(fp, angle, x, z, cx, cz) < radius;
}
const boxRadiusOnAxis = (hx: number, hz: number, angle: number, ux: number, uz: number): number => {
  const c = Math.cos(angle),
    s = Math.sin(angle);
  return hx * Math.abs(c * ux - s * uz) + hz * Math.abs(s * ux + c * uz);
};
// Separating-axis test for two rotated boxes.
function boxesOverlap(
  a: Extract<Footprint, { kind: 'box' }>,
  angleA: number,
  ax: number,
  az: number,
  b: Extract<Footprint, { kind: 'box' }>,
  angleB: number,
  bx: number,
  bz: number,
): boolean {
  const axes: [number, number][] = [
    [Math.cos(angleA), -Math.sin(angleA)],
    [Math.sin(angleA), Math.cos(angleA)],
    [Math.cos(angleB), -Math.sin(angleB)],
    [Math.sin(angleB), Math.cos(angleB)],
  ];
  const dx = bx - ax,
    dz = bz - az;
  for (const [ux, uz] of axes) {
    const ra = boxRadiusOnAxis(a.hx, a.hz, angleA, ux, uz),
      rb = boxRadiusOnAxis(b.hx, b.hz, angleB, ux, uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}
export function footprintsOverlap(
  a: Footprint,
  angleA: number,
  ax: number,
  az: number,
  b: Footprint,
  angleB: number,
  bx: number,
  bz: number,
): boolean {
  if (a.kind === 'box' && b.kind === 'box')
    return boxesOverlap(a, angleA, ax, az, b, angleB, bx, bz);
  if (a.kind === 'circle' && b.kind === 'circle') return Math.hypot(ax - bx, az - bz) < a.r + b.r;
  if (a.kind === 'circle') return circleTouchesFootprint(b, angleB, bx, bz, ax, az, a.r);
  return circleTouchesFootprint(
    a,
    angleA,
    ax,
    az,
    bx,
    bz,
    (b as Extract<Footprint, { kind: 'circle' }>).r,
  );
}
// BLD-05: coarse flood fill over a 0.5m grid. `blocked` probes one node with the player's
// radius already applied; enemies can break walls, so only the player needs a path.
export interface ReachArea {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}
export function canReach(
  start: { x: number; z: number },
  goal: { x: number; z: number },
  area: ReachArea,
  blocked: (x: number, z: number) => boolean,
  cell = 0.5,
): boolean {
  // floor keeps every node on or inside the area (min + cols*cell <= max).
  const cols = Math.max(1, Math.floor((area.maxX - area.minX) / cell)),
    rows = Math.max(1, Math.floor((area.maxZ - area.minZ) / cell));
  const nodeAt = (x: number, z: number): { cx: number; cz: number } => ({
    cx: Math.min(cols, Math.max(0, Math.round((x - area.minX) / cell))),
    cz: Math.min(rows, Math.max(0, Math.round((z - area.minZ) / cell))),
  });
  const free = (cx: number, cz: number): boolean =>
    !blocked(area.minX + cx * cell, area.minZ + cz * cell);
  const nearestFree = (from: { cx: number; cz: number }): { cx: number; cz: number } | null => {
    if (free(from.cx, from.cz)) return from;
    for (let ring = 1; ring <= 2; ring++)
      for (let dz = -ring; dz <= ring; dz++)
        for (let dx = -ring; dx <= ring; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== ring) continue;
          const cx = from.cx + dx,
            cz = from.cz + dz;
          if (cx < 0 || cz < 0 || cx > cols || cz > rows) continue;
          if (free(cx, cz)) return { cx, cz };
        }
    return null;
  };
  const from = nearestFree(nodeAt(start.x, start.z)),
    to = nearestFree(nodeAt(goal.x, goal.z));
  if (!from || !to) return false;
  const goalIndex = to.cz * (cols + 1) + to.cx,
    seen = new Uint8Array((cols + 1) * (rows + 1)),
    queue = new Int32Array((cols + 1) * (rows + 1));
  let head = 0,
    tail = 0;
  const startIndex = from.cz * (cols + 1) + from.cx;
  seen[startIndex] = 1;
  queue[tail++] = startIndex;
  while (head < tail) {
    const current = queue[head++];
    if (current === goalIndex) return true;
    const cx = current % (cols + 1),
      cz = (current - cx) / (cols + 1);
    for (const [nx, nz] of [
      [cx + 1, cz],
      [cx - 1, cz],
      [cx, cz + 1],
      [cx, cz - 1],
    ] as const) {
      if (nx < 0 || nz < 0 || nx > cols || nz > rows) continue;
      const index = nz * (cols + 1) + nx;
      if (seen[index]) continue;
      seen[index] = 1;
      if (blocked(area.minX + nx * cell, area.minZ + nz * cell)) continue;
      queue[tail++] = index;
    }
  }
  return false;
}
export const TOWER = {
  damage: 2,
  range: 12,
  rangePerLevel: 1.6,
  cooldown: 0.9,
  cooldownPerLevel: 0.12,
  minCooldown: 0.55,
};
export const LANTERN = {
  radius: 5,
  radiusPerLevel: 1.4,
  slow: 0.55,
  slowPerLevel: 0.07,
  minSlow: 0.4,
};
export const towerStats = (level: number): { damage: number; range: number; cooldown: number } => ({
  damage: TOWER.damage + (level - 1),
  range: TOWER.range + (level - 1) * TOWER.rangePerLevel,
  cooldown: Math.max(TOWER.minCooldown, TOWER.cooldown - (level - 1) * TOWER.cooldownPerLevel),
});
export const lanternRadius = (level: number): number =>
  LANTERN.radius + (level - 1) * LANTERN.radiusPerLevel;
export const lanternSlow = (level: number): number =>
  Math.max(LANTERN.minSlow, LANTERN.slow - (level - 1) * LANTERN.slowPerLevel);
export const ENEMY_TYPES: Record<EnemyId, EnemySpec> = {
  walker: {
    name: '游荡者',
    note: '均衡',
    hp: 5,
    speed: 1.05,
    damage: 4,
    scale: 1,
    bounty: 2,
    armor: 0,
    attackRate: 0.95,
    wallDamage: 1,
  },
  runner: {
    name: '疾行者',
    note: '高速 · 低血',
    hp: 4,
    speed: 2,
    damage: 3,
    scale: 0.82,
    bounty: 3,
    armor: 0,
    attackRate: 0.7,
    wallDamage: 1,
  },
  brute: {
    name: '破阵者',
    note: '重甲 · 专职拆塔',
    hp: 20,
    speed: 0.7,
    damage: 12,
    scale: 1.45,
    bounty: 5,
    armor: 0.6,
    attackRate: 1.25,
    wallDamage: 2.4,
    siege: 15,
  },
  spitter: {
    name: '腐吐者',
    note: '超远程 · 腐蚀建筑',
    hp: 8,
    speed: 0.72,
    damage: 5,
    scale: 0.95,
    bounty: 4,
    armor: 0,
    attackRate: 2.4,
    wallDamage: 1.2,
    range: 14,
    ranged: true,
  },
  stalker: {
    name: '潜行者',
    note: '迷雾 · 灯照显形',
    hp: 7,
    speed: 1.45,
    damage: 10,
    scale: 0.92,
    bounty: 4,
    armor: 0,
    attackRate: 0.8,
    wallDamage: 1,
    stealth: true,
  },
  alpha: {
    name: '林中巨影',
    note: '首领',
    hp: 130,
    speed: 0.55,
    damage: 22,
    scale: 2.25,
    bounty: 25,
    armor: 0.8,
    attackRate: 1.5,
    wallDamage: 3,
  },
};
// Each night is a tactical problem, not just more bodies. `lesson`/`advice` feed the intel page;
// group tuples are [type, count, lane, spacing, intent]; `fog` reduces visibility.
export const WAVES: Wave[] = [
  {
    name: '林间脚步',
    lesson: '单路来袭：先建一座瞭望塔，把北径钉住。',
    hint: '北径来袭 · 先在房车北侧部署瞭望塔。',
    advice: '游荡者中速均衡；站在塔的射程里互相掩护即可。',
    groups: [['walker', 10, 0, 1.5, '突击']],
  },
  {
    name: '两面夹击',
    lesson: '双路分兵：资源只够守一边，用灯拖住另一边。',
    hint: '北径与西径 · 疾行者速度快，营地灯能减速。',
    advice: '北径压力大，西径先放灯减速，人过去补枪。',
    groups: [
      ['walker', 8, 0, 1, '突击'],
      ['runner', 8, 1, 0.8, '奔袭'],
    ],
  },
  {
    name: '沉重回响',
    lesson: '攻城：破阵者直拆瞭望塔，腐吐者在远处腐蚀防线。',
    hint: '北径重甲、东岸远程 · 破阵者专职拆塔，腐吐者攻击建筑。',
    advice: '塔位放远一点，让角色去点掉腐吐者；步枪与升级塔克制破阵者护甲。',
    groups: [
      ['brute', 4, 0, 2, '拆塔'],
      ['spitter', 3, 2, 2.2, '远程'],
      ['walker', 8, 2, 1, '突击'],
      ['runner', 8, 2, 0.7, '奔袭'],
    ],
  },
  {
    name: '雾中低语',
    lesson: '迷雾：能见度骤降，潜行者在灯光外几乎不可见。',
    hint: '全径迷雾 · 潜行者贴地潜行，营地灯与信号弹能照出它们。',
    advice: '把灯铺在路口，别让潜行者摸到房车；灯也是唯一的预警。',
    fog: 0.42,
    groups: [
      ['stalker', 6, 0, 1.6, '潜行'],
      ['stalker', 4, 1, 1.6, '潜行'],
      ['walker', 10, 2, 0.9, '突击'],
    ],
  },
  {
    name: '最后的长夜',
    lesson: '综合考试：巨影与两翼同时压上。',
    hint: '北方巨影 · 集火巨影，留意两翼疾行者。守过这一夜等待救援。',
    advice: '留信号弹与医疗包给巨影阶段；先清小怪，再集火巨影。',
    groups: [
      ['brute', 4, 0, 1.6, '拆塔'],
      ['runner', 12, 1, 0.7, '奔袭'],
      ['alpha', 1, 0, 4, '首领'],
      ['walker', 16, 2, 0.7, '突击'],
    ],
  },
];
export type WindDir = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
export type WindTier = 'light' | 'breeze' | 'strong';
export interface WindSpec {
  dir: WindDir;
  angle: number;
  tier: WindTier;
  strength: number;
  note: string;
}
// NGT-06 world compass: N = -Z (north lane), E = +X (east bank), S = +Z, W = -X.
// `angle` is where the wind blows toward: 0 = east, PI/2 = south.
export const WIND_DIR_ANGLE: Record<WindDir, number> = {
  E: 0,
  SE: Math.PI / 4,
  S: Math.PI / 2,
  SW: (3 * Math.PI) / 4,
  W: Math.PI,
  NW: (-3 * Math.PI) / 4,
  N: -Math.PI / 2,
  NE: -Math.PI / 4,
};
export const WIND_TIER_STRENGTH: Record<WindTier, number> = {
  light: 0.35,
  breeze: 0.6,
  strong: 0.9,
};
// Acid glob lateral speed per unit of wind strength (world units per second).
export const WIND_DRIFT_SCALE = 1.2;
const defineWind = (dir: WindDir, tier: WindTier, note: string): WindSpec => ({
  dir,
  angle: WIND_DIR_ANGLE[dir],
  tier,
  strength: WIND_TIER_STRENGTH[tier],
  note,
});
// One deterministic wind per night, indexed like WAVES; no runtime randomness.
export const WINDS: readonly WindSpec[] = [
  defineWind('N', 'light', '微风向北：酸液几乎不偏，首夜专注建塔。'),
  defineWind('W', 'breeze', '西风渐起：酸液向西偏，东岸远程会略微打偏。'),
  defineWind('E', 'strong', '强东风：酸液明显向东漂移，腐吐者更难命中营地。'),
  defineWind('S', 'strong', '强南风：烟雾与酸液压向营地，别在下风口站桩。'),
  defineWind('SW', 'breeze', '西南风：烟往西南散，中距离对射更稳。'),
];
export function nightWind(day: number): WindSpec {
  return WINDS[Math.min(WINDS.length, Math.max(1, Math.trunc(day))) - 1];
}
export interface NightIntel extends Wave {
  day: number;
  wind: WindSpec;
}
// Pre-night intel payload: the wave brief plus tonight's wind, for the intel page.
export function nightIntel(day: number): NightIntel {
  const index = Math.min(WAVES.length, Math.max(1, Math.trunc(day))) - 1;
  return { ...WAVES[index], day: index + 1, wind: nightWind(day) };
}
export function windVector(wind: WindSpec): { x: number; z: number } {
  return { x: Math.cos(wind.angle) * wind.strength, z: Math.sin(wind.angle) * wind.strength };
}
// NGT-06 first pass: acid globs drift with the wind component perpendicular to the shot.
// Returns the extra displacement after `time` seconds of flight (no full ballistics).
export function windDrift(
  wind: WindSpec,
  dx: number,
  dz: number,
  time: number,
): { x: number; z: number } {
  const length = Math.hypot(dx, dz);
  if (!length || !Number.isFinite(time) || time <= 0) return { x: 0, z: 0 };
  const perpX = -dz / length;
  const perpZ = dx / length;
  const w = windVector(wind);
  const lateral = (w.x * perpX + w.z * perpZ) * WIND_DRIFT_SCALE * time;
  return { x: perpX * lateral, z: perpZ * lateral };
}
export type GuidanceStep = 'gather' | 'build' | 'fight' | 'done';
export const GUIDANCE: Record<Exclude<GuidanceStep, 'done'>, { title: string; body: string }> = {
  gather: {
    title: '采集木材',
    body: `先去营地边的倒木采一段木材。${WAVES[0].hint}`,
  },
  build: {
    title: '建造瞭望塔',
    body: `在房车北侧部署一座瞭望塔，木材 ×${COSTS.tower}。先建塔再采木也可以。`,
  },
  fight: {
    title: '迎接夜晚',
    body: '按 N 或「迎接夜晚」开始第一夜；站到北径路口，别让它们靠近营地。',
  },
};
export function guidanceStep(s: GameState): GuidanceStep {
  if (s.day !== 1 || s.phase !== 'day') return 'done';
  if (s.buildings.some((b) => b.type === 'tower')) return 'fight';
  if (s.logs.some((l) => l.remaining < LOG_SWINGS)) return 'build';
  return 'gather';
}
export function guidanceProgress(s: GameState): { step: GuidanceStep; wood: number; logs: number } {
  return {
    step: guidanceStep(s),
    wood: s.logs.reduce((n, l) => n + l.remaining, 0) * logYield(s),
    logs: s.logs.filter((l) => l.remaining > 0).length,
  };
}
export const PERKS: Record<PerkId, PerkSpec> = {
  marksman: {
    name: '林地神射手',
    damageMultiplier: 1.35,
    currentText: '自动射击伤害 +35%。',
    text: '所有武器伤害 +35%，步枪更擅长突破重甲。',
  },
  engineer: {
    name: '营造专家',
    damageMultiplier: 1.35,
    currentText: '瞭望塔伤害 +35%，维修恢复量 +50%。',
    text: '瞭望塔伤害 +35%，维修恢复量 +50%。',
  },
  scavenger: {
    name: '拾荒老手',
    logBonus: 5,
    currentText: '倒木每次 +5 木材；黎明额外 +10 木材、+3 零件。',
    text: '倒木每次 +5 木材；黎明额外 +10 木材、+3 零件。',
  },
  survivor: {
    name: '余火守望',
    currentText: '角色生命上限 +25，立即补满；冲刺体力恢复 +50%，延迟 -40%。',
    text: '最大生命 +25，立即补满生命；冲刺体力恢复 +50%，冲刺后的恢复等待缩短 40%。',
  },
};
export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  carbine: {
    name: '巡林卡宾枪',
    range: 9,
    damage: 2,
    interval: 0.44,
    armorPen: 0.15,
    targets: 1,
    color: '#ffe6a1',
    text: '均衡 · 持续射击，对护甲效率低',
  },
  shotgun: {
    name: '双管霰弹枪',
    range: 6,
    damage: 3,
    interval: 0.95,
    armorPen: 0.35,
    targets: 3,
    color: '#ffd07c',
    text: '近距 · 同时命中最多 3 个目标',
  },
  rifle: {
    name: '猎人步枪',
    range: 13,
    damage: 6,
    interval: 1.05,
    armorPen: 0.85,
    targets: 1,
    color: '#cfe6ff',
    text: '远距 · 高单发，穿透重甲',
  },
};
export const EXPEDITIONS: Expedition[] = [
  {
    id: 'mill',
    name: '旧伐木场',
    tag: '建设补给',
    time: 35,
    text: '沿旧林道搬回可用木料。耗时 35 秒，获得 35 木材、3 零件。',
    wood: 35,
    scrap: 3,
    injury: 0,
  },
  {
    id: 'clinic',
    name: '废弃救护站',
    tag: '医疗储备',
    time: 40,
    text: '绕过倒塌路障搜寻药箱。耗时 40 秒，获得 2 医疗包、5 零件。',
    medkits: 2,
    scrap: 5,
    injury: 0,
  },
  {
    id: 'station',
    name: '山脊中继站',
    tag: '高风险 · 科技',
    time: 50,
    text: '穿过碎石坡带回电子元件。耗时 50 秒，损失 20 生命，获得 12 零件、15 木材。',
    wood: 15,
    scrap: 12,
    injury: 20,
  },
];
export function newGame(): GameState {
  return {
    day: 1,
    phase: 'day',
    elapsed: 0,
    wood: START_SUPPLIES.wood,
    scrap: START_SUPPLIES.scrap,
    health: 100,
    playerHp: 100,
    stamina: 100,
    staminaDelay: 0,
    medkits: MEDKIT_BASE,
    kills: 0,
    paused: false,
    manualPause: false,
    over: false,
    won: false,
    weapon: 'carbine',
    unlocked: ['carbine'],
    perks: [],
    perkPending: false,
    expeditionDay: 0,
    flareCooldown: 0,
    rv: [],
    weaponMod: null,
    buildings: [],
    logs: [],
    nextBuildId: 1,
  };
}
export const maxHp = (s: GameState): number => 100 + (s.perks.includes('survivor') ? 25 : 0);
export const active = (s: GameState): boolean => !s.over && !s.paused;
export const dayReady = (s: GameState): boolean => !s.over && s.phase === 'day';
export const applyArmor = (damage: number, armor = 0, penetration = 0): number =>
  damage *
  (1 - Math.min(ARMOR_CAP, Math.max(0, armor) * (1 - Math.max(0, Math.min(1, penetration)))));
export function canBuild(s: GameState, type: string): boolean {
  return (
    Object.hasOwn(COSTS, type) &&
    active(s) &&
    s.phase === 'day' &&
    s.wood >= COSTS[type as BuildingType]
  );
}
export function buy(s: GameState, type: string): boolean {
  if (!canBuild(s, type)) return false;
  s.wood -= COSTS[type as BuildingType];
  return true;
}
export function advance(s: GameState, cleared = false): boolean {
  if (!active(s) || (s.phase === 'night' && !cleared) || s.perkPending) return false;
  s.elapsed = 0;
  if (s.phase === 'day') s.phase = 'night';
  else if (s.day === WAVES.length) {
    s.won = true;
    s.over = true;
  } else {
    s.phase = 'day';
    s.day++;
    s.wood +=
      DAWN_SUPPLIES.wood + (s.perks.includes('scavenger') ? DAWN_SUPPLIES.scavengerWood : 0);
    s.scrap +=
      DAWN_SUPPLIES.scrap + (s.perks.includes('scavenger') ? DAWN_SUPPLIES.scavengerScrap : 0);
    s.health = Math.min(100, s.health + 12);
    s.playerHp = maxHp(s);
    s.stamina = 100;
    s.staminaDelay = 0;
    s.flareCooldown = 0;
    s.weaponMod = null;
    if (s.rv.includes('medcab')) s.medkits = Math.min(maxMedkits(s), s.medkits + 1);
    s.perkPending = s.perks.length < Object.keys(PERKS).length;
  }
  return true;
}
export function damageCamp(s: GameState, amount: number): void {
  if (!Number.isFinite(amount) || amount < 0 || s.over) return;
  s.health = Math.max(0, s.health - amount);
  if (!s.health) s.over = true;
}
export const waveSize = (day: number): number =>
  WAVES[Math.min(WAVES.length, Math.max(1, day)) - 1].groups.reduce((n, g) => n + g[1], 0);
// Each group enters its own lane; later groups wait before they join the same night.
export function wavePlan(day: number): SpawnEntry[] {
  const wave = WAVES[Math.min(WAVES.length, Math.max(1, day)) - 1],
    plan: SpawnEntry[] = [];
  let cursor = 1;
  wave.groups.forEach(([type, count, lane, spacing], group) => {
    if (group > 0) cursor += 6;
    for (let i = 0; i < count; i++) {
      plan.push({ type, lane, at: cursor });
      cursor += spacing;
    }
  });
  return plan;
}
export function overlaps(
  x: number,
  z: number,
  objects: { x: number; z: number; r: number }[],
  radius = 1,
): boolean {
  return objects.some((o) => Math.hypot(x - o.x, z - o.z) < radius + o.r);
}
// Enemy intent helpers: pure decision math so behavior can be unit tested without WebGL.
export function siegeGoal(
  x: number,
  z: number,
  buildings: Building[],
  range: number,
): Building | null {
  let best: Building | null = null,
    bestD = range;
  for (const b of buildings) {
    if (b.type !== 'tower') continue;
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  }
  return best;
}
export function rangedGoal(
  x: number,
  z: number,
  playerX: number,
  playerZ: number,
  buildings: Building[],
  range: number,
): { kind: 'building'; building: Building } | { kind: 'player' } | null {
  let best: { kind: 'building'; building: Building } | null = null,
    bestD = range;
  for (const b of buildings) {
    const d = Math.hypot(b.x - x, b.z - z);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'building', building: b };
    }
  }
  if (best) return best;
  return Math.hypot(playerX - x, playerZ - z) < range ? { kind: 'player' } : null;
}
export function revealed(
  x: number,
  z: number,
  playerX: number,
  playerZ: number,
  lanterns: { x: number; z: number; radius: number }[],
  flares: { active: boolean; x: number; z: number; radius: number }[],
  fog: number | undefined,
): boolean {
  if (!fog) return true;
  for (const l of lanterns) if (Math.hypot(l.x - x, l.z - z) < l.radius) return true;
  for (const f of flares) if (f.active && Math.hypot(f.x - x, f.z - z) < f.radius) return true;
  return Math.hypot(playerX - x, playerZ - z) < 5;
}
export const attackDamage = (s: GameState, base: number, tower = false): number =>
  base *
  (s.perks.includes(tower ? 'engineer' : 'marksman')
    ? (PERKS[tower ? 'engineer' : 'marksman'].damageMultiplier as number)
    : 1);
export const logYield = (s: GameState): number =>
  GATHER.perSwing + (s.perks.includes('scavenger') ? (PERKS.scavenger.logBonus as number) : 0);
export function collectLog(s: GameState, log: LogNode): number {
  if (log.remaining <= 0) return 0;
  log.remaining--;
  const amount = logYield(s);
  s.wood += amount;
  return amount;
}
export function choosePerk(s: GameState, id: string): boolean {
  if (
    s.over ||
    s.phase !== 'day' ||
    !s.perkPending ||
    !Object.hasOwn(PERKS, id) ||
    s.perks.includes(id as PerkId)
  )
    return false;
  s.perks.push(id as PerkId);
  s.perkPending = false;
  s.playerHp = maxHp(s);
  return true;
}
export function expedition(s: GameState, id: string): boolean {
  const e = EXPEDITIONS.find((e) => e.id === id);
  if (
    !e ||
    !dayReady(s) ||
    s.expeditionDay === s.day ||
    s.elapsed + e.time >= DAY_LENGTH ||
    s.playerHp <= e.injury
  )
    return false;
  s.elapsed += e.time;
  s.expeditionDay = s.day;
  s.wood += e.wood || 0;
  s.scrap += e.scrap || 0;
  s.medkits = Math.min(maxMedkits(s), s.medkits + (e.medkits || 0));
  s.playerHp -= e.injury;
  return true;
}
export function unlockWeapon(s: GameState, id: string): boolean {
  if (
    !dayReady(s) ||
    !Object.hasOwn(WEAPONS, id) ||
    s.unlocked.includes(id as WeaponId) ||
    s.scrap < 10 ||
    !s.rv.includes('workbench')
  )
    return false;
  s.scrap -= 10;
  s.unlocked.push(id as WeaponId);
  s.weapon = id as WeaponId;
  return true;
}
export function equipWeapon(s: GameState, id: string): boolean {
  if (s.over || !Object.hasOwn(WEAPONS, id) || !s.unlocked.includes(id as WeaponId)) return false;
  s.weapon = id as WeaponId;
  return true;
}
export const hasFurniture = (s: GameState, id: string): boolean => s.rv.includes(id as FurnitureId);
export const furnitureCount = (s: GameState, kind: FurnitureKind): number =>
  s.rv.filter((id) => RV_FURNITURE[id]?.kind === kind).length;
export const rvSlots = (s: GameState): number => RV.slotDays.filter((day) => s.day >= day).length;
export function furnitureReason(s: GameState, id: string): string {
  const f = RV_FURNITURE[id as FurnitureId];
  if (!f) return '未知家具';
  if (!dayReady(s)) return '只能在白天布置房车。';
  if (s.rv.includes(id as FurnitureId)) return '已经安装。';
  if (f.kind === 'function' && furnitureCount(s, 'function') >= rvSlots(s)) {
    const unlock = RV.slotDays[furnitureCount(s, 'function')];
    return unlock ? `功能槽不足 · 守过第 ${unlock - 1} 夜后解锁下一个。` : '功能槽已满。';
  }
  if (s.wood < f.wood || s.scrap < f.scrap) return `材料不足 · 需要 ▰${f.wood} ⚙${f.scrap}。`;
  return '';
}
export const canInstallFurniture = (s: GameState, id: string): boolean => !furnitureReason(s, id);
export function installFurniture(s: GameState, id: string): boolean {
  if (!canInstallFurniture(s, id)) return false;
  const f = RV_FURNITURE[id as FurnitureId];
  s.wood -= f.wood;
  s.scrap -= f.scrap;
  s.rv.push(id as FurnitureId);
  if (id === 'medcab') s.medkits = Math.min(maxMedkits(s), s.medkits + 1);
  return true;
}
export function uninstallFurniture(s: GameState, id: string): boolean {
  if (!dayReady(s) || !s.rv.includes(id as FurnitureId)) return false;
  const f = RV_FURNITURE[id as FurnitureId];
  s.rv.splice(s.rv.indexOf(id as FurnitureId), 1);
  s.wood += Math.floor(f.wood * DISMANTLE_REFUND);
  s.scrap += Math.floor(f.scrap * DISMANTLE_REFUND);
  if (id === 'medcab') s.medkits = Math.min(s.medkits, maxMedkits(s));
  if (id === 'workbench') s.weaponMod = null;
  return true;
}
export const maxMedkits = (s: GameState): number =>
  Math.min(MEDKIT_CAP, MEDKIT_BASE + (s.rv.includes('medcab') ? 1 : 0));
export const weaponModActive = (s: GameState): boolean =>
  hasFurniture(s, 'workbench') && Object.hasOwn(WEAPON_MODS, s.weaponMod || '');
export function setWeaponMod(s: GameState, id: string | null): boolean {
  if (!dayReady(s) || !hasFurniture(s, 'workbench')) return false;
  if (id !== null && !Object.hasOwn(WEAPON_MODS, id)) return false;
  s.weaponMod = id as WeaponModId | null;
  return true;
}
export const weaponDamage = (s: GameState, id: WeaponId): number =>
  WEAPONS[id].damage + (weaponModActive(s) ? WEAPON_MODS[s.weaponMod as WeaponModId].damage : 0);
export const weaponRange = (s: GameState, id: WeaponId): number =>
  WEAPONS[id].range + (weaponModActive(s) ? WEAPON_MODS[s.weaponMod as WeaponModId].range : 0);
// Collapse consecutive same-group spawns into readable rows for the radio timeline.
export function spawnTimeline(day: number): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const entry of wavePlan(day)) {
    const last = rows[rows.length - 1];
    if (
      last &&
      last.type === entry.type &&
      last.lane === entry.lane &&
      entry.at - last.end <= 2.5
    ) {
      last.count++;
      last.end = entry.at;
    } else rows.push({ type: entry.type, lane: entry.lane, at: entry.at, end: entry.at, count: 1 });
  }
  return rows;
}
export function heal(s: GameState): boolean {
  if (!active(s) || s.medkits < 1 || s.playerHp >= maxHp(s)) return false;
  s.medkits--;
  s.playerHp = Math.min(maxHp(s), s.playerHp + MEDKIT_HEAL);
  return true;
}
export function useFlare(s: GameState): boolean {
  if (!active(s) || s.flareCooldown > 0) return false;
  s.flareCooldown = FLARE.cooldown;
  return true;
}
export function damagePlayer(s: GameState, amount: number): boolean {
  if (!active(s) || !Number.isFinite(amount) || amount <= 0) return false;
  s.playerHp = Math.max(0, s.playerHp - amount);
  return s.playerHp === 0;
}
export function playerDown(s: GameState): boolean {
  damageCamp(s, 15);
  s.playerHp = Math.ceil(maxHp(s) / 2);
  return s.over;
}
export function tickSurvival(s: GameState, dt: number): void {
  if (!active(s) || !Number.isFinite(dt) || dt <= 0) return;
  s.flareCooldown = Math.max(0, s.flareCooldown - dt);
  // FIX-01: the dash in main.ts writes base DASH.delay; clamp it to the perk-adjusted cap here.
  s.staminaDelay = Math.min(s.staminaDelay, staminaDelay(s));
  s.staminaDelay = Math.max(0, s.staminaDelay - dt);
  if (!s.staminaDelay) s.stamina = Math.min(100, s.stamina + staminaRegen(s) * dt);
}
export const upgradeCost = (b: Building): { wood: number; scrap: number } => ({
  wood: UPGRADE.wood * b.level,
  scrap: UPGRADE.scrap * b.level,
});
export function repair(s: GameState, building: Building | null = null): boolean {
  const hp = building ? building.hp : s.health,
    max = building ? building.maxHp : 100;
  if (!dayReady(s) || s.wood < REPAIR_WOOD || hp >= max) return false;
  s.wood -= REPAIR_WOOD;
  const amount = (building ? 90 : 30) * (s.perks.includes('engineer') ? 1.5 : 1);
  if (building) {
    building.hp = Math.min(max, hp + amount);
    return true;
  }
  s.health = Math.min(100, hp + amount);
  return true;
}
export function upgrade(s: GameState, b: Building): boolean {
  const cost = upgradeCost(b);
  if (!dayReady(s) || b.level >= MAX_LEVEL || s.wood < cost.wood || s.scrap < cost.scrap)
    return false;
  s.wood -= cost.wood;
  s.scrap -= cost.scrap;
  b.level++;
  b.maxHp += 100;
  b.hp = b.maxHp;
  b.invested = {
    wood: (b.invested?.wood || 0) + cost.wood,
    scrap: (b.invested?.scrap || 0) + cost.scrap,
  };
  return true;
}
export function refundValue(b: Building): { wood: number; scrap: number } {
  return {
    wood: Math.floor((b.invested?.wood || 0) * DISMANTLE_REFUND),
    scrap: Math.floor((b.invested?.scrap || 0) * DISMANTLE_REFUND),
  };
}
// Dawn rating: clean, fast defense scores higher; every leak is remembered.
export const RATING = { s: 95, a: 80, b: 60 };
export function dawnRating({
  campLost = 0,
  downs = 0,
  buildingsLost = 0,
  nightSeconds = 0,
}: RatingInput = {}): { score: number; grade: string } {
  const speedBonus =
    nightSeconds > 0 && nightSeconds < 60 ? Math.round((60 - nightSeconds) * 0.2) : 0;
  const score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        100 -
          Math.max(0, campLost) * 1.5 -
          Math.max(0, downs) * 8 -
          Math.max(0, buildingsLost) * 6 -
          Math.max(0, nightSeconds - 90) * 0.5 +
          speedBonus,
      ),
    ),
  );
  const grade = score >= RATING.s ? 'S' : score >= RATING.a ? 'A' : score >= RATING.b ? 'B' : 'C';
  return { score, grade };
}
