import type { AudioStats } from './audio.js';
import type {
  BuildingType,
  EnemyId,
  FurnitureId,
  GameState,
  GuidanceStep,
  WeaponId,
  WeaponModId,
  WindDir,
  WindTier,
} from './rules.js';

export {};

declare global {
  interface Window {
    __pinefall: PinefallDiagnostics;
  }
}

export interface PinefallRating {
  score: number;
  grade: string;
  day: number;
  campLost: number;
  downs: number;
  buildingsLost: number;
  seconds: number;
}

export interface PinefallMachine {
  phase: string | null;
  overlay: string;
  interior: boolean;
  paused: boolean;
}

export interface PinefallHome {
  visible: boolean;
  mode: boolean;
  enabled: boolean;
}

export interface PinefallLoading {
  progress: number;
  ready: boolean;
}

export interface PinefallStats {
  inside: boolean;
  transitioning: boolean;
  lampOn: boolean | null;
  manualOpen: boolean;
  viewZoom: number;
  calls: number;
  triangles: number;
  enemies: number;
  remaining: number;
  ambientTime: number;
  windStrength: number;
  wireZ: number;
  fireIntensity: number;
  buildings: number;
  buildingLevels: string[];
  selectedBuilding: BuildingType | null;
  camera: number[];
  player: number[];
  playerHp: number;
  maxHp: number;
  stamina: number;
  medkits: number;
  scrap: number;
  weapon: WeaponId;
  enemyTypes: Partial<Record<EnemyId, number>>;
  flareActive: boolean;
  flareCooldown: number;
  dashing: boolean;
  invulnerable: boolean;
  shakeEnabled: boolean;
  trauma: number;
  shakeFrames: number;
  muzzleFlashes: number;
  flashes: number;
  dying: number;
  deaths: number;
  hitStops: number;
  knockbacks: number;
  recoils: number;
  fog: number;
  hidden: number;
  spits: number;
  sieging: number;
  windDir: WindDir;
  windTier: WindTier;
  windX: number;
  windZ: number;
  lastSpit: {
    fromX: number;
    fromZ: number;
    total: number;
    aimX: number;
    aimZ: number;
    x: number;
    z: number;
    driftX: number;
    driftZ: number;
  } | null;
  rating: PinefallRating | null;
  rv: FurnitureId[];
  rvSlots: number;
  weaponMod: WeaponModId | null;
  maxMedkits: number;
  playerDamage: number;
  playerRange: number;
  radioAlert: string | null;
  windowGlow: number;
  guidance: GuidanceStep;
  collecting: boolean;
  collectCooldown: number;
  logsRemaining: number;
  levelDots: number;
  ghost: {
    visible: boolean;
    outline: boolean;
    x: number;
    z: number;
    valid: boolean;
    reason: string | null;
    angle: number;
  } | null;
  nightPrompted: boolean;
}

export interface PinefallDiagnostics {
  readonly audio: AudioStats;
  readonly machine: PinefallMachine;
  readonly home: PinefallHome;
  readonly loading: PinefallLoading;
  readonly state: GameState;
  readonly stats: PinefallStats;
  startNew(): void;
  continueSave(): boolean;
  setSpeed(multiplier: number): number;
}
