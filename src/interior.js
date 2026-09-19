import * as T from 'three';
import { box, mesh } from './world.js';

// Fixed cutaway, not a second combat map. Keep the front aisle clear.
export function makeInterior() {
  const scene = new T.Scene(); scene.background = new T.Color('#202e2b');
  const camera = new T.OrthographicCamera(-7, 7, 5, -5, .1, 60);
  camera.position.set(3, 9, 11); camera.lookAt(0, .5, 0);
  scene.add(new T.HemisphereLight('#fff0d0', '#786b50', 2.5));
  const sunlight = new T.DirectionalLight('#ffe4b2', 2.3); sunlight.position.set(-3, 7, 4);
  sunlight.castShadow = true; sunlight.shadow.mapSize.set(1024, 1024);
  Object.assign(sunlight.shadow.camera, { left: -7, right: 7, top: 6, bottom: -6 });
  sunlight.shadow.normalBias = .03; scene.add(sunlight);
  box(scene, '#67543e', 0, -.18, 0, 9, .3, 3.6);
  for (let i = 0; i < 30; i++) box(scene, i % 3 ? '#b69a70' : '#ae8e62', (i - 14.5) * .29, -.015, 0, .275, .04, 3.3);
  // Rear and end walls, with the roof and front wall cut away.
  box(scene, '#ddd3b5', 0, 1.35, -1.7, 9, 2.7, .14);
  box(scene, '#d3c5a2', -4.43, 1.35, 0, .14, 2.7, 3.4);
  box(scene, '#d3c5a2', 4.43, .4, 0, .14, .8, 3.4);
  box(scene, '#b86c43', 0, .25, -1.6, 8.8, .28, .08);
  box(scene, '#7e6950', 0, .08, 1.7, 8.9, .12, .12);
  for (const x of [-2.65, .2, 3]) {
    box(scene, '#8e7a57', x, 1.83, -1.59, 1.6, 1.05, .1);
    box(scene, '#668782', x, 1.83, -1.51, 1.43, .87, .06);
    box(scene, '#b9cfb2', x, 2.12, -1.47, 1.3, .08, .015, true);
    box(scene, '#dcd2b0', x, 1.83, -1.45, .045, .9, .04);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) box(scene, i % 2 ? '#819066' : '#6b7c56', x + side * (.69 + i * .09), 1.8, -1.38, .1, 1.16, .13);
    }
  }
  // Bed, pillow, striped wool blanket and bedside book.
  box(scene, '#7c6448', -3.05, .35, .15, 2.25, .65, 2.55);
  box(scene, '#e0d9bd', -3.05, .73, .15, 2.22, .24, 2.5);
  box(scene, '#7b8a65', -3.05, .89, .55, 2.24, .1, 1.62);
  for (const z of [.15, .3, .88, 1.03]) box(scene, '#c5b484', -3.05, .949, z, 2.24, .018, .055);
  box(scene, '#f1e6c8', -3.05, .93, -.77, 1.5, .22, .47);
  box(scene, '#b9764e', -3.9, 1, .95, .35, .08, .45);
  // A folded throw, stitched hem and a book with visible pages.
  box(scene, '#aa694d', -2.45, .99, 1.02, .65, .09, .57);
  for (const x of [-2.69, -2.24]) box(scene, '#d5b782', x, 1.041, 1.02, .045, .012, .56);
  for (let i = 0; i < 8; i++) box(scene, '#d5b782', -2.73 + i * .08, .98, 1.34, .025, .04, .12);
  box(scene, '#e3d4ad', -3.9, 1.048, .95, .3, .026, .4);
  box(scene, '#b9764e', -3.9, 1.069, .95, .35, .016, .45);
  box(scene, '#657e76', -3.88, 1.083, 1.08, .035, .012, .22);
  for (const x of [-3.62, -2.48]) {
    box(scene, '#987b52', x, .34, 1.44, .89, .42, .045);
    box(scene, '#504c3d', x, .41, 1.475, .24, .055, .045);
  }
  // Galley: inset sink, tap, hob, drawers, hanging cups and upper cabinets.
  box(scene, '#8b9474', -.1, .49, -1.04, 2.75, .95, .99);
  box(scene, '#d8c8a2', -.1, 1.01, -1.03, 2.85, .13, 1.05);
  for (const x of [-.95, -.1, .75]) {
    box(scene, '#aab08e', x, .55, -.525, .78, .73, .045);
    box(scene, '#5e6251', x, .77, -.49, .28, .05, .035);
  }
  box(scene, '#647c79', -.78, 1.085, -1.03, .81, .03, .62);
  box(scene, '#b6c0ab', -.78, 1.1, -1.03, .65, .035, .46);
  box(scene, '#7a9690', -.78, 1.29, -1.37, .06, .37, .06);
  box(scene, '#7a9690', -.78, 1.46, -1.26, .06, .06, .26);
  box(scene, '#494e43', .68, 1.09, -1.02, .73, .04, .65);
  for (const x of [.48, .88]) mesh(scene, new T.CylinderGeometry(.13, .13, .025, 12), '#879080', x, 1.12, -1.02);
  for (const x of [-1.1, 1.12]) {
    box(scene, '#c6b78f', x, 2.48, -1.35, .6, .37, .55);
    box(scene, '#766e51', x, 2.4, -1.06, .17, .035, .03);
  }
  // Enamel kettle: faceted body, dark lid knob, spout and open handle.
  mesh(scene, new T.CylinderGeometry(.14, .2, .25, 10), '#668781', .88, 1.27, -1.02);
  mesh(scene, new T.CylinderGeometry(.15, .17, .035, 10), '#c6c6a8', .88, 1.41, -1.02);
  box(scene, '#454e42', .88, 1.46, -1.02, .08, .065, .08);
  const handle = mesh(scene, new T.TorusGeometry(.17, .025, 5, 12, Math.PI), '#454e42', .88, 1.4, -1.02);
  handle.rotation.y = Math.PI / 2;
  const spout = mesh(scene, new T.CylinderGeometry(.045, .075, .23, 8), '#668781', .65, 1.31, -1.02);
  spout.rotation.z = -.8;
  // Chopping board and bread in the gap between sink and stove.
  box(scene, '#a77b4b', -.04, 1.092, -.88, .42, .025, .48);
  box(scene, '#b98a50', -.04, 1.16, -.87, .26, .12, .3);
  for (const z of [-.95, -.87, -.79]) box(scene, '#e2c590', -.04, 1.223, z, .2, .012, .025);
  // Dish towel hangs from a drawer, clear of the aisle.
  box(scene, '#d4c7a6', -.12, .76, -.46, .32, .4, .045);
  for (const x of [-.23, -.02]) box(scene, '#708982', x, .76, -.43, .025, .4, .018);
  // Spice shelf and hanging utensils below the window.
  box(scene, '#88704e', .14, 1.28, -1.44, .83, .065, .21);
  for (const [x, color] of [[-.1, '#b17c4e'], [.15, '#81926d'], [.39, '#c5a26c']]) {
    mesh(scene, new T.CylinderGeometry(.065, .065, .15, 8), color, x, 1.39, -1.43);
    box(scene, '#665f49', x, 1.48, -1.43, .14, .04, .14);
  }
  box(scene, '#635b45', -1.53, 1.63, -1.4, .42, .035, .055);
  for (const x of [-1.67, -1.43]) {
    box(scene, '#c4b18b', x, 1.43, -1.37, .035, .32, .035);
    mesh(scene, new T.SphereGeometry(.075, 8, 6), '#c4b18b', x, 1.24, -1.37, .75, 1, .3);
  }
  // Dinette on the right; fixed decorative furnishings only.
  for (const x of [2, 3.65]) {
    box(scene, '#796246', x, .3, -.85, .55, .6, 1.25);
    box(scene, '#b9784f', x, .65, -.85, .62, .2, 1.27);
    box(scene, '#bc815a', x + (x < 3 ? -.24 : .24), 1, -.85, .16, .7, 1.28);
  }
  box(scene, '#625a45', 2.82, .49, -.87, .12, .98, .12);
  box(scene, '#c4aa79', 2.82, 1.02, -.87, 1.04, .12, 1.1);
  box(scene, '#d5d0aa', 2.82, 1.09, -.8, .49, .018, .52);
  // Folded travel map with river, trail and destination marker.
  for (let i = 0; i < 5; i++) {
    box(scene, '#78958a', 2.76 + Math.sin(i) * .055, 1.104, -.99 + i * .09, .035, .008, .11);
    box(scene, '#b28355', 2.95 - i * .047, 1.106, -.95 + i * .065, .025, .008, .025);
  }
  box(scene, '#b45f42', 2.75, 1.109, -.69, .06, .012, .06);
  box(scene, '#c7ba97', 2.82, 1.107, -.8, .008, .008, .51);
  mesh(scene, new T.CylinderGeometry(.09, .075, .17, 10), '#c18156', 3.1, 1.17, -.99);
  mesh(scene, new T.CylinderGeometry(.071, .071, .008, 10), '#504335', 3.1, 1.26, -.99);
  mesh(scene, new T.TorusGeometry(.065, .018, 5, 10), '#c18156', 3.21, 1.18, -.99);
  // Seat piping and a soft cushion; baskets sit entirely below the seats.
  for (const x of [2, 3.65]) {
    box(scene, '#dbab78', x, .72, -.2, .6, .035, .035);
    box(scene, '#a88a5b', x, .28, -.45, .44, .39, .52);
    for (const y of [.16, .25, .34]) box(scene, '#d1b582', x, y, -.18, .45, .025, .025);
    box(scene, '#625840', x, .37, -.16, .15, .05, .025);
  }
  const cushion = box(scene, '#70857a', 3.65, .88, -1.18, .46, .2, .45); cushion.rotation.y = .18;
  // Entry rug and threshold align with the exterior side door.
  box(scene, '#997c53', .8, .026, .65, 2.15, .025, 1.1);
  for (const x of [-.15, 1.75]) box(scene, '#d0b882', x, .045, .65, .06, .012, 1.06);
  box(scene, '#dfc79b', 1.02, .05, 1.67, .96, .06, .16);
  for (let i = 0; i < 9; i++) {
    box(scene, '#b69a70', -.05 + i * .21, .047, .2, .1, .012, .035);
    box(scene, '#b69a70', -.05 + i * .21, .047, 1.1, .1, .012, .035);
  }
  // Travel memories on the end wall. Local XY faces into the room (+X).
  const memories = new T.Group(); memories.position.set(-4.33, 1.92, -.55); memories.rotation.y = Math.PI / 2; scene.add(memories);
  box(memories, '#8b724f', 0, 0, 0, 1.1, .035, .025);
  for (const [x, y, color] of [[-.36, -.25, '#819b94'], [0, -.32, '#b78c64'], [.36, -.22, '#89996b']]) {
    box(memories, '#eee0bb', x, y, .015, .28, .36, .025);
    box(memories, color, x, y + .025, .032, .22, .23, .012);
    box(memories, '#576e56', x, y, .044, .12, .09, .012);
    box(memories, '#ab8958', x, y + .19, .04, .045, .08, .035);
  }
  // Hooks and a small satchel on the low end wall, not on the walkable floor.
  box(scene, '#8b724f', 4.32, .62, .72, .055, .09, .7);
  for (const z of [.48, .95]) box(scene, '#575d4a', 4.25, .58, z, .15, .12, .035);
  box(scene, '#a7784f', 4.21, .32, .72, .16, .36, .42);
  box(scene, '#d1ad73', 4.11, .4, .72, .035, .17, .44);
  box(scene, '#695a43', 4.085, .33, .72, .025, .09, .07);
  // Wall lamp, shelf, small plant and photo give the cutaway a lived-in silhouette.
  box(scene, '#716049', -4.31, 1.8, .7, .2, .12, .46);
  const shadeGeometry = new T.CylinderGeometry(.16, .24, .3, 8);
  const shade = mesh(scene, shadeGeometry, '#ffe1a1', -4.15, 1.98, .7, 1, 1, 1, true);
  const unlitShade = mesh(scene, shadeGeometry, '#c4b596', -4.15, 1.98, .7); unlitShade.visible = false;
  box(scene, '#ddd3b5', -4.3, 1.42, .7, .07, .18, .14);
  const rocker = box(scene, '#716049', -4.25, 1.42, .7, .04, .09, .06);
  const lamp = new T.PointLight('#ffc578', 5, 5, 1.5); lamp.position.set(-3.9, 1.9, .7); scene.add(lamp);
  box(scene, '#8b724f', -1.65, 2.05, -1.55, .42, .55, .06);
  box(scene, '#a3b78c', -1.65, 2.05, -1.5, .32, .44, .02);
  mesh(scene, new T.CylinderGeometry(.12, .09, .19, 8), '#b97951', 1.12, 1.18, -1.28);
  for (let i = 0; i < 4; i++) mesh(scene, new T.ConeGeometry(.08, .38, 5), '#6f8854', 1.12 + Math.sin(i * 2) * .09, 1.43, -1.28 + Math.cos(i * 2) * .07);
  // ——— RV-GAMEPLAY: module slots, decoration and empty-slot markers ———
  // Function modules line the cut-away edge; decor lives on fixed surfaces so the aisle stays clear.
  const modules = {
    workbench: workbenchModel(), radio: radioModel(), medcab: medcabModel(),
    plant: plantModel(), quilt: quiltModel(), photos: photosModel(),
  };
  const markers = {};
  for (const [id, slot] of Object.entries(RV_SLOTS)) {
    const marker = slot.kind === 'function' ? slotRing(slot.x, 1.26) : decorPin(slot.x, slot.y, slot.z);
    marker.userData.slot = slot;
    markers[id] = marker; scene.add(marker);
    modules[id].position.set(slot.x, slot.y, slot.z); modules[id].rotation.y = slot.rotation || 0;
    scene.add(modules[id]); modules[id].visible = false;
  }
  function applyFurniture(owned = []) {
    for (const id of Object.keys(modules)) {
      const has = owned.includes(id);
      modules[id].visible = has; markers[id].visible = !has;
    }
  }
  function applySlots(functionSlots = 1) {
    let index = 0;
    for (const [id, marker] of Object.entries(markers)) {
      if (RV_SLOTS[id].kind !== 'function') continue;
      const locked = index >= functionSlots;
      marker.material.color.set(locked ? '#7d8676' : '#f0d59a');
      marker.material.opacity = locked ? .2 : .6;
      index++;
    }
  }
  applyFurniture([]); applySlots(1);
  // One reversible interaction; no resource bonuses or implied save support.
  let lampOn = true;
  return {
    scene, camera,
    get lampOn() { return lampOn; },
    modules, markers, slots: RV_SLOTS,
    setFurniture(owned) { applyFurniture(owned); },
    setSlots(functionSlots) { applySlots(functionSlots); },
    toggleLamp() {
      lampOn = !lampOn;
      lamp.intensity = lampOn ? 5 : 0;
      shade.visible = lampOn; unlitShade.visible = !lampOn;
      rocker.rotation.z = lampOn ? -.2 : .2;
      return lampOn;
    },
  };
}

// Slot anchors in interior space: functions on the cut edge, decor on counters, bed and wall.
export const RV_SLOTS = {
  workbench: { kind: 'function', x: -3.35, z: 1.6, y: 0 },
  radio: { kind: 'function', x: -1.75, z: 1.6, y: 0 },
  medcab: { kind: 'function', x: -.15, z: 1.6, y: 0 },
  plant: { kind: 'decor', x: -1.18, z: -.98, y: 1.08 },
  quilt: { kind: 'decor', x: -3.05, z: 1.02, y: .95 },
  photos: { kind: 'decor', x: -2.85, z: -1.62, y: 1.98 },
};
function slotRing(x, z) {
  const ring = new T.Mesh(new T.RingGeometry(.3, .4, 26), new T.MeshBasicMaterial({ color: '#f0d59a', transparent: true, opacity: .6, side: T.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(x, .028, z);
  return ring;
}
function decorPin(x, y, z) {
  const pin = new T.Mesh(new T.OctahedronGeometry(.11, 0), new T.MeshBasicMaterial({ color: '#f0d59a', transparent: true, opacity: .65, toneMapped: false }));
  pin.position.set(x, y, z); pin.rotation.y = .7;
  return pin;
}
function workbenchModel() {
  const g = new T.Group();
  box(g, '#7c6446', 0, .78, 0, 1.45, .1, .4);
  for (const x of [-.6, .6]) for (const z of [-.12, .12]) box(g, '#5d4c37', x, .38, z, .1, .76, .1);
  box(g, '#8d724e', 0, .3, -.06, 1.36, .07, .3);
  box(g, '#4f4a3c', 0, 1.06, -.13, 1.45, .52, .09);
  for (let i = 0; i < 5; i++) box(g, '#9aa08f', -.5 + i * .25, 1.04, -.07, .055, .3, .05);
  box(g, '#6c6f63', .44, .9, .1, .3, .16, .2);
  box(g, '#c9a268', -.36, .87, .04, .48, .1, .28);
  return g;
}
function radioModel() {
  const g = new T.Group();
  box(g, '#6d5a40', 0, .44, 0, 1.05, .08, .42);
  for (const x of [-.42, .42]) for (const z of [-.12, .12]) box(g, '#55462f', x, .21, z, .08, .42, .08);
  box(g, '#4a5b57', .24, .66, -.02, .58, .4, .3);
  box(g, '#d9cfa8', .24, .66, .14, .3, .2, .02);
  box(g, '#8f9a86', .24, .6, .16, .2, .05, .02);
  box(g, '#9aa08f', .46, 1, -.02, .028, .44, .028);
  box(g, '#e0d6ad', -.3, .49, 0, .4, .015, .3);
  box(g, '#b0603f', -.3, .5, -.02, .07, .02, .07);
  return g;
}
function medcabModel() {
  const g = new T.Group();
  box(g, '#b8b195', 0, .56, 0, .78, 1.12, .36);
  box(g, '#8e8a74', 0, .56, .19, .7, 1.02, .02);
  for (const x of [-.18, .18]) box(g, '#6f7a6a', x, .56, .205, .035, .9, .02);
  for (const x of [-.18, .18]) box(g, '#575d4a', x < 0 ? -.28 : .28, .56, .215, .05, .08, .03);
  box(g, '#bf5a47', 0, .82, .22, .3, .09, .015);
  box(g, '#bf5a47', 0, .82, .22, .09, .3, .015);
  box(g, '#c8c2a6', -.32, 1.14, .05, .16, .12, .16);
  return g;
}
function plantModel() {
  const g = new T.Group();
  mesh(g, new T.CylinderGeometry(.11, .085, .16, 8), '#b0714d', 0, .08, 0);
  mesh(g, new T.CylinderGeometry(.12, .12, .03, 8), '#6b5b42', 0, .17, 0);
  for (let i = 0; i < 3; i++) {
    const cone = mesh(g, new T.ConeGeometry(.15 - i * .03, .3, 6), i % 2 ? '#6f8854' : '#7d955e', 0, .32 + i * .11, 0);
    cone.rotation.y = i * 1.2;
  }
  return g;
}
function quiltModel() {
  const g = new T.Group();
  box(g, '#aa694d', 0, .02, 0, .92, .06, .5);
  box(g, '#c98a5f', 0, .06, 0, .86, .05, .44);
  for (const z of [-.14, 0, .14]) box(g, '#e0c48e', 0, .09, z, .88, .015, .05);
  box(g, '#83977c', -.22, .1, 0, .3, .015, .46);
  return g;
}
function photosModel() {
  const g = new T.Group();
  box(g, '#6b5a3d', 0, 0, 0, 1.7, .025, .02);
  for (const [x, color] of [[-.55, '#b78c64'], [-.1, '#819b94'], [.42, '#89996b']]) {
    box(g, '#eee0bb', x, -.22, .01, .34, .4, .025);
    box(g, color, x, -.2, .028, .26, .26, .012);
    box(g, '#576e56', x, -.22, .04, .14, .1, .012);
  }
  return g;
}

export function interiorBlocked(x, z) {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return true;
  return x < -1.65 || x > 4.05 || z < .12 || z > 1.38;
}
