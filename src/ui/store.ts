// UI snapshot store + command bridge. main.ts pushes game state, React renders it.
// Components never mutate the rules state; they call commands installed by main.
import type { Building, BuildingType, FurnitureId, GameState, PerkId, WeaponId } from '../rules.js';

export interface BossView {
  hp: number;
  maxHp: number;
}

export interface ToastView {
  text: string;
  token: number;
  visible: boolean;
}

export interface PlayerView {
  hp: number;
  maxHp: number;
  stamina: number;
  weaponName: string;
  medkits: number;
  maxMedkits: number;
  flareReady: boolean;
  flareSeconds: number;
}

export interface AudioView {
  enabled: boolean;
  master: number;
  music: number;
  sfx: number;
  locked: boolean;
}

export interface PerkOptionView {
  id: PerkId;
  name: string;
  text: string;
}

export interface PerkView {
  open: boolean;
  summary: string;
  options: PerkOptionView[];
}

export interface EndView {
  open: boolean;
  won: boolean;
  eyebrow: string;
  title: string;
  text: string;
}

export interface GuidanceView {
  skipped: boolean;
}

export interface UiSnapshot {
  version: number;
  state: GameState;
  inside: boolean;
  photoMode: boolean;
  selectedBuild: BuildingType | null;
  selectedBuilding: Building | null;
  remaining: number;
  enemiesAlive: number;
  boss: BossView | null;
  player: PlayerView;
  radioAlert: string | null;
  toast: ToastView;
  guidance: GuidanceView;
  perk: PerkView;
  end: EndView;
  shakeEnabled: boolean;
  rvLampOn: boolean;
  audio: AudioView;
}

export interface UiCommands {
  selectBuild(type: BuildingType | null): void;
  selectBuilding(building: Building | null): void;
  closeBuildingPanel(): void;
  upgradeBuilding(): void;
  repairBuilding(): void;
  dismantleBuilding(): void;
  openManual(): void;
  closeManual(): void;
  unlockWeapon(id: WeaponId): void;
  equipWeapon(id: WeaponId): void;
  runExpedition(id: string): void;
  choosePerk(id: PerkId): void;
  nextPhase(): void;
  skipGuidance(): void;
  togglePause(): void;
  openHelp(): void;
  closeHelp(): void;
  openNightConfirm(): void;
  confirmNight(): void;
  cancelNight(): void;
  restart(): void;
  togglePhoto(): void;
  toggleShake(): void;
  toggleSound(): void;
  setAudio(key: 'master' | 'music' | 'sfx', value: number): void;
  enterRv(): void;
  leaveRv(): void;
  rvBuild(id: FurnitureId): void;
  rvDrop(id: FurnitureId): void;
  rvMod(id: string): void;
  toggleLamp(): void;
}

let commands: UiCommands | null = null;

export function installCommands(next: UiCommands): void {
  commands = next;
}

export function cmd(): UiCommands {
  if (!commands) throw new Error('UI commands are not installed yet');
  return commands;
}

export function createUiStore(state: GameState) {
  let snapshot: UiSnapshot = {
    version: 0,
    state,
    inside: false,
    photoMode: false,
    selectedBuild: null,
    selectedBuilding: null,
    remaining: 0,
    enemiesAlive: 0,
    boss: null,
    player: {
      hp: Math.ceil(state.playerHp),
      maxHp: 100,
      stamina: 100,
      weaponName: '',
      medkits: state.medkits,
      maxMedkits: 2,
      flareReady: true,
      flareSeconds: 0,
    },
    radioAlert: null,
    toast: { text: '', token: 0, visible: false },
    guidance: { skipped: false },
    perk: { open: false, summary: '', options: [] },
    end: { open: false, won: false, eyebrow: '', title: '', text: '' },
    shakeEnabled: true,
    rvLampOn: true,
    audio: { enabled: true, master: 0.65, music: 0.65, sfx: 0.8, locked: true },
  };
  const listeners = new Set<() => void>();
  const notify = (): void => listeners.forEach((listener) => listener());
  return {
    getSnapshot: (): UiSnapshot => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(patch: Partial<UiSnapshot>): void {
      snapshot = { ...snapshot, ...patch, version: snapshot.version + 1 };
      notify();
    },
    setBoss(next: BossView | null): void {
      const previous = snapshot.boss;
      if (
        previous === next ||
        (previous && next && previous.hp === next.hp && previous.maxHp === next.maxHp)
      )
        return;
      snapshot = { ...snapshot, boss: next, version: snapshot.version + 1 };
      notify();
    },
    // Per-frame player values: only notify when the rounded display changes.
    setPlayer(next: PlayerView): void {
      const previous = snapshot.player;
      if (
        previous.hp === next.hp &&
        previous.maxHp === next.maxHp &&
        previous.stamina === next.stamina &&
        previous.weaponName === next.weaponName &&
        previous.medkits === next.medkits &&
        previous.maxMedkits === next.maxMedkits &&
        previous.flareReady === next.flareReady &&
        previous.flareSeconds === next.flareSeconds
      )
        return;
      snapshot = { ...snapshot, player: next, version: snapshot.version + 1 };
      notify();
    },
    get state(): UiSnapshot {
      return snapshot;
    },
  };
}

export type UiStore = ReturnType<typeof createUiStore>;
let store: UiStore | null = null;

export function installStore(next: UiStore): void {
  store = next;
}

export function ui(): UiStore {
  if (!store) throw new Error('UI store is not installed yet');
  return store;
}
