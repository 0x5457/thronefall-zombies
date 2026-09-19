// Shared low-poly primitives and material cache. Rendering-only, no game rules.
import * as T from 'three';

const materials = new Map<string, T.MeshBasicMaterial | T.MeshStandardMaterial>();
export const boxGeo = new T.BoxGeometry(1, 1, 1);
export const rockGeo = new T.DodecahedronGeometry(1, 0);

export function mat(
  color: string | number,
  glow = false,
): T.MeshBasicMaterial | T.MeshStandardMaterial {
  const key = `${color}/${glow}`;
  if (!materials.has(key))
    materials.set(
      key,
      glow
        ? new T.MeshBasicMaterial({ color })
        : new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true }),
    );
  return materials.get(key)!;
}

export function mesh(
  parent: T.Object3D,
  geometry: T.BufferGeometry,
  color: string | number | T.Material,
  x: number,
  y: number,
  z: number,
  sx = 1,
  sy = 1,
  sz = 1,
  glow = false,
): T.Mesh {
  const m = new T.Mesh(geometry, typeof color === 'object' ? color : mat(color, glow));
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = !glow;
  m.receiveShadow = !glow;
  parent.add(m);
  return m;
}

export function box(
  parent: T.Object3D,
  color: string | number | T.Material,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  glow = false,
): T.Mesh {
  return mesh(parent, boxGeo, color, x, y, z, sx, sy, sz, glow);
}

export function beam(
  parent: T.Object3D,
  color: string | number,
  a: [number, number, number],
  b: [number, number, number],
  width: number,
): T.Mesh {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    middle = start.clone().add(end).multiplyScalar(0.5);
  const m = box(parent, color, middle.x, middle.y, middle.z, width, start.distanceTo(end), width);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize());
  return m;
}
