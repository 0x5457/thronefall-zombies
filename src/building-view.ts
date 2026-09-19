// Scene-side view for player buildings. Owns meshes, lantern lights and construction/hit
// animation; authoritative building data stays in `state.buildings`.
import * as T from 'three';
import { structure } from './world.js';
import { easeOutBack } from './feel.js';
import type { Building } from './rules.js';

export interface BuildingView {
  mesh: T.Group;
  light: T.PointLight | null;
  growth: number;
  cooldown: number;
  hit: number;
}

export class BuildingViews {
  private readonly views = new Map<number, BuildingView>();

  constructor(private readonly scene: T.Scene) {}

  of(b: Building): BuildingView {
    return this.views.get(b.id)!;
  }

  all(): BuildingView[] {
    return [...this.views.values()];
  }

  private attach(b: Building, mesh: T.Group, light: T.PointLight | null, growth: number): void {
    mesh.userData.building = b;
    this.views.set(b.id, { mesh, light, growth, cooldown: 0, hit: 0 });
    this.scene.add(mesh);
    if (light) this.scene.add(light);
  }

  private meshFor(b: Building): T.Group {
    const mesh = structure(b.type, b.level);
    mesh.position.set(b.x, 0, b.z);
    mesh.rotation.y = b.angle || 0;
    return mesh;
  }

  private lightFor(b: Building): T.PointLight | null {
    if (b.type !== 'lantern') return null;
    const light = new T.PointLight('#ffcf7e', 0, 9, 1.5);
    light.position.set(b.x, 2.6, b.z);
    return light;
  }

  /** Fresh building: pop-in from nothing at `growth`, or fully built at 1. */
  create(b: Building, growth = 1): void {
    this.attach(b, this.meshFor(b), this.lightFor(b), growth);
  }

  /** Upgrade swap: keep position/orientation, replay the grow animation. */
  refit(b: Building): void {
    const view = this.views.get(b.id);
    if (!view) return;
    const mesh = this.meshFor(b);
    mesh.userData.building = b;
    mesh.rotation.y = view.mesh.rotation.y;
    mesh.scale.setScalar(0.6);
    this.scene.remove(view.mesh);
    view.mesh = mesh;
    view.growth = 0.4;
    this.scene.add(mesh);
  }

  detach(b: Building): void {
    const view = this.views.get(b.id);
    if (!view) return;
    this.scene.remove(view.mesh);
    if (view.light) this.scene.remove(view.light);
    this.views.delete(b.id);
  }

  /** Rebuild every view from authoritative data (save restore / new campaign). */
  rebuildAll(buildings: readonly Building[]): void {
    for (const view of this.views.values()) {
      this.scene.remove(view.mesh);
      if (view.light) this.scene.remove(view.light);
    }
    this.views.clear();
    for (const b of buildings) this.create(b, 1);
  }

  /** Construction pop, hit shake and lantern glow; called from the ambience pass. */
  animate(dt: number, time: number, daylight: number, fog: number): void {
    for (const view of this.views.values()) {
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
  }
}
