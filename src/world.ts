import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP } from './map.js';
import { seeded } from './rng.js';
import { boxGeo, rockGeo, beam, box, mat, mesh } from './gfx.js';
import { freshLogSwings } from './rules.js';
import type { BuildingType, EnemyId, LogNode } from './rules.js';

export interface Wind {
  time: { value: number };
  strength: { value: number };
  // NGT-06: gameplay wind direction from `nightWind`, strength-scaled; smoke and fire lean on it.
  // Vegetation keeps using time/strength only, so there is one shared visual wind, not two.
  dir: { x: number; z: number };
}
export interface Tree {
  x: number;
  z: number;
  r: number;
}
export type WorldLog = Omit<LogNode, 'id'> & {
  trunk?: T.Mesh;
  stump?: T.Mesh;
};
export interface RvGlow {
  panes: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[];
  modules: Record<string, T.Group>;
}
type PlacedArgs = [
  x: number,
  y: number,
  z: number,
  sx?: number,
  sy?: number,
  sz?: number,
  rx?: number,
  ry?: number,
  rz?: number,
];

export interface World {
  fixed: T.Group;
  trees: Tree[];
  flames: T.Group;
  fireLight: T.PointLight;
  fireAt: T.Vector3;
  halo: T.Sprite;
  waterMat: T.ShaderMaterial;
  logs: WorldLog[];
  wind: Wind;
  lightWire: T.Line;
  pendants: T.Group[];
  doorLight: T.PointLight;
  rvGlow: RvGlow;
}

const random = seeded();
const rand = (a: number, b: number): number => a + random() * (b - a);
export const shore = (z: number): number =>
  24 - 0.19 * z + Math.sin(z * 0.15) * 2.2 + Math.sin(z * 0.41) * 0.6;
export const pathX = (z: number): number => -1.5 + Math.sin(z * 0.09) * 2.8;
export function isClearing(x: number, z: number): boolean {
  return (
    (x * x) / 145 + (z * z) / 105 < 1 ||
    Math.abs(x - pathX(z)) < 2.8 ||
    Math.abs(z - (6 + x * 0.19 + Math.sin(x * 0.13))) < 2.1
  );
}
export function walkable(x: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) < MAP.playable &&
    Math.abs(z) < MAP.playable &&
    x < shore(z) - 1
  );
}

function groundTexture(): T.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 4096;
  const c = canvas.getContext('2d')!,
    scale = 4096 / 180;
  c.fillStyle = '#52613a';
  c.fillRect(0, 0, 4096, 4096);
  const dirt = ['#a69a6d', '#a99d70', '#a89b6f', '#ad9f73', '#aa9c70', '#a49669'];
  const grass = ['#768451', '#798654', '#72804e', '#7c8855', '#758251', '#7e8957', '#73804f'];
  for (let z = -90; z < 90; z += 0.125)
    for (let x = -90; x < 90; x += 0.125) {
      const ellipse = (x * x) / 170 + (z * z) / 125;
      const d = Math.min(
        (ellipse - 1) * 3,
        Math.abs(x - pathX(z)) - 2.5,
        Math.abs(z - (6 + x * 0.19 + Math.sin(x * 0.13))) - 1.9,
      );
      const palette = d < rand(-0.42, 0.42) ? dirt : grass;
      c.fillStyle = palette[Math.floor(random() * palette.length)];
      c.fillRect((x + 90) * scale, (z + 90) * scale, 3, 3);
    }
  for (let i = 0; i < 61000; i++) {
    const x = rand(-90, 90),
      z = rand(-90, 90),
      clearing = isClearing(x, z);
    c.fillStyle = clearing
      ? ['#c0af79', '#877e51', '#b5a56d'][i % 3]
      : ['#899356', '#899750', '#424e30', '#a0a161'][i % 4];
    c.globalAlpha = rand(0.15, 0.5);
    c.fillRect((x + 90) * scale, (z + 90) * scale, rand(1, 5), rand(1, 3));
  }
  c.globalAlpha = 0.13;
  c.strokeStyle = '#695e40';
  c.lineWidth = 2;
  for (const offset of [-0.85, 0.85]) {
    c.beginPath();
    for (let z = -90; z < -8; z += 0.2)
      c.lineTo((pathX(z) + offset + 90) * scale, (z + 90) * scale);
    c.stroke();
  }
  c.globalAlpha = 1;
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  tex.magFilter = T.NearestFilter;
  tex.anisotropy = 4;
  return tex;
}
function pine(parent: T.Object3D, x: number, z: number, size: number): void {
  const g = new T.Group();
  parent.add(g);
  g.position.set(x, 0, z);
  g.rotation.y = rand(0, Math.PI * 2);
  box(g, '#635438', 0, size * 0.28, 0, size * 0.09, size * 0.56, size * 0.09);
  const colors = ['#536749', '#5b6e48', '#63764b', '#6d7c4e', '#49634b', '#778551'];
  const color = new T.Color(colors[Math.floor(random() * colors.length)]);
  for (let i = 0; i < 4; i++) {
    const h = size * (0.44 - i * 0.032),
      radius = size * (0.245 - i * 0.047);
    const geo = new T.ConeGeometry(radius, h, 5, 1);
    geo.translate(0, h * 0.5, 0);
    const layer = mesh(
      g,
      geo,
      mat(
        color
          .clone()
          .multiplyScalar(0.87 + i * 0.075)
          .getHex(),
      ),
      0,
      size * (0.16 + i * 0.18),
      0,
    );
    layer.rotation.y = i * 0.47;
  }
  if (size > 6) {
    for (let i = 0; i < 3; i++) {
      const a = rand(0, 6.28);
      beam(
        g,
        '#65583d',
        [0, size * 0.3, 0],
        [Math.sin(a) * size * 0.16, size * 0.35, Math.cos(a) * size * 0.16],
        size * 0.04,
      );
    }
  }
}
function birch(parent: T.Object3D, x: number, z: number, size: number): void {
  box(parent, '#a6a28a', x, size * 0.43, z, 0.22, size * 0.86, 0.25);
  for (let i = 0; i < 6; i++)
    box(parent, '#5c5e48', x + 0.115, size * (0.1 + i * 0.115), z, 0.03, 0.1, 0.23);
  for (let i = 0; i < 4; i++)
    mesh(
      parent,
      rockGeo,
      ['#778450', '#899351', '#6c7b48'][i % 3],
      x + rand(-0.7, 0.7),
      size * (0.63 + i * 0.095),
      z + rand(-0.5, 0.5),
      size * 0.24,
      size * 0.22,
      size * 0.22,
    );
}
function rock(parent: T.Object3D, x: number, z: number, size: number): void {
  const m = mesh(
    parent,
    rockGeo,
    ['#6a7164', '#7c8172', '#585f58', '#8a8c77'][Math.floor(random() * 4)],
    x,
    size * 0.29 - 0.04,
    z,
    size,
    size * rand(0.55, 0.9),
    size * 0.8,
  );
  m.rotation.set(rand(-0.2, 0.2), rand(0, 6.28), rand(-0.15, 0.15));
  if (size > 0.7 && random() > 0.4)
    mesh(parent, rockGeo, '#77804e', x - 0.12, size * 0.72, z - 0.1, size * 0.6, 0.12, size * 0.52);
}
export function character(zombie = false): T.Group {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  box(body, zombie ? '#667c66' : '#c99051', 0, 0.83, 0, 0.43, 0.56, 0.28);
  box(body, zombie ? '#8b9b75' : '#dfb78c', 0, 1.28, 0, 0.34, 0.35, 0.33);
  box(body, zombie ? '#414d3f' : '#493f33', 0, 1.46, -0.025, 0.37, 0.13, 0.35);
  if (!zombie) {
    box(body, '#c6ae7b', 0, 1.48, 0.02, 0.47, 0.08, 0.42);
    box(body, '#bbb291', 0, 1.56, -0.03, 0.31, 0.13, 0.27);
    box(body, '#756b46', 0, 0.84, -0.21, 0.33, 0.43, 0.2);
    box(body, '#e1c795', 0, 0.65, -0.26, 0.39, 0.11, 0.13);
  }
  box(body, '#282f28', -0.085, 1.3, 0.171, 0.04, 0.055, 0.025);
  box(body, '#282f28', 0.085, 1.3, 0.171, 0.04, 0.055, 0.025);
  const legs: T.Group[] = [];
  for (const x of [-0.12, 0.12]) {
    const leg = new T.Group();
    leg.position.set(x, 0.56, 0);
    body.add(leg);
    box(leg, zombie ? '#444d43' : '#435559', 0, -0.19, 0, 0.16, 0.4, 0.18);
    box(leg, '#3c3c31', 0, -0.4, 0.06, 0.18, 0.12, 0.29);
    legs.push(leg);
  }
  for (const x of [-0.29, 0.29]) {
    const arm = box(
      body,
      zombie ? '#748567' : '#ba8a53',
      x,
      0.89,
      zombie ? 0.2 : 0.02,
      0.15,
      0.42,
      0.17,
    );
    if (zombie) arm.rotation.x = -1.1;
  }
  let gun: T.Mesh | null = null;
  if (!zombie) {
    gun = box(body, '#393d35', 0.31, 0.83, 0.34, 0.12, 0.12, 0.57);
    box(body, '#8d7753', 0.31, 0.78, 0.15, 0.14, 0.16, 0.18);
  }
  g.userData = { body, legs, gun };
  return g;
}
// Enemy bodies merge into one vertex-colored mesh per body plus two legs, keeping
// four draw calls per enemy while still allowing the walking animation.
const enemySkin = new T.MeshStandardMaterial({
  vertexColors: true,
  flatShading: true,
  roughness: 1,
});
const enemyGlow = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
export const enemyMaterials = { skin: enemySkin, glow: enemyGlow };
function placedPart(
  geo: T.BufferGeometry,
  color: string | number,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  rx = 0,
  ry = 0,
  rz = 0,
): T.BufferGeometry {
  const g = geo.clone();
  g.applyMatrix4(
    new T.Matrix4().compose(
      new T.Vector3(x, y, z),
      new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)),
      new T.Vector3(sx, sy, sz),
    ),
  );
  const c = new T.Color(color),
    count = g.attributes.position.count,
    colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new T.BufferAttribute(colors, 3));
  return g;
}
function skinMesh(geometry: T.BufferGeometry): T.Mesh {
  const m = new T.Mesh(geometry, enemySkin);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
export function enemyModel(type: EnemyId): T.Group {
  const g = new T.Group(),
    body = new T.Group();
  g.add(body);
  const parts: T.BufferGeometry[] = [],
    glow: T.BufferGeometry[] = [],
    legs: T.Group[] = [];
  const add = (geo: T.BufferGeometry, color: string | number, ...t: PlacedArgs) =>
    parts.push(placedPart(geo, color, ...t));
  const leg = (x: number, pants: string, boot: string, scale = 1) => {
    const pivot = new T.Group();
    pivot.position.set(x, 0.56, 0);
    body.add(pivot);
    pivot.add(
      skinMesh(
        mergeGeometries([
          placedPart(boxGeo, pants, 0, -0.19 * scale, 0, 0.16, 0.4 * scale, 0.18),
          placedPart(boxGeo, boot, 0, -0.4 * scale, 0.06, 0.18, 0.12, 0.29),
        ]),
      ),
    );
    legs.push(pivot);
  };
  if (type === 'runner') {
    add(boxGeo, '#9c4f3a', 0, 0.86, 0.05, 0.34, 0.52, 0.22, 0.3);
    add(boxGeo, '#8a4433', 0, 1.02, -0.12, 0.37, 0.16, 0.05);
    add(boxGeo, '#9aa87e', 0, 1.27, 0.2, 0.29, 0.32, 0.28, 0.22);
    add(boxGeo, '#6f7a5b', 0, 1.44, 0.1, 0.33, 0.1, 0.3, 0.22);
    add(boxGeo, '#2c332b', -0.08, 1.3, 0.335, 0.045, 0.05, 0.02, 0.22);
    add(boxGeo, '#2c332b', 0.08, 1.3, 0.335, 0.045, 0.05, 0.02, 0.22);
    for (const x of [-0.25, 0.25]) add(boxGeo, '#8a5f42', x, 0.95, -0.18, 0.12, 0.4, 0.14, 0.85);
    leg(-0.11, '#3f4238', '#35362c', 0.9);
    leg(0.11, '#3f4238', '#35362c', 0.9);
  } else if (type === 'brute') {
    add(boxGeo, '#5d6b62', 0, 0.92, 0, 0.62, 0.66, 0.38);
    add(boxGeo, '#7a857c', 0, 0.98, 0.21, 0.44, 0.42, 0.06);
    add(boxGeo, '#4a5450', -0.42, 1.16, 0, 0.3, 0.22, 0.42);
    add(boxGeo, '#4a5450', 0.42, 1.16, 0, 0.3, 0.22, 0.42);
    add(boxGeo, '#7d8f72', 0, 1.44, 0.02, 0.36, 0.3, 0.33);
    add(boxGeo, '#4f5b56', 0, 1.62, 0, 0.45, 0.18, 0.42);
    add(boxGeo, '#3c4642', 0, 1.44, 0.2, 0.3, 0.07, 0.03);
    add(boxGeo, '#87927f', -0.42, 1.05, 0.16, 0.24, 0.34, 0.1);
    add(boxGeo, '#87927f', 0.42, 1.05, 0.16, 0.24, 0.34, 0.1);
    for (const x of [-0.4, 0.4]) add(boxGeo, '#6f7d6a', x, 0.84, 0.04, 0.22, 0.48, 0.24, 0.3);
    leg(-0.17, '#454f43', '#33392f', 1.05);
    leg(0.17, '#454f43', '#33392f', 1.05);
  } else if (type === 'spitter') {
    add(boxGeo, '#8fa06a', 0, 0.88, 0, 0.5, 0.58, 0.34);
    add(boxGeo, '#788a58', 0, 0.78, -0.2, 0.46, 0.36, 0.22);
    add(boxGeo, '#a3b37e', 0, 1.32, 0.06, 0.3, 0.3, 0.27);
    add(boxGeo, '#5c6b48', 0, 1.5, 0.08, 0.34, 0.12, 0.3);
    add(boxGeo, '#38412f', -0.075, 1.35, 0.2, 0.04, 0.05, 0.02, 0.22);
    add(boxGeo, '#38412f', 0.075, 1.35, 0.2, 0.04, 0.05, 0.02, 0.22);
    for (const x of [-0.24, 0.24]) add(boxGeo, '#7c8f5c', x, 1, 0.17, 0.1, 0.36, 0.12, 0.55);
    add(boxGeo, '#5c6b48', 0, 0.98, 0.24, 0.22, 0.16, 0.14, 0.4);
    leg(-0.13, '#4c5940', '#3a4432');
    leg(0.13, '#4c5940', '#3a4432');
    glow.push(placedPart(boxGeo, '#b6d06a', 0, 0.82, -0.33, 0.24, 0.18, 0.05));
  } else if (type === 'stalker') {
    add(boxGeo, '#3d4a3a', 0, 0.62, -0.06, 0.58, 0.28, 0.32, 0.35);
    add(boxGeo, '#2f3a2e', 0, 0.92, 0.24, 0.3, 0.26, 0.24, 0.55);
    add(boxGeo, '#46543f', 0, 0.74, -0.32, 0.16, 0.14, 0.3, 0.8);
    for (const x of [-0.22, 0.22]) add(boxGeo, '#2f3a2e', x, 0.68, 0.22, 0.1, 0.34, 0.11, 0.8);
    leg(-0.2, '#2b342a', '#222a22', 0.7);
    leg(0.2, '#2b342a', '#222a22', 0.7);
    glow.push(placedPart(boxGeo, '#9be06e', -0.075, 0.94, 0.35, 0.05, 0.04, 0.02));
    glow.push(placedPart(boxGeo, '#9be06e', 0.075, 0.94, 0.35, 0.05, 0.04, 0.02));
  } else if (type === 'alpha') {
    add(boxGeo, '#3b4a3e', 0, 1, 0, 0.6, 0.82, 0.4);
    add(boxGeo, '#2f3c33', 0, 1.16, 0.22, 0.5, 0.52, 0.07);
    add(boxGeo, '#597348', -0.3, 1.36, 0, 0.24, 0.16, 0.5);
    add(boxGeo, '#597348', 0.3, 1.36, 0, 0.24, 0.16, 0.5);
    add(boxGeo, '#46543f', 0, 1.62, 0.05, 0.38, 0.38, 0.36);
    add(boxGeo, '#39463c', 0, 1.86, 0.02, 0.3, 0.12, 0.28);
    for (const [x, rz] of [
      [-0.17, 0.42],
      [0.17, -0.42],
    ])
      add(new T.ConeGeometry(0.055, 0.52, 4), '#8b7f5c', x, 2.08, 0.02, 1, 1, 1, 0, 0, rz);
    for (const x of [-0.34, 0.34]) add(boxGeo, '#31402f', x, 1.02, 0.14, 0.18, 0.62, 0.2, 1.32);
    add(boxGeo, '#2c392e', -0.14, 0.5, 0, 0.21, 0.5, 0.24);
    add(boxGeo, '#2c392e', 0.14, 0.5, 0, 0.21, 0.5, 0.24);
    glow.push(placedPart(boxGeo, '#ffce6e', -0.1, 1.65, 0.25, 0.055, 0.045, 0.02));
    glow.push(placedPart(boxGeo, '#ffce6e', 0.1, 1.65, 0.25, 0.055, 0.045, 0.02));
    leg(-0.16, '#2c392e', '#232d25', 1.1);
    leg(0.16, '#2c392e', '#232d25', 1.1);
  } else {
    add(boxGeo, '#667c66', 0, 0.83, 0, 0.43, 0.56, 0.28);
    add(boxGeo, '#8b9b75', 0, 1.28, 0, 0.34, 0.35, 0.33);
    add(boxGeo, '#414d3f', 0, 1.46, -0.025, 0.37, 0.13, 0.35);
    add(boxGeo, '#c9d2b8', -0.085, 1.3, 0.171, 0.04, 0.055, 0.025);
    add(boxGeo, '#c9d2b8', 0.085, 1.3, 0.171, 0.04, 0.055, 0.025);
    add(boxGeo, '#55634f', 0, 0.86, 0.0, 0.45, 0.12, 0.3);
    for (const x of [-0.29, 0.29]) add(boxGeo, '#748567', x, 0.89, 0.2, 0.15, 0.42, 0.17, -1.1);
    leg(-0.12, '#444d43', '#3c3c31');
    leg(0.12, '#444d43', '#3c3c31');
  }
  const skin = skinMesh(mergeGeometries(parts));
  body.add(skin);
  if (glow.length) body.add(new T.Mesh(mergeGeometries(glow), enemyGlow));
  g.userData = { body, legs };
  return g;
}
function camper(parent: T.Object3D): T.Group {
  const g = new T.Group();
  parent.add(g);
  g.position.set(-1, 0, -1.6);
  g.rotation.y = -0.06;
  box(g, '#3f453e', 0, 0.55, 0, 8.3, 0.33, 2.8);
  box(g, '#d8d3b5', -0.55, 1.78, 0, 6.85, 2.2, 2.9);
  box(g, '#e5dfc6', -0.55, 2.9, 0, 7.12, 0.2, 3.03);
  box(g, '#bc6138', -0.52, 0.99, 0, 6.94, 0.48, 2.98);
  box(g, '#dfb278', -0.52, 1.32, 1.5, 6.92, 0.075, 0.025);
  box(g, '#d9d4b8', 3.46, 1.24, 0, 1.7, 1.02, 2.84);
  box(g, '#d4cdb0', 3.15, 2.05, 0, 1.05, 1, 2.78);
  box(g, '#ede6c9', 3.1, 2.63, 0, 1.4, 0.16, 2.9);
  box(g, '#2b4341', 3.75, 2.1, 0, 0.055, 0.76, 2.31);
  box(g, '#303f3c', 3.2, 2.08, 1.403, 0.8, 0.7, 0.025);
  box(g, '#303f3c', 3.2, 2.08, -1.403, 0.8, 0.7, 0.025);
  box(g, '#9c643e', 3.38, 0.96, 1.46, 1.56, 0.28, 0.05);
  for (const z of [-1.5, 1.5]) {
    for (const x of [-2.84, 2.8]) {
      const tire = mesh(g, new T.CylinderGeometry(0.57, 0.57, 0.3, 12), '#303632', x, 0.59, z);
      tire.rotation.x = Math.PI / 2;
      const rim = mesh(g, new T.CylinderGeometry(0.29, 0.29, 0.32, 10), '#9a9b89', x, 0.59, z);
      rim.rotation.x = Math.PI / 2;
      const hub = mesh(g, new T.CylinderGeometry(0.12, 0.12, 0.34, 8), '#505b56', x, 0.59, z);
      hub.rotation.x = Math.PI / 2;
    }
    for (const x of [-2.65, -0.7]) {
      box(g, '#aea98f', x, 2.13, z, 1.6, 0.89, 0.07);
      box(g, '#293e3c', x, 2.14, z * 1.026, 1.4, 0.69, 0.04);
      box(g, '#6d8280', x - 0.12, 2.38, z * 1.042, 1.12, 0.09, 0.012);
      box(g, '#c5c0a1', x + 0.49, 2.13, z * 1.047, 0.08, 0.72, 0.02);
    }
  }
  box(g, '#bdb79b', 1.02, 1.78, 1.505, 0.95, 1.99, 0.06);
  box(g, '#e1d8b8', 1.02, 1.77, 1.547, 0.79, 1.8, 0.04);
  box(g, '#324440', 1.02, 2.22, 1.58, 0.55, 0.63, 0.04);
  box(g, '#625e4c', 1.29, 1.62, 1.59, 0.08, 0.08, 0.04);
  box(g, '#7e8070', 1.03, 0.5, 1.84, 1.15, 0.15, 0.56);
  box(g, '#aaa892', -0.7, 3.12, -0.25, 1.28, 0.3, 0.88);
  box(g, '#686f63', -0.7, 3.29, -0.25, 0.94, 0.04, 0.68);
  for (let i = 0; i < 5; i++) box(g, '#969d8c', -0.7, 3.32, -0.5 + i * 0.12, 0.94, 0.025, 0.025);
  box(g, '#3f575b', -2.63, 3.04, -0.14, 1.54, 0.09, 1.7);
  for (let i = 0; i < 4; i++) box(g, '#7b9693', -3.17 + i * 0.36, 3.1, -0.14, 0.025, 0.018, 1.59);
  for (let i = 0; i < 3; i++) box(g, '#7b9693', -2.63, 3.1, -0.68 + i * 0.54, 1.48, 0.018, 0.025);
  for (let z of [-1.08, 1.08]) {
    box(g, '#ffda91', 4.32, 1.3, z, 0.06, 0.26, 0.38, true);
    box(g, '#be6f3c', -4.02, 1.05, z, 0.05, 0.25, 0.24);
  }
  box(g, '#73796d', 4.36, 0.89, 0, 0.16, 0.21, 2.98);
  box(g, '#404943', 4.39, 1.13, 0, 0.03, 0.23, 1.3);
  for (let i = 0; i < 4; i++) box(g, '#899080', 4.42, 1.06 + i * 0.047, 0, 0.02, 0.014, 1.23);
  // Rear ladder, roof rail, and luggage make the silhouette read at pixel scale.
  for (const z of [-0.7, 0.1]) beam(g, '#8d9484', [-4.05, 0.8, z], [-4.05, 3.25, z], 0.065);
  for (let i = 0; i < 8; i++) box(g, '#9ba18d', -4.05, 1 + i * 0.29, -0.3, 0.08, 0.055, 0.85);
  for (const z of [-1.28, 1.28]) beam(g, '#9da28e', [-3.6, 3.19, z], [2.45, 3.19, z], 0.05);
  for (const x of [-3.6, 2.45])
    for (const z of [-1.28, 1.28]) box(g, '#9da28e', x, 3.08, z, 0.05, 0.24, 0.05);
  box(g, '#867a53', 1.33, 3.16, -0.26, 1.1, 0.4, 0.82);
  box(g, '#5c6550', 1.32, 3.16, -0.26, 0.11, 0.43, 0.86);
  return g;
}
function tent(parent: T.Object3D, x: number, z: number, color: string, angle: number): void {
  const g = new T.Group();
  parent.add(g);
  g.position.set(x, 0, z);
  g.rotation.y = angle;
  const shape = new T.Shape();
  shape.moveTo(-1.45, 0);
  shape.lineTo(0, 2.25);
  shape.lineTo(1.45, 0);
  shape.closePath();
  const geo = new T.ExtrudeGeometry(shape, { depth: 2.8, bevelEnabled: false });
  mesh(g, geo, color, 0, 0.06, -1.4);
  const opening = new T.Shape();
  opening.moveTo(-0.91, 0);
  opening.lineTo(0, 1.68);
  opening.lineTo(0.91, 0);
  opening.closePath();
  mesh(g, new T.ShapeGeometry(opening), '#28362a', 0, 0.09, 1.405);
  beam(g, '#d3b17d', [0, 2.31, -1.5], [0, 2.31, 1.58], 0.08);
  beam(g, '#c7b57f', [0, 0.05, 1.58], [0, 2.31, 1.58], 0.06);
  for (const a of [-1, 1]) {
    beam(g, '#b8aa76', [a * 0.6, 1.4, 1.3], [a * 1.9, 0.06, 2.04], 0.02);
    box(g, '#615744', a * 1.9, 0.12, 2.04, 0.07, 0.24, 0.07);
  }
  box(g, '#998c57', 0, 0.04, 1.98, 1.6, 0.025, 1);
}
export function structure(type: BuildingType, level = 1): T.Group {
  const g = new T.Group();
  if (type === 'fence') {
    const post = level >= 3 ? 1.72 : level >= 2 ? 1.52 : 1.35;
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * 0.44;
      box(g, i % 2 ? '#9b7b4c' : '#aa8957', x, post / 2, 0, 0.28, post, 0.24);
      mesh(
        g,
        new T.ConeGeometry(level >= 2 ? 0.23 : 0.2, level >= 2 ? 0.34 : 0.27, 4),
        '#b59863',
        x,
        post + 0.13,
        0,
      ).rotation.y = Math.PI / 4;
    }
    for (const y of [0.45, 1.03]) box(g, '#6e593a', 0, y, -0.19, 3.25, 0.17, 0.15);
    if (level >= 2) {
      box(g, '#7d6742', 0, post - 0.14, -0.02, 3.25, 0.12, 0.2);
      for (const x of [-1.98, 0.66]) {
        beam(g, '#8a7045', [x, 0.1, 0.2], [x + 1.32, 1.18, 0.2], 0.1);
        beam(g, '#8a7045', [x, 1.18, 0.2], [x + 1.32, 0.1, 0.2], 0.1);
      }
    }
    if (level >= 3) {
      box(g, '#5d6546', 0, post + 0.05, 0, 3.42, 0.12, 0.32);
      for (const x of [-1.42, 1.42]) {
        box(g, '#676b54', x, (post + 0.52) / 2, 0, 0.34, post + 0.52, 0.3);
        box(g, '#929a90', x, post + 0.6, 0, 0.42, 0.16, 0.38);
      }
    }
  } else if (type === 'tower') {
    const top = level >= 3 ? 5.7 : level >= 2 ? 4.75 : 3.8;
    const deck = top - 0.64;
    for (const x of [-0.94, 0.94])
      for (const z of [-0.85, 0.85]) {
        beam(g, '#887047', [x * 1.1, 0, z * 1.1], [x, top, z], 0.2);
        box(g, '#afa38a', x * 1.1, 0.13, z * 1.1, 0.43, 0.26, 0.43);
      }
    for (const z of [-0.85, 0.85]) {
      beam(g, '#a18a59', [-1, 0.6, z], [1, top - 0.85, z], 0.13);
      beam(g, '#79633f', [1, 0.6, z], [-1, top - 0.85, z], 0.13);
    }
    if (level >= 2) {
      box(g, '#79633f', 0, deck - 0.18, 0, 3, 0.22, 2.85);
      for (const z of [-0.85, 0.85])
        beam(g, '#8a7045', [-1.04, deck * 0.5, z], [1.04, deck * 0.5, z], 0.11);
    }
    for (let i = 0; i < 9; i++)
      box(g, i % 2 ? '#ae905e' : '#9f8455', 0, deck, (i - 4) * 0.26, 2.5, 0.17, 0.23);
    for (const x of [-1.08, 1.08]) {
      box(g, '#b19766', x, deck + 0.59, 0, 0.13, 0.97, 2.25);
      box(g, '#d3b37a', x, deck + 1.12, 0, 0.2, 0.15, 2.5);
    }
    box(g, '#b79b6a', 0, deck + 0.6, -1.09, 2.13, 0.94, 0.14);
    box(g, '#d3b37a', 0, deck + 1.12, -1.1, 2.5, 0.15, 0.21);
    if (level >= 2)
      for (const x of [-1.08, 1.08])
        for (const z of [-1.09, 1.09]) box(g, '#8a7045', x, deck + 0.86, z, 0.15, 0.5, 0.15);
    for (const x of [-0.47, 0.47]) beam(g, '#bda476', [x, 0.1, 1.62], [x, deck + 0.2, 1.05], 0.095);
    const steps = Math.max(9, Math.ceil((deck - 0.5) / 0.35));
    for (let i = 0; i < steps; i++)
      box(g, '#ccb182', 0, 0.2 + (i * (deck - 0.5)) / (steps - 1), 1.58 - i * 0.06, 1, 0.07, 0.1);
    const guard = character();
    guard.position.set(0, deck + 0.11, 0);
    guard.scale.setScalar(0.78);
    g.add(guard);
    const flag = level >= 3 ? '#a8452f' : '#b66d42';
    const flags: [number, string][] = [[-0.8, flag]];
    if (level >= 2) flags.push([0.8, level >= 3 ? flag : '#6f8fa8']);
    for (const [z, color] of flags) {
      box(g, '#5d6546', 1.05, deck + 1.64, z, 0.065, 1.5, 0.065);
      box(g, color, 1.38, deck + 2.09, z, 0.66, 0.41, 0.045);
    }
    if (level >= 3) {
      box(g, '#5d6546', 0, deck + 1.6, 0, 0.12, 0.4, 0.12);
      box(g, '#a88b52', 0, deck + 1.86, 0, 0.62, 0.12, 0.62);
      box(g, '#ffe0a0', 0, deck + 2.26, 0, 0.52, 0.68, 0.52, true);
      for (const [x, z] of [
        [-0.26, -0.26],
        [0.26, -0.26],
        [-0.26, 0.26],
        [0.26, 0.26],
      ])
        box(g, '#5d6546', x, deck + 2.26, z, 0.06, 0.78, 0.06);
      box(g, '#6b5539', 0, deck + 2.7, 0, 0.74, 0.13, 0.74);
      box(g, '#a88b52', 0, deck + 2.8, 0, 0.12, 0.12, 0.12);
    }
  } else {
    const post = level >= 3 ? 4.15 : level >= 2 ? 3.6 : 3.1;
    const lamp = level >= 2 ? 1.16 : 1;
    const lampY = post - 0.57;
    box(g, '#676b54', 0, 0.1, 0, 0.6, 0.2, 0.6);
    if (level >= 3) mesh(g, new T.CylinderGeometry(0.5, 0.66, 0.42, 9), '#676b54', 0, 0.21, 0);
    box(
      g,
      '#846f49',
      0,
      post / 2 + 0.05,
      0,
      level >= 2 ? 0.19 : 0.15,
      post,
      level >= 2 ? 0.19 : 0.15,
    );
    for (const side of level >= 2 ? [-1, 1] : [1]) {
      beam(g, '#a28c5a', [0, post, 0], [side * 0.9, post, 0], 0.12);
      box(g, '#544e37', side * 0.78, lampY + 0.3 * lamp, 0, 0.035, 0.52 * lamp, 0.035);
      box(g, '#ffe0a0', side * 0.78, lampY, 0, 0.34 * lamp, 0.43 * lamp, 0.34 * lamp, true);
      for (const y of [lampY - 0.25 * lamp, lampY + 0.24 * lamp])
        box(g, '#62573c', side * 0.78, y, 0, 0.45 * lamp, 0.08, 0.45 * lamp);
      for (const x of [side * 0.78 - 0.19 * lamp, side * 0.78 + 0.19 * lamp])
        for (const z of [-0.19, 0.19]) box(g, '#6c5a3b', x, lampY, z, 0.035, 0.43 * lamp, 0.035);
    }
    if (level >= 3) {
      box(g, '#544e37', 0, post + 0.42, 0, 0.06, 0.8, 0.06);
      box(g, '#62573c', 0, post + 0.9, 0, 0.46, 0.08, 0.46);
      box(g, '#ffe0a0', 0, post + 1.16, 0, 0.34, 0.42, 0.34, true);
      for (const [x, z] of [
        [-0.18, -0.18],
        [0.18, -0.18],
        [-0.18, 0.18],
        [0.18, 0.18],
      ])
        box(g, '#6c5a3b', x, post + 1.16, z, 0.03, 0.46, 0.03);
      box(g, '#544e37', 0, post + 1.44, 0, 0.52, 0.1, 0.52);
      box(g, '#846f49', 0, post + 1.52, 0, 0.07, 0.1, 0.07);
    }
  }
  return g;
}

export function setLogState(log: WorldLog, remaining: number): void {
  const trunk = log.trunk;
  if (!trunk) return;
  const s = Math.max(0, Math.min(1, remaining / freshLogSwings()));
  if (!s) {
    trunk.visible = false;
    return;
  }
  trunk.visible = true;
  trunk.scale.set(0.82 + 0.18 * s, s, 0.82 + 0.18 * s);
  trunk.position.x = -1.6 * (1 - s);
}
interface StaticBatch {
  material: T.Material;
  geos: T.BufferGeometry[];
  cast: boolean;
}
function mergeStatic(group: T.Group): void {
  group.updateMatrixWorld(true);
  const batches = new Map<string, StaticBatch>();
  group.traverse((o) => {
    const mesh = o as T.Mesh;
    if (!mesh.isMesh) return;
    const material = mesh.material as T.Material;
    const key = material.uuid;
    if (!batches.has(key)) batches.set(key, { material, geos: [], cast: mesh.castShadow });
    const geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    if (geo.index) {
      const flat = geo.toNonIndexed();
      geo.dispose();
      batches.get(key)!.geos.push(flat);
    } else batches.get(key)!.geos.push(geo);
  });
  group.clear();
  for (const { material, geos, cast } of batches.values()) {
    const m = new T.Mesh(mergeGeometries(geos), material);
    m.castShadow = cast;
    m.receiveShadow = !(material as T.MeshBasicMaterial).isMeshBasicMaterial;
    group.add(m);
    geos.forEach((g) => g.dispose());
  }
}
// Deform the already-batched vegetation on the GPU; shadows use the same wind.
function animateVegetation(group: T.Group, wind: Wind, grass = false): void {
  mergeStatic(group);
  const deformation = `
    float phase = position.x * .17 + position.z * .13;
    float breeze = sin(windTime * .85 + phase) * .7 + sin(windTime * 1.37 + phase * 1.8) * .3;
    float weight = ${grass ? 'max(position.y, 0.) * .38' : 'pow(max(position.y, 0.), 2.) * .007'};
    transformed.x += breeze * weight * windStrength;
    transformed.z += sin(windTime * .68 + phase + 1.2) * weight * .55 * windStrength;
  `;
  const patch = (shader: T.WebGLProgramParametersWithUniforms) => {
    shader.uniforms.windTime = wind.time;
    shader.uniforms.windStrength = wind.strength;
    shader.vertexShader =
      'uniform float windTime; uniform float windStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n' + deformation,
    );
  };
  for (const child of group.children) {
    const batch = child as T.Mesh;
    const material = (batch.material as T.Material).clone();
    material.onBeforeCompile = patch;
    material.customProgramCacheKey = () => `pinefall-wind-${grass}`;
    batch.material = material;
    const depthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    depthMaterial.onBeforeCompile = patch;
    depthMaterial.customProgramCacheKey = () => `pinefall-wind-depth-${grass}`;
    batch.customDepthMaterial = depthMaterial;
    batch.geometry.computeBoundingSphere();
    batch.geometry.boundingSphere!.radius += 1;
  }
}
export function makeWorld(scene: T.Scene): World {
  const fixed = new T.Group(),
    forest = new T.Group(),
    meadow = new T.Group();
  scene.add(fixed, forest, meadow);
  const wind: Wind = { time: { value: 0 }, strength: { value: 1 }, dir: { x: 0, z: 0 } };
  const ground = mesh(
    fixed,
    new T.PlaneGeometry(MAP.size, MAP.size),
    new T.MeshStandardMaterial({ map: groundTexture(), roughness: 1 }),
    0,
    -0.07,
    0,
  ) as T.Mesh<T.PlaneGeometry, T.MeshStandardMaterial>;
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  // Canvas rows follow world +Z after the plane is rotated.
  ground.material.map!.flipY = false;
  const trees: Tree[] = [];
  for (let i = 0; i < 5800; i++) {
    const x = rand(-89, 89),
      z = rand(-89, 89);
    if (x > shore(z) - 1.1 || isClearing(x, z) || (x * x) / 215 + (z * z) / 162 < 1) continue;
    if (trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < 2.7)) continue;
    const size = rand(3.9, 8.7),
      front = z > 12 && Math.abs(x) < 13;
    if (front && random() < 0.3) continue;
    if (random() < 0.09) birch(forest, x, z, size * 0.76);
    else pine(forest, x, z, front ? size * 0.83 : size);
    trees.push({ x, z, r: 0.33 });
  }
  for (let i = 0; i < 1000; i++) {
    const x = rand(-89, 89),
      z = rand(-89, 89);
    if (x > shore(z) - 0.8 || (Math.abs(x) < 5 && Math.abs(z) < 7)) continue;
    if (isClearing(x, z) && random() < 0.82) continue;
    rock(fixed, x, z, rand(0.12, 0.5));
  }
  // Angular boulders hug the irregular shoreline, with pale shingle underneath.
  for (let z = -89; z < 89; z += 0.8) {
    const x = shore(z);
    rock(fixed, x + rand(-0.3, 0.4), z, rand(0.55, 1.3));
    if (random() > 0.45) rock(fixed, x - 0.8, z + 0.3, rand(0.2, 0.55));
  }
  const flowerGeo = new T.PlaneGeometry(0.075, 0.22);
  flowerGeo.translate(0, 0.11, 0);
  const stems: { x: number; z: number }[] = [];
  for (let i = 0; i < 16000; i++) {
    const x = rand(-89, 89),
      z = rand(-89, 89);
    if (x > shore(z) - 0.8 || (isClearing(x, z) && random() < 0.93)) continue;
    const stalk = mesh(meadow, flowerGeo, ['#9b9e5e', '#81904c', '#536e40'][i % 3], x, 0, z);
    stalk.rotation.y = rand(0, 6.28);
    if (i % 4 === 0) {
      box(meadow, i % 8 === 0 ? '#d9d1a0' : '#b6b882', x, 0.24, z, 0.1, 0.07, 0.1);
      stems.push({ x, z });
    }
  }
  camper(fixed);
  tent(fixed, -5.5, 4.1, '#7c8850', -0.2);
  tent(fixed, 5.2, 4.3, '#c2753e', 0.22);
  // Window glow overlay for the RV: only night-time, driven by lamp and installed modules.
  const rvGlow = rvWindowGlow(scene);
  // Campfire: stone ring, charred logs, glowing coals.
  const fireAt = new T.Vector3(0.1, 0, 5.6);
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2;
    rock(fixed, fireAt.x + Math.cos(a) * 0.88, fireAt.z + Math.sin(a) * 0.88, rand(0.2, 0.31));
  }
  for (let i = 0; i < 4; i++) {
    const log = box(fixed, '#59452d', 0.1, 0.18, 5.6, 0.22, 0.22, 1.45);
    log.rotation.y = (i * Math.PI) / 4;
  }
  mesh(
    fixed,
    new T.CylinderGeometry(0.59, 0.68, 0.05, 9),
    '#e78c35',
    0.1,
    0.09,
    5.6,
    1,
    1,
    1,
    true,
  );
  const flames = new T.Group();
  flames.position.copy(fireAt);
  scene.add(flames);
  for (let i = 0; i < 7; i++) {
    const f = mesh(
      flames,
      new T.ConeGeometry(0.25, 1, 5),
      i % 2 ? '#ffce61' : '#fff0a7',
      rand(-0.3, 0.3),
      rand(0.3, 0.65),
      rand(-0.3, 0.3),
      rand(0.6, 1),
      rand(0.65, 1.3),
      rand(0.6, 1),
      true,
    );
    f.userData.seed = random() * 10;
    f.userData.baseX = f.position.x;
    f.userData.baseZ = f.position.z;
  }
  const fireLight = new T.PointLight('#ffb84f', 30, 18, 1.5);
  fireLight.position.set(0.1, 1.7, 5.6);
  scene.add(fireLight);
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = 128;
  haloCanvas.height = 128;
  const hc = haloCanvas.getContext('2d')!;
  const grad = hc.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,172,63,.36)');
  grad.addColorStop(0.3, 'rgba(255,143,28,.14)');
  grad.addColorStop(1, 'rgba(255,139,24,0)');
  hc.fillStyle = grad;
  hc.fillRect(0, 0, 128, 128);
  const halo = new T.Sprite(
    new T.SpriteMaterial({
      map: new T.CanvasTexture(haloCanvas),
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
    }),
  );
  halo.position.set(0.1, 0.8, 5.6);
  halo.scale.set(6, 6, 1);
  scene.add(halo);
  // Folding chairs, cooler, mugs, crates and a wood pile.
  for (const [x, z, a] of [
    [-2.1, 6.3, -0.85],
    [2.5, 6.6, 0.8],
  ]) {
    const chair = new T.Group();
    fixed.add(chair);
    chair.position.set(x, 0, z);
    chair.rotation.y = a;
    for (const sx of [-0.39, 0.39]) {
      beam(chair, '#b1ae91', [sx, 0.05, -0.4], [sx, 0.76, 0.4], 0.045);
      beam(chair, '#b1ae91', [sx, 0.05, 0.4], [sx, 0.8, -0.4], 0.045);
      beam(chair, '#a3a48c', [sx, 0.5, -0.4], [sx, 1.25, -0.5], 0.045);
    }
    box(chair, '#a59460', 0, 0.61, 0, 0.79, 0.055, 0.77);
    const back = box(chair, '#b3a16b', 0, 1, -0.47, 0.78, 0.53, 0.05);
    back.rotation.x = -0.12;
  }
  box(fixed, '#577f79', -4.2, 0.3, 1.8, 0.9, 0.58, 0.55);
  box(fixed, '#d3ceb0', -4.2, 0.63, 1.8, 0.96, 0.12, 0.62);
  box(fixed, '#9e784c', -5.2, 0.34, -0.1, 0.9, 0.68, 0.83);
  for (let i = 0; i < 4; i++) box(fixed, '#c0a271', -5.2, 0.13 + i * 0.17, 0.32, 0.96, 0.05, 0.05);
  // Picnic table to the left of the RV.
  const table = new T.Group();
  table.position.set(-8.5, 0, -2.5);
  table.rotation.y = 0.22;
  fixed.add(table);
  for (let i = 0; i < 5; i++)
    box(table, i % 2 ? '#ae925b' : '#b69b63', (i - 2) * 0.25, 1.12, 0, 0.23, 0.13, 2.6);
  for (const x of [-1, 1]) box(table, '#a98b53', x, 0.61, 0, 0.45, 0.12, 2.8);
  for (const z of [-0.83, 0.83]) {
    beam(table, '#756744', [-0.8, 0, z], [0.45, 1.1, z], 0.13);
    beam(table, '#756744', [0.8, 0, z], [-0.45, 1.1, z], 0.13);
    box(table, '#7b6941', 0, 0.5, z, 2.3, 0.12, 0.15);
  }
  box(table, '#b65e3c', 0.1, 1.28, -0.4, 0.2, 0.25, 0.2);
  box(table, '#dfd5b0', 0.1, 1.42, -0.4, 0.2, 0.035, 0.2);
  box(table, '#d1c6a0', -0.2, 1.22, 0.55, 0.36, 0.05, 0.3);
  // Lantern by the RV door; it becomes a real warm light after dark.
  const lanternPost = new T.Group();
  fixed.add(lanternPost);
  lanternPost.position.set(1.82, 0, -0.1);
  lanternPost.rotation.y = 0.16;
  box(lanternPost, '#6b5a3d', 0, 1.55, 0, 0.12, 3.1, 0.12);
  beam(lanternPost, '#8d7a52', [0, 3.05, 0], [-0.55, 3.05, 0], 0.08);
  box(lanternPost, '#4d4936', -0.55, 2.92, 0, 0.3, 0.09, 0.3);
  box(lanternPost, '#ffe0a0', -0.55, 2.66, 0, 0.26, 0.34, 0.26, true);
  box(lanternPost, '#4d4936', -0.55, 2.42, 0, 0.3, 0.09, 0.3);
  const doorLight = new T.PointLight('#ffce7e', 0, 7.5, 1.6);
  doorLight.position.set(1.28, 2.62, -0.1);
  scene.add(doorLight);
  // Stepping stones from the side door to the fire pit.
  for (let i = 0; i < 6; i++) {
    const stone = mesh(
      fixed,
      new T.CylinderGeometry(0.23, 0.27, 0.05, 7),
      i % 2 ? '#9b917a' : '#8d8570',
      Math.sin(i * 1.7) * 0.28,
      0.02,
      1.35 + i * 0.62,
    );
    stone.rotation.y = i;
  }
  // Split firewood and a wheelbarrow fill the working corner of camp.
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) {
      const log = mesh(
        fixed,
        new T.CylinderGeometry(0.09, 0.09, 1.05, 7),
        row % 2 ? '#6f5838' : '#7a6240',
        3.3 + (i - (3 - row) / 2) * 0.2,
        0.1 + row * 0.19,
        3.35,
      );
      log.rotation.z = Math.PI / 2;
      log.rotation.y = 0.12;
    }
  const barrow = new T.Group();
  fixed.add(barrow);
  barrow.position.set(-3.55, 0, 1.55);
  barrow.rotation.y = -0.55;
  box(barrow, '#5f6a58', 0, 0.48, 0, 1.35, 0.32, 0.72);
  box(barrow, '#4b5344', 0, 0.66, 0, 1.24, 0.05, 0.6);
  beam(barrow, '#8a7452', [0.5, 0.55, -0.1], [0.42, 0.98, 0.5], 0.06);
  beam(barrow, '#8a7452', [-0.5, 0.55, -0.1], [-0.42, 0.98, 0.5], 0.06);
  const wheel = mesh(barrow, new T.CylinderGeometry(0.3, 0.3, 0.12, 10), '#333b36', 0.3, 0.3, 0.46);
  wheel.rotation.x = Math.PI / 2;
  // Mushroom clusters deepen the forest floor without adding collision noise.
  for (let i = 0; i < 15; i++) {
    const x = rand(-80, 80),
      z = rand(-80, 80);
    if (x > shore(z) - 2 || isClearing(x, z)) continue;
    const stem = 0.06 + random() * 0.06;
    mesh(fixed, new T.CylinderGeometry(0.035, 0.05, stem * 2, 6), '#d8cdae', x, stem, z);
    mesh(
      fixed,
      new T.ConeGeometry(0.13, 0.1, 7),
      i % 3 ? '#a8503c' : '#b8804a',
      x,
      stem * 2 + 0.03,
      z,
    );
  }
  // A canoe pulled up on the shingle.
  const canoe = new T.Group();
  fixed.add(canoe);
  canoe.position.set(shore(17) + 1.5, 0, 17);
  canoe.rotation.y = 0.35;
  box(canoe, '#8d5b3c', 0, 0.16, 0, 1.05, 0.3, 3.5);
  box(canoe, '#caa978', 0, 0.3, 0, 0.76, 0.06, 3.1);
  box(canoe, '#5e4630', -0.68, 0.34, 0, 0.14, 0.12, 1.25);
  box(canoe, '#5e4630', 0.68, 0.34, 0, 0.14, 0.12, 1.25);
  // Painted lane signs mark where each path meets the camp clearing.
  const signTexture = (label: string): T.CanvasTexture => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#9a7b4e';
    x.fillRect(0, 0, 256, 128);
    x.globalAlpha = 0.3;
    x.fillStyle = '#6f5836';
    for (let i = 0; i < 9; i++) x.fillRect(0, 8 + i * 14 + Math.sin(i) * 3, 256, 3);
    x.globalAlpha = 1;
    x.strokeStyle = '#5e4a30';
    x.lineWidth = 8;
    x.strokeRect(4, 4, 248, 120);
    x.fillStyle = '#33291c';
    x.font = 'bold 58px "DM Sans","Microsoft YaHei",sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(label, 128, 70);
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  };
  for (const [x, z, angle, label] of [
    [1.6, -10.6, 0, '北径'],
    [-14.6, 3.2, Math.PI / 2, '西径'],
    [11.6, 8.4, -Math.PI / 2, '东岸'],
  ] as const) {
    const sign = new T.Group();
    fixed.add(sign);
    sign.position.set(x, 0, z);
    sign.rotation.y = angle;
    box(sign, '#6b5a3d', 0, 1.05, 0, 0.11, 2.1, 0.11);
    const boardMat = new T.MeshStandardMaterial({ map: signTexture(label), roughness: 1 });
    mesh(sign, new T.PlaneGeometry(1.05, 0.52), boardMat, 0.0, 1.72, 0.06);
    mesh(sign, new T.PlaneGeometry(1.05, 0.52), boardMat, 0, 1.72, -0.06).rotation.y = Math.PI;
  }
  // String lights arc from campsite poles across the clearing.
  const bulbs: T.Mesh[] = [],
    pendants: T.Group[] = [];
  const wireMat = new T.LineBasicMaterial({ color: '#454f39' });
  for (const x of [-9, 8.8]) box(fixed, '#75623d', x, 2.3, 2, 0.12, 4.6, 0.12);
  const wire: T.Vector3[] = [];
  for (let i = 0; i <= 40; i++) {
    const p = new T.Vector3(-9 + (i / 40) * 17.8, 4.6 - Math.sin((i / 40) * Math.PI) * 1.05, 2);
    wire.push(p);
    if (i % 3 === 1) {
      const pendant = new T.Group();
      scene.add(pendant);
      pendant.position.copy(p);
      pendant.userData.fraction = i / 40;
      pendants.push(pendant);
      const bulb = box(pendant, '#ffe1a0', 0, -0.17, 0, 0.11, 0.18, 0.11, true);
      bulbs.push(bulb);
      beam(pendant, '#4f5239', [0, 0, 0], [0, -0.12, 0], 0.025);
    }
  }
  const lightWire = new T.Line(new T.BufferGeometry().setFromPoints(wire), wireMat);
  scene.add(lightWire);
  const logs: WorldLog[] = [];
  const logRoot = new T.Group();
  scene.add(logRoot);
  for (const [x, z, a] of [
    [-12, 7, -0.2],
    [10, -7, 0.4],
    [-8, -12, 1.1],
    [9, 14, 1.4],
  ]) {
    const g = new T.Group();
    logRoot.add(g);
    g.position.set(x, 0, z);
    g.rotation.y = a;
    const trunk = mesh(g, new T.CylinderGeometry(0.36, 0.43, 3.2, 7), '#695236', 0, 0.42, 0);
    trunk.rotation.z = Math.PI / 2;
    for (const side of [-1, 1])
      mesh(trunk, new T.CylinderGeometry(0.3, 0.3, 0.015, 9), '#b3a075', 0, side * 1.61, 0);
    beam(trunk, '#6f5838', [0.08, -0.3, 0], [0.68, -0.5, 0.5], 0.13);
    const stump = mesh(g, new T.CylinderGeometry(0.45, 0.5, 0.35, 7), '#6b5539', -1.72, 0.175, 0);
    mesh(stump, new T.CylinderGeometry(0.45, 0.45, 0.015, 7), '#b3a075', 0, 0.18, 0);
    const log: WorldLog = { x, z, remaining: freshLogSwings() };
    Object.defineProperties(log, { trunk: { value: trunk }, stump: { value: stump } });
    logs.push(log);
  }
  // Dock disappearing into the blue-green water.
  const dock = new T.Group();
  fixed.add(dock);
  dock.position.set(shore(14) + 0.4, 0, 14);
  dock.rotation.y = 0.12;
  for (let i = 0; i < 14; i++)
    box(dock, i % 3 ? '#96875e' : '#a9996a', i * 0.36, 0.13, 0, 0.33, 0.17, 2.25);
  for (const x of [0, 4.4])
    for (const z of [-1.03, 1.03]) {
      box(dock, '#675b40', x, 0.31, z, 0.19, 1.3, 0.19);
      box(dock, '#b4a17b', x, 1, z, 0.23, 0.09, 0.23);
    }
  // Shoreline water shader: softly moving faceted ripples and broken foam.
  const waterMat = new T.ShaderMaterial({
    uniforms: { time: { value: 0 }, day: { value: 1 } },
    vertexShader: `varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,
    fragmentShader: `varying vec3 world; uniform float time; uniform float day; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} void main(){float z=world.z;float edge=24.-.19*z+sin(z*.15)*2.2+sin(z*.41)*.6;float d=world.x-edge;if(d<0.)discard;vec2 p=floor(world.xz*5.)/5.;float n=sin(p.x*1.6+p.y*2.4+time*.7)*sin(p.y*3.7-time*.45);vec3 shallow=vec3(.27,.48,.43),deep=vec3(.12,.32,.34);vec3 c=mix(shallow,deep,smoothstep(0.,8.,d));c+=n*.018;float wave=sin(d*8.-time*1.4+sin(z*3.)*.5);if(d<.85&&wave>.66)c=mix(c,vec3(.67,.73,.57),.7);float shine=step(.974,hash(floor(p*vec2(1.3,7.)+vec2(time*.1,0.))))*step(.4,sin(p.y*4.+time));c+=shine*.15;c*=mix(vec3(.3,.45,.62),vec3(1.),day);gl_FragColor=vec4(c,1.);}`,
  });
  const water = mesh(scene, new T.PlaneGeometry(MAP.size, MAP.size), waterMat, 0, -0.015, 0);
  water.rotation.x = -Math.PI / 2;
  water.castShadow = false;
  mergeStatic(fixed);
  animateVegetation(forest, wind);
  animateVegetation(meadow, wind, true);
  return {
    fixed,
    trees,
    flames,
    fireLight,
    fireAt,
    halo,
    waterMat,
    logs,
    wind,
    lightWire,
    pendants,
    doorLight,
    rvGlow,
  };
}
// Camp-facing side windows (vehicle-local z=+1.5) carry warm light and module marks.
function rvWindowGlow(scene: T.Scene): RvGlow {
  const root = new T.Group();
  root.position.set(-1, 0, -1.6);
  root.rotation.y = -0.06;
  scene.add(root);
  const panes: T.Mesh<T.BufferGeometry, T.MeshBasicMaterial>[] = [];
  for (const x of [-2.65, -0.7]) {
    const pane = new T.Mesh(
      new T.PlaneGeometry(1.32, 0.62),
      new T.MeshBasicMaterial({
        color: '#ffd79a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    pane.position.set(x, 2.14, 1.575);
    pane.visible = false;
    root.add(pane);
    panes.push(pane);
  }
  const modules: Record<string, T.Group> = {};
  const mark = (
    id: string,
    x: number,
    y: number,
    color: string,
    silhouette: { w: number; h: number; dx?: number; dy?: number; color?: string } | null,
  ) => {
    const group = new T.Group();
    group.position.set(x, y, 1.585);
    group.visible = false;
    root.add(group);
    const glow = new T.Mesh(
      new T.PlaneGeometry(0.22, 0.22),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    group.add(glow);
    if (silhouette) {
      const shape = new T.Mesh(
        new T.PlaneGeometry(silhouette.w, silhouette.h),
        new T.MeshBasicMaterial({
          color: silhouette.color || '#2d2a22',
          transparent: true,
          opacity: 0,
          depthWrite: false,
        }),
      );
      shape.position.set(silhouette.dx || 0, silhouette.dy || -0.46, -0.006);
      group.add(shape);
    }
    modules[id] = group;
  };
  mark('workbench', -2.65, 2.3, '#f0b45e', { w: 0.92, h: 0.2, dy: -0.35 });
  mark('radio', -0.7, 2.3, '#63d2d8', { w: 0.36, h: 0.05, dy: -0.3, color: '#23332f' });
  mark('medcab', -0.7, 2.05, '#7fd08d', { w: 0.16, h: 0.16, dy: -0.1, color: '#2f3a30' });
  mark('plant', -2.65, 2.05, '#8fbf6a', { w: 0.18, h: 0.2, dy: -0.11, color: '#2c3a2a' });
  mark('quilt', -2.65, 1.9, '#d98a8a', null);
  mark('photos', -2.65, 2.4, '#f5e2b0', null);
  return { panes, modules };
}
// Window glow view: only at night, warm baseline plus one mark per installed module.
export function updateRvGlow(
  glow: RvGlow | null | undefined,
  owned: readonly string[],
  daylight: number,
  lampOn: boolean,
  time: number,
): void {
  if (!glow) return;
  const night = 1 - daylight,
    lit = night > 0.03;
  for (const pane of glow.panes) {
    pane.visible = lit;
    if (lit) pane.material.opacity = night * (lampOn ? 0.72 : 0.13);
  }
  for (const [id, group] of Object.entries(glow.modules)) {
    const on = lit && owned.includes(id);
    group.visible = on;
    if (!on) continue;
    const pulse = 0.85 + Math.sin(time * 2.6 + id.length) * 0.15;
    group.children.forEach((child, index) => {
      const material = (child as T.Mesh).material as T.Material & { opacity: number };
      material.opacity = night * pulse * (index === 0 ? 0.95 : 0.6);
    });
  }
}
