import * as T from 'three';
import { box, mesh } from './world.js';

// Fixed cutaway, not a second combat map. Keep the front aisle clear.
export function makeInterior() {
  const scene = new T.Scene();
  scene.background = new T.Color('#202e2b');
  const camera = new T.OrthographicCamera(-7, 7, 5, -5, 0.1, 60);
  camera.position.set(3, 9, 11);
  camera.lookAt(0, 0.5, 0);
  scene.add(new T.HemisphereLight('#fff0d0', '#786b50', 2.5));
  const sunlight = new T.DirectionalLight('#ffe4b2', 2.3);
  sunlight.position.set(-3, 7, 4);
  sunlight.castShadow = true;
  sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6 });
  sunlight.shadow.normalBias = 0.03;
  scene.add(sunlight);
  box(scene, '#67543e', 0, -0.18, 0, 9, 0.3, 3.6);
  for (let i = 0; i < 30; i++)
    box(scene, i % 3 ? '#b69a70' : '#ae8e62', (i - 14.5) * 0.29, -0.015, 0, 0.275, 0.04, 3.3);
  // Rear and end walls, with the roof and front wall cut away.
  box(scene, '#ddd3b5', 0, 1.35, -1.7, 9, 2.7, 0.14);
  box(scene, '#d3c5a2', -4.43, 1.35, 0, 0.14, 2.7, 3.4);
  box(scene, '#d3c5a2', 4.43, 0.4, 0, 0.14, 0.8, 3.4);
  box(scene, '#b86c43', 0, 0.25, -1.6, 8.8, 0.28, 0.08);
  box(scene, '#7e6950', 0, 0.08, 1.7, 8.9, 0.12, 0.12);
  for (const x of [-2.65, 0.2, 3]) {
    box(scene, '#8e7a57', x, 1.83, -1.59, 1.6, 1.05, 0.1);
    box(scene, '#668782', x, 1.83, -1.51, 1.43, 0.87, 0.06);
    box(scene, '#b9cfb2', x, 2.12, -1.47, 1.3, 0.08, 0.015, true);
    box(scene, '#dcd2b0', x, 1.83, -1.45, 0.045, 0.9, 0.04);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++)
        box(
          scene,
          i % 2 ? '#819066' : '#6b7c56',
          x + side * (0.69 + i * 0.09),
          1.8,
          -1.38,
          0.1,
          1.16,
          0.13,
        );
    }
  }
  // Bed, pillow, striped wool blanket and bedside book.
  box(scene, '#7c6448', -3.05, 0.35, 0.15, 2.25, 0.65, 2.55);
  box(scene, '#e0d9bd', -3.05, 0.73, 0.15, 2.22, 0.24, 2.5);
  box(scene, '#7b8a65', -3.05, 0.89, 0.55, 2.24, 0.1, 1.62);
  for (const z of [0.15, 0.3, 0.88, 1.03])
    box(scene, '#c5b484', -3.05, 0.949, z, 2.24, 0.018, 0.055);
  box(scene, '#f1e6c8', -3.05, 0.93, -0.77, 1.5, 0.22, 0.47);
  box(scene, '#b9764e', -3.9, 1, 0.95, 0.35, 0.08, 0.45);
  // A folded throw, stitched hem and a book with visible pages.
  box(scene, '#aa694d', -2.45, 0.99, 1.02, 0.65, 0.09, 0.57);
  for (const x of [-2.69, -2.24]) box(scene, '#d5b782', x, 1.041, 1.02, 0.045, 0.012, 0.56);
  for (let i = 0; i < 8; i++)
    box(scene, '#d5b782', -2.73 + i * 0.08, 0.98, 1.34, 0.025, 0.04, 0.12);
  box(scene, '#e3d4ad', -3.9, 1.048, 0.95, 0.3, 0.026, 0.4);
  box(scene, '#b9764e', -3.9, 1.069, 0.95, 0.35, 0.016, 0.45);
  box(scene, '#657e76', -3.88, 1.083, 1.08, 0.035, 0.012, 0.22);
  for (const x of [-3.62, -2.48]) {
    box(scene, '#987b52', x, 0.34, 1.44, 0.89, 0.42, 0.045);
    box(scene, '#504c3d', x, 0.41, 1.475, 0.24, 0.055, 0.045);
  }
  // Galley: inset sink, tap, hob, drawers, hanging cups and upper cabinets.
  box(scene, '#8b9474', -0.1, 0.49, -1.04, 2.75, 0.95, 0.99);
  box(scene, '#d8c8a2', -0.1, 1.01, -1.03, 2.85, 0.13, 1.05);
  for (const x of [-0.95, -0.1, 0.75]) {
    box(scene, '#aab08e', x, 0.55, -0.525, 0.78, 0.73, 0.045);
    box(scene, '#5e6251', x, 0.77, -0.49, 0.28, 0.05, 0.035);
  }
  box(scene, '#647c79', -0.78, 1.085, -1.03, 0.81, 0.03, 0.62);
  box(scene, '#b6c0ab', -0.78, 1.1, -1.03, 0.65, 0.035, 0.46);
  box(scene, '#7a9690', -0.78, 1.29, -1.37, 0.06, 0.37, 0.06);
  box(scene, '#7a9690', -0.78, 1.46, -1.26, 0.06, 0.06, 0.26);
  box(scene, '#494e43', 0.68, 1.09, -1.02, 0.73, 0.04, 0.65);
  for (const x of [0.48, 0.88])
    mesh(scene, new T.CylinderGeometry(0.13, 0.13, 0.025, 12), '#879080', x, 1.12, -1.02);
  for (const x of [-1.1, 1.12]) {
    box(scene, '#c6b78f', x, 2.48, -1.35, 0.6, 0.37, 0.55);
    box(scene, '#766e51', x, 2.4, -1.06, 0.17, 0.035, 0.03);
  }
  // Enamel kettle: faceted body, dark lid knob, spout and open handle.
  mesh(scene, new T.CylinderGeometry(0.14, 0.2, 0.25, 10), '#668781', 0.88, 1.27, -1.02);
  mesh(scene, new T.CylinderGeometry(0.15, 0.17, 0.035, 10), '#c6c6a8', 0.88, 1.41, -1.02);
  box(scene, '#454e42', 0.88, 1.46, -1.02, 0.08, 0.065, 0.08);
  const handle = mesh(
    scene,
    new T.TorusGeometry(0.17, 0.025, 5, 12, Math.PI),
    '#454e42',
    0.88,
    1.4,
    -1.02,
  );
  handle.rotation.y = Math.PI / 2;
  const spout = mesh(
    scene,
    new T.CylinderGeometry(0.045, 0.075, 0.23, 8),
    '#668781',
    0.65,
    1.31,
    -1.02,
  );
  spout.rotation.z = -0.8;
  // Chopping board and bread in the gap between sink and stove.
  box(scene, '#a77b4b', -0.04, 1.092, -0.88, 0.42, 0.025, 0.48);
  box(scene, '#b98a50', -0.04, 1.16, -0.87, 0.26, 0.12, 0.3);
  for (const z of [-0.95, -0.87, -0.79]) box(scene, '#e2c590', -0.04, 1.223, z, 0.2, 0.012, 0.025);
  // Dish towel hangs from a drawer, clear of the aisle.
  box(scene, '#d4c7a6', -0.12, 0.76, -0.46, 0.32, 0.4, 0.045);
  for (const x of [-0.23, -0.02]) box(scene, '#708982', x, 0.76, -0.43, 0.025, 0.4, 0.018);
  // Spice shelf and hanging utensils below the window.
  box(scene, '#88704e', 0.14, 1.28, -1.44, 0.83, 0.065, 0.21);
  for (const [x, color] of [
    [-0.1, '#b17c4e'],
    [0.15, '#81926d'],
    [0.39, '#c5a26c'],
  ]) {
    mesh(scene, new T.CylinderGeometry(0.065, 0.065, 0.15, 8), color, x, 1.39, -1.43);
    box(scene, '#665f49', x, 1.48, -1.43, 0.14, 0.04, 0.14);
  }
  box(scene, '#635b45', -1.53, 1.63, -1.4, 0.42, 0.035, 0.055);
  for (const x of [-1.67, -1.43]) {
    box(scene, '#c4b18b', x, 1.43, -1.37, 0.035, 0.32, 0.035);
    mesh(scene, new T.SphereGeometry(0.075, 8, 6), '#c4b18b', x, 1.24, -1.37, 0.75, 1, 0.3);
  }
  // Dinette on the right; fixed decorative furnishings only.
  for (const x of [2, 3.65]) {
    box(scene, '#796246', x, 0.3, -0.85, 0.55, 0.6, 1.25);
    box(scene, '#b9784f', x, 0.65, -0.85, 0.62, 0.2, 1.27);
    box(scene, '#bc815a', x + (x < 3 ? -0.24 : 0.24), 1, -0.85, 0.16, 0.7, 1.28);
  }
  box(scene, '#625a45', 2.82, 0.49, -0.87, 0.12, 0.98, 0.12);
  box(scene, '#c4aa79', 2.82, 1.02, -0.87, 1.04, 0.12, 1.1);
  box(scene, '#d5d0aa', 2.82, 1.09, -0.8, 0.49, 0.018, 0.52);
  // Folded travel map with river, trail and destination marker.
  for (let i = 0; i < 5; i++) {
    box(scene, '#78958a', 2.76 + Math.sin(i) * 0.055, 1.104, -0.99 + i * 0.09, 0.035, 0.008, 0.11);
    box(scene, '#b28355', 2.95 - i * 0.047, 1.106, -0.95 + i * 0.065, 0.025, 0.008, 0.025);
  }
  box(scene, '#b45f42', 2.75, 1.109, -0.69, 0.06, 0.012, 0.06);
  box(scene, '#c7ba97', 2.82, 1.107, -0.8, 0.008, 0.008, 0.51);
  mesh(scene, new T.CylinderGeometry(0.09, 0.075, 0.17, 10), '#c18156', 3.1, 1.17, -0.99);
  mesh(scene, new T.CylinderGeometry(0.071, 0.071, 0.008, 10), '#504335', 3.1, 1.26, -0.99);
  mesh(scene, new T.TorusGeometry(0.065, 0.018, 5, 10), '#c18156', 3.21, 1.18, -0.99);
  // Seat piping and a soft cushion; baskets sit entirely below the seats.
  for (const x of [2, 3.65]) {
    box(scene, '#dbab78', x, 0.72, -0.2, 0.6, 0.035, 0.035);
    box(scene, '#a88a5b', x, 0.28, -0.45, 0.44, 0.39, 0.52);
    for (const y of [0.16, 0.25, 0.34]) box(scene, '#d1b582', x, y, -0.18, 0.45, 0.025, 0.025);
    box(scene, '#625840', x, 0.37, -0.16, 0.15, 0.05, 0.025);
  }
  const cushion = box(scene, '#70857a', 3.65, 0.88, -1.18, 0.46, 0.2, 0.45);
  cushion.rotation.y = 0.18;
  // Entry rug and threshold align with the exterior side door.
  box(scene, '#997c53', 0.8, 0.026, 0.65, 2.15, 0.025, 1.1);
  for (const x of [-0.15, 1.75]) box(scene, '#d0b882', x, 0.045, 0.65, 0.06, 0.012, 1.06);
  box(scene, '#dfc79b', 1.02, 0.05, 1.67, 0.96, 0.06, 0.16);
  for (let i = 0; i < 9; i++) {
    box(scene, '#b69a70', -0.05 + i * 0.21, 0.047, 0.2, 0.1, 0.012, 0.035);
    box(scene, '#b69a70', -0.05 + i * 0.21, 0.047, 1.1, 0.1, 0.012, 0.035);
  }
  // Travel memories on the end wall. Local XY faces into the room (+X).
  const memories = new T.Group();
  memories.position.set(-4.33, 1.92, -0.55);
  memories.rotation.y = Math.PI / 2;
  scene.add(memories);
  box(memories, '#8b724f', 0, 0, 0, 1.1, 0.035, 0.025);
  for (const [x, y, color] of [
    [-0.36, -0.25, '#819b94'],
    [0, -0.32, '#b78c64'],
    [0.36, -0.22, '#89996b'],
  ]) {
    box(memories, '#eee0bb', x, y, 0.015, 0.28, 0.36, 0.025);
    box(memories, color, x, y + 0.025, 0.032, 0.22, 0.23, 0.012);
    box(memories, '#576e56', x, y, 0.044, 0.12, 0.09, 0.012);
    box(memories, '#ab8958', x, y + 0.19, 0.04, 0.045, 0.08, 0.035);
  }
  // Hooks and a small satchel on the low end wall, not on the walkable floor.
  box(scene, '#8b724f', 4.32, 0.62, 0.72, 0.055, 0.09, 0.7);
  for (const z of [0.48, 0.95]) box(scene, '#575d4a', 4.25, 0.58, z, 0.15, 0.12, 0.035);
  box(scene, '#a7784f', 4.21, 0.32, 0.72, 0.16, 0.36, 0.42);
  box(scene, '#d1ad73', 4.11, 0.4, 0.72, 0.035, 0.17, 0.44);
  box(scene, '#695a43', 4.085, 0.33, 0.72, 0.025, 0.09, 0.07);
  // Wall lamp, shelf, small plant and photo give the cutaway a lived-in silhouette.
  box(scene, '#716049', -4.31, 1.8, 0.7, 0.2, 0.12, 0.46);
  const shadeGeometry = new T.CylinderGeometry(0.16, 0.24, 0.3, 8);
  const shade = mesh(scene, shadeGeometry, '#ffe1a1', -4.15, 1.98, 0.7, 1, 1, 1, true);
  const unlitShade = mesh(scene, shadeGeometry, '#c4b596', -4.15, 1.98, 0.7);
  unlitShade.visible = false;
  box(scene, '#ddd3b5', -4.3, 1.42, 0.7, 0.07, 0.18, 0.14);
  const rocker = box(scene, '#716049', -4.25, 1.42, 0.7, 0.04, 0.09, 0.06);
  const lamp = new T.PointLight('#ffc578', 5, 5, 1.5);
  lamp.position.set(-3.9, 1.9, 0.7);
  scene.add(lamp);
  box(scene, '#8b724f', -1.65, 2.05, -1.55, 0.42, 0.55, 0.06);
  box(scene, '#a3b78c', -1.65, 2.05, -1.5, 0.32, 0.44, 0.02);
  mesh(scene, new T.CylinderGeometry(0.12, 0.09, 0.19, 8), '#b97951', 1.12, 1.18, -1.28);
  for (let i = 0; i < 4; i++)
    mesh(
      scene,
      new T.ConeGeometry(0.08, 0.38, 5),
      '#6f8854',
      1.12 + Math.sin(i * 2) * 0.09,
      1.43,
      -1.28 + Math.cos(i * 2) * 0.07,
    );
  // ——— RV-GAMEPLAY: module slots, decoration and empty-slot markers ———
  // Function modules line the cut-away edge; decor lives on fixed surfaces so the aisle stays clear.
  const modules = {
    workbench: workbenchModel(),
    radio: radioModel(),
    medcab: medcabModel(),
    plant: plantModel(),
    quilt: quiltModel(),
    photos: photosModel(),
  };
  const markers = {};
  for (const [id, slot] of Object.entries(RV_SLOTS)) {
    const marker =
      slot.kind === 'function' ? slotRing(slot.x, 1.26) : decorPin(slot.x, slot.y, slot.z);
    marker.userData.slot = slot;
    markers[id] = marker;
    scene.add(marker);
    modules[id].position.set(slot.x, slot.y, slot.z);
    modules[id].rotation.y = slot.rotation || 0;
    scene.add(modules[id]);
    modules[id].visible = false;
  }
  function applyFurniture(owned = []) {
    for (const id of Object.keys(modules)) {
      const has = owned.includes(id);
      modules[id].visible = has;
      markers[id].visible = !has;
    }
  }
  function applySlots(functionSlots = 1) {
    let index = 0;
    for (const [id, marker] of Object.entries(markers)) {
      if (RV_SLOTS[id].kind !== 'function') continue;
      const locked = index >= functionSlots;
      marker.material.color.set(locked ? '#7d8676' : '#f0d59a');
      marker.material.opacity = locked ? 0.2 : 0.6;
      index++;
    }
  }
  applyFurniture([]);
  applySlots(1);
  // One reversible interaction; no resource bonuses or implied save support.
  let lampOn = true;
  return {
    scene,
    camera,
    get lampOn() {
      return lampOn;
    },
    modules,
    markers,
    slots: RV_SLOTS,
    setFurniture(owned) {
      applyFurniture(owned);
    },
    setSlots(functionSlots) {
      applySlots(functionSlots);
    },
    toggleLamp() {
      lampOn = !lampOn;
      lamp.intensity = lampOn ? 5 : 0;
      shade.visible = lampOn;
      unlitShade.visible = !lampOn;
      rocker.rotation.z = lampOn ? -0.2 : 0.2;
      return lampOn;
    },
  };
}

// Slot anchors in interior space: functions on the cut edge, decor on counters, bed and wall.
export const RV_SLOTS = {
  workbench: { kind: 'function', x: -3.35, z: 1.6, y: 0 },
  radio: { kind: 'function', x: -1.75, z: 1.6, y: 0 },
  medcab: { kind: 'function', x: -0.15, z: 1.6, y: 0 },
  plant: { kind: 'decor', x: -1.18, z: -0.98, y: 1.08 },
  quilt: { kind: 'decor', x: -3.05, z: 1.02, y: 0.95 },
  photos: { kind: 'decor', x: -2.85, z: -1.62, y: 1.98 },
};
function slotRing(x, z) {
  const ring = new T.Mesh(
    new T.RingGeometry(0.3, 0.4, 26),
    new T.MeshBasicMaterial({
      color: '#f0d59a',
      transparent: true,
      opacity: 0.6,
      side: T.DoubleSide,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.028, z);
  return ring;
}
function decorPin(x, y, z) {
  const pin = new T.Mesh(
    new T.OctahedronGeometry(0.11, 0),
    new T.MeshBasicMaterial({
      color: '#f0d59a',
      transparent: true,
      opacity: 0.65,
      toneMapped: false,
    }),
  );
  pin.position.set(x, y, z);
  pin.rotation.y = 0.7;
  return pin;
}
function workbenchModel() {
  const g = new T.Group();
  box(g, '#7c6446', 0, 0.78, 0, 1.45, 0.1, 0.4);
  for (const x of [-0.6, 0.6])
    for (const z of [-0.12, 0.12]) box(g, '#5d4c37', x, 0.38, z, 0.1, 0.76, 0.1);
  box(g, '#8d724e', 0, 0.3, -0.06, 1.36, 0.07, 0.3);
  box(g, '#4f4a3c', 0, 1.06, -0.13, 1.45, 0.52, 0.09);
  for (let i = 0; i < 5; i++) box(g, '#9aa08f', -0.5 + i * 0.25, 1.04, -0.07, 0.055, 0.3, 0.05);
  box(g, '#6c6f63', 0.44, 0.9, 0.1, 0.3, 0.16, 0.2);
  box(g, '#c9a268', -0.36, 0.87, 0.04, 0.48, 0.1, 0.28);
  return g;
}
function radioModel() {
  const g = new T.Group();
  box(g, '#6d5a40', 0, 0.44, 0, 1.05, 0.08, 0.42);
  for (const x of [-0.42, 0.42])
    for (const z of [-0.12, 0.12]) box(g, '#55462f', x, 0.21, z, 0.08, 0.42, 0.08);
  box(g, '#4a5b57', 0.24, 0.66, -0.02, 0.58, 0.4, 0.3);
  box(g, '#d9cfa8', 0.24, 0.66, 0.14, 0.3, 0.2, 0.02);
  box(g, '#8f9a86', 0.24, 0.6, 0.16, 0.2, 0.05, 0.02);
  box(g, '#9aa08f', 0.46, 1, -0.02, 0.028, 0.44, 0.028);
  box(g, '#e0d6ad', -0.3, 0.49, 0, 0.4, 0.015, 0.3);
  box(g, '#b0603f', -0.3, 0.5, -0.02, 0.07, 0.02, 0.07);
  return g;
}
function medcabModel() {
  const g = new T.Group();
  box(g, '#b8b195', 0, 0.56, 0, 0.78, 1.12, 0.36);
  box(g, '#8e8a74', 0, 0.56, 0.19, 0.7, 1.02, 0.02);
  for (const x of [-0.18, 0.18]) box(g, '#6f7a6a', x, 0.56, 0.205, 0.035, 0.9, 0.02);
  for (const x of [-0.18, 0.18])
    box(g, '#575d4a', x < 0 ? -0.28 : 0.28, 0.56, 0.215, 0.05, 0.08, 0.03);
  box(g, '#bf5a47', 0, 0.82, 0.22, 0.3, 0.09, 0.015);
  box(g, '#bf5a47', 0, 0.82, 0.22, 0.09, 0.3, 0.015);
  box(g, '#c8c2a6', -0.32, 1.14, 0.05, 0.16, 0.12, 0.16);
  return g;
}
function plantModel() {
  const g = new T.Group();
  mesh(g, new T.CylinderGeometry(0.11, 0.085, 0.16, 8), '#b0714d', 0, 0.08, 0);
  mesh(g, new T.CylinderGeometry(0.12, 0.12, 0.03, 8), '#6b5b42', 0, 0.17, 0);
  for (let i = 0; i < 3; i++) {
    const cone = mesh(
      g,
      new T.ConeGeometry(0.15 - i * 0.03, 0.3, 6),
      i % 2 ? '#6f8854' : '#7d955e',
      0,
      0.32 + i * 0.11,
      0,
    );
    cone.rotation.y = i * 1.2;
  }
  return g;
}
function quiltModel() {
  const g = new T.Group();
  box(g, '#aa694d', 0, 0.02, 0, 0.92, 0.06, 0.5);
  box(g, '#c98a5f', 0, 0.06, 0, 0.86, 0.05, 0.44);
  for (const z of [-0.14, 0, 0.14]) box(g, '#e0c48e', 0, 0.09, z, 0.88, 0.015, 0.05);
  box(g, '#83977c', -0.22, 0.1, 0, 0.3, 0.015, 0.46);
  return g;
}
function photosModel() {
  const g = new T.Group();
  box(g, '#6b5a3d', 0, 0, 0, 1.7, 0.025, 0.02);
  for (const [x, color] of [
    [-0.55, '#b78c64'],
    [-0.1, '#819b94'],
    [0.42, '#89996b'],
  ]) {
    box(g, '#eee0bb', x, -0.22, 0.01, 0.34, 0.4, 0.025);
    box(g, color, x, -0.2, 0.028, 0.26, 0.26, 0.012);
    box(g, '#576e56', x, -0.22, 0.04, 0.14, 0.1, 0.012);
  }
  return g;
}

export function interiorBlocked(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  return x < -1.65 || x > 4.05 || z < 0.12 || z > 1.38;
}
