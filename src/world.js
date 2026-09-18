import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MAP } from './map.js';

export function seeded(seed = 731) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
}
const random = seeded();
const rand = (a, b) => a + random() * (b - a);
const materials = new Map();
export function mat(color, glow = false) {
  const key = `${color}/${glow}`;
  if (!materials.has(key)) materials.set(key, glow ? new T.MeshBasicMaterial({ color }) : new T.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  return materials.get(key);
}
const boxGeo = new T.BoxGeometry(1, 1, 1);
const rockGeo = new T.DodecahedronGeometry(1, 0);
export function mesh(parent, geometry, color, x, y, z, sx = 1, sy = 1, sz = 1, glow = false) {
  const m = new T.Mesh(geometry, typeof color === 'object' ? color : mat(color, glow));
  m.position.set(x, y, z); m.scale.set(sx, sy, sz);
  m.castShadow = !glow; m.receiveShadow = !glow; parent.add(m); return m;
}
export function box(parent, color, x, y, z, sx, sy, sz, glow = false) { return mesh(parent, boxGeo, color, x, y, z, sx, sy, sz, glow); }
function beam(parent, color, a, b, width) {
  const start = new T.Vector3(...a), end = new T.Vector3(...b), middle = start.clone().add(end).multiplyScalar(.5);
  const m = box(parent, color, ...middle, width, start.distanceTo(end), width);
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize()); return m;
}
export const shore = z => 24 - .19 * z + Math.sin(z * .15) * 2.2 + Math.sin(z * .41) * .6;
export const pathX = z => -1.5 + Math.sin(z * .09) * 2.8;
export function isClearing(x, z) { return (x * x / 145 + z * z / 105 < 1) || Math.abs(x - pathX(z)) < 2.8 || Math.abs(z - (6 + x * .19 + Math.sin(x * .13))) < 2.1; }
export function walkable(x, z) { return Number.isFinite(x) && Number.isFinite(z) && Math.abs(x) < MAP.playable && Math.abs(z) < MAP.playable && x < shore(z) - 1; }

function groundTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 4096;
  const c = canvas.getContext('2d'), scale = 4096 / 180;
  c.fillStyle = '#52613a'; c.fillRect(0, 0, 4096, 4096);
  const dirt = ['#a69a6d','#a99d70','#a89b6f','#ad9f73','#aa9c70','#a49669'];
  const grass = ['#768451','#798654','#72804e','#7c8855','#758251','#7e8957','#73804f'];
  for (let z = -90; z < 90; z += .125) for (let x = -90; x < 90; x += .125) {
    const ellipse = x * x / 170 + z * z / 125;
    const d = Math.min((ellipse - 1) * 3, Math.abs(x - pathX(z)) - 2.5, Math.abs(z - (6 + x * .19 + Math.sin(x * .13))) - 1.9);
    const palette = d < rand(-.42, .42) ? dirt : grass;
    c.fillStyle = palette[Math.floor(random() * palette.length)];
    c.fillRect((x + 90) * scale, (z + 90) * scale, 3, 3);
  }
  for (let i = 0; i < 61000; i++) {
    const x = rand(-90,90), z = rand(-90,90), clearing = isClearing(x,z);
    c.fillStyle = clearing ? ['#c0af79','#877e51','#b5a56d'][i%3] : ['#899356','#899750','#424e30','#a0a161'][i%4];
    c.globalAlpha = rand(.15,.5); c.fillRect((x+90)*scale,(z+90)*scale,rand(1,5),rand(1,3));
  }
  c.globalAlpha = .13; c.strokeStyle = '#695e40'; c.lineWidth = 2;
  for (const offset of [-.85,.85]) { c.beginPath(); for (let z=-90;z<-8;z+=.2) c.lineTo((pathX(z)+offset+90)*scale,(z+90)*scale); c.stroke(); }
  c.globalAlpha=1;
  const tex = new T.CanvasTexture(canvas); tex.colorSpace=T.SRGBColorSpace; tex.magFilter=T.NearestFilter; tex.anisotropy=4; return tex;
}
function pine(parent, x, z, size) {
  const g = new T.Group(); parent.add(g); g.position.set(x,0,z); g.rotation.y=rand(0,Math.PI*2);
  box(g,'#635438',0,size*.28,0,size*.09,size*.56,size*.09);
  const colors = ['#536749','#5b6e48','#63764b','#6d7c4e','#49634b','#778551'];
  const color = new T.Color(colors[Math.floor(random()*colors.length)]);
  for (let i=0;i<4;i++) {
    const h=size*(.44-i*.032), radius=size*(.245-i*.047);
    const geo=new T.ConeGeometry(radius,h,5,1); geo.translate(0,h*.5,0);
    const layer=mesh(g,geo,mat(color.clone().multiplyScalar(.87+i*.075).getHex()),0,size*(.16+i*.18),0);
    layer.rotation.y=i*.47;
  }
  if(size>6) {
    for(let i=0;i<3;i++) { const a=rand(0,6.28); beam(g,'#65583d',[0,size*.3,0],[Math.sin(a)*size*.16,size*.35,Math.cos(a)*size*.16],size*.04); }
  }
}
function birch(parent,x,z,size) {
  box(parent,'#a6a28a',x,size*.43,z,.22,size*.86,.25);
  for(let i=0;i<6;i++) box(parent,'#5c5e48',x+.115,size*(.1+i*.115),z,.03,.1,.23);
  for(let i=0;i<4;i++) mesh(parent,rockGeo,['#778450','#899351','#6c7b48'][i%3],x+rand(-.7,.7),size*(.63+i*.095),z+rand(-.5,.5),size*.24,size*.22,size*.22);
}
function rock(parent,x,z,size) {
  const m=mesh(parent,rockGeo,['#6a7164','#7c8172','#585f58','#8a8c77'][Math.floor(random()*4)],x,size*.29-.04,z,size,size*rand(.55,.9),size*.8); m.rotation.set(rand(-.2,.2),rand(0,6.28),rand(-.15,.15));
  if(size>.7 && random()>.4) mesh(parent,rockGeo,'#77804e',x-.12,size*.72,z-.1,size*.6,.12,size*.52);
}
export function character(zombie = false) {
  const g=new T.Group(), body=new T.Group(); g.add(body);
  box(body,zombie?'#667c66':'#c99051',0,.83,0,.43,.56,.28);
  box(body,zombie?'#8b9b75':'#dfb78c',0,1.28,0,.34,.35,.33);
  box(body,zombie?'#414d3f':'#493f33',0,1.46,-.025,.37,.13,.35);
  if(!zombie) { box(body,'#c6ae7b',0,1.48,.02,.47,.08,.42); box(body,'#bbb291',0,1.56,-.03,.31,.13,.27); box(body,'#756b46',0,.84,-.21,.33,.43,.2); box(body,'#e1c795',0,.65,-.26,.39,.11,.13); }
  box(body,'#282f28',-.085,1.3,.171,.04,.055,.025); box(body,'#282f28',.085,1.3,.171,.04,.055,.025);
  const legs=[]; for(const x of [-.12,.12]) { const leg=new T.Group(); leg.position.set(x,.56,0); body.add(leg); box(leg,zombie?'#444d43':'#435559',0,-.19,0,.16,.4,.18); box(leg,'#3c3c31',0,-.4,.06,.18,.12,.29); legs.push(leg); }
  for(const x of [-.29,.29]) { const arm=box(body,zombie?'#748567':'#ba8a53',x,.89,zombie?.2:.02,.15,.42,.17); if(zombie) arm.rotation.x=-1.1; }
  if(!zombie) { box(body,'#393d35',.31,.83,.34,.12,.12,.57); box(body,'#8d7753',.31,.78,.15,.14,.16,.18); }
  g.userData={body,legs}; return g;
}
function camper(parent) {
  const g = new T.Group(); parent.add(g); g.position.set(-1,0,-1.6); g.rotation.y=-.06;
  box(g,'#3f453e',0,.55,0,8.3,.33,2.8);
  box(g,'#d8d3b5',-.55,1.78,0,6.85,2.2,2.9);
  box(g,'#e5dfc6',-.55,2.9,0,7.12,.2,3.03);
  box(g,'#bc6138',-.52,.99,0,6.94,.48,2.98);
  box(g,'#dfb278',-.52,1.32,1.5,6.92,.075,.025);
  box(g,'#d9d4b8',3.46,1.24,0,1.7,1.02,2.84);
  box(g,'#d4cdb0',3.15,2.05,0,1.05,1,2.78);
  box(g,'#ede6c9',3.1,2.63,0,1.4,.16,2.9);
  box(g,'#2b4341',3.75,2.1,0,.055,.76,2.31);
  box(g,'#303f3c',3.2,2.08,1.403,.8,.7,.025);
  box(g,'#303f3c',3.2,2.08,-1.403,.8,.7,.025);
  box(g,'#9c643e',3.38,.96,1.46,1.56,.28,.05);
  for(const z of [-1.5,1.5]) {
    for(const x of [-2.84,2.8]) {
      const tire=mesh(g,new T.CylinderGeometry(.57,.57,.3,12), '#303632',x,.59,z); tire.rotation.x=Math.PI/2;
      const rim=mesh(g,new T.CylinderGeometry(.29,.29,.32,10),'#9a9b89',x,.59,z); rim.rotation.x=Math.PI/2;
      const hub=mesh(g,new T.CylinderGeometry(.12,.12,.34,8),'#505b56',x,.59,z); hub.rotation.x=Math.PI/2;
    }
    for(const x of [-2.65,-.7]) {
      box(g,'#aea98f',x,2.13,z,1.6,.89,.07);
      box(g,'#293e3c',x,2.14,z*1.026,1.4,.69,.04);
      box(g,'#6d8280',x-.12,2.38,z*1.042,1.12,.09,.012);
      box(g,'#c5c0a1',x+.49,2.13,z*1.047,.08,.72,.02);
    }
  }
  box(g,'#bdb79b',1.02,1.78,1.505,.95,1.99,.06); box(g,'#e1d8b8',1.02,1.77,1.547,.79,1.8,.04);
  box(g,'#324440',1.02,2.22,1.58,.55,.63,.04); box(g,'#625e4c',1.29,1.62,1.59,.08,.08,.04);
  box(g,'#7e8070',1.03,.5,1.84,1.15,.15,.56);
  box(g,'#aaa892',-.7,3.12,-.25,1.28,.3,.88); box(g,'#686f63',-.7,3.29,-.25,.94,.04,.68);
  for(let i=0;i<5;i++) box(g,'#969d8c',-.7,3.32,-.5+i*.12,.94,.025,.025);
  box(g,'#3f575b',-2.63,3.04,-.14,1.54,.09,1.7);
  for(let i=0;i<4;i++) box(g,'#7b9693',-3.17+i*.36,3.1,-.14,.025,.018,1.59);
  for(let i=0;i<3;i++) box(g,'#7b9693',-2.63,3.1,-.68+i*.54,1.48,.018,.025);
  for(let z of [-1.08,1.08]) { box(g,'#ffda91',4.32,1.3,z,.06,.26,.38,true); box(g,'#be6f3c',-4.02,1.05,z,.05,.25,.24); }
  box(g,'#73796d',4.36,.89,0,.16,.21,2.98); box(g,'#404943',4.39,1.13,0,.03,.23,1.3);
  for(let i=0;i<4;i++) box(g,'#899080',4.42,1.06+i*.047,0,.02,.014,1.23);
  // Rear ladder, roof rail, and luggage make the silhouette read at pixel scale.
  for(const z of [-.7,.1]) beam(g,'#8d9484',[-4.05,.8,z],[-4.05,3.25,z],.065);
  for(let i=0;i<8;i++) box(g,'#9ba18d',-4.05,1+i*.29,-.3,.08,.055,.85);
  for(const z of [-1.28,1.28]) beam(g,'#9da28e',[-3.6,3.19,z],[2.45,3.19,z],.05);
  for(const x of [-3.6,2.45]) for(const z of [-1.28,1.28]) box(g,'#9da28e',x,3.08,z,.05,.24,.05);
  box(g,'#867a53',1.33,3.16,-.26,1.1,.4,.82); box(g,'#5c6550',1.32,3.16,-.26,.11,.43,.86);
  return g;
}
function tent(parent,x,z,color,angle) {
  const g=new T.Group(); parent.add(g); g.position.set(x,0,z); g.rotation.y=angle;
  const shape=new T.Shape(); shape.moveTo(-1.45,0); shape.lineTo(0,2.25); shape.lineTo(1.45,0); shape.closePath();
  const geo=new T.ExtrudeGeometry(shape,{depth:2.8,bevelEnabled:false});
  mesh(g,geo,color,0,.06,-1.4);
  const opening=new T.Shape(); opening.moveTo(-.91,0); opening.lineTo(0,1.68); opening.lineTo(.91,0); opening.closePath();
  mesh(g,new T.ShapeGeometry(opening),'#28362a',0,.09,1.405);
  beam(g,'#d3b17d',[0,2.31,-1.5],[0,2.31,1.58],.08);
  beam(g,'#c7b57f',[0,.05,1.58],[0,2.31,1.58],.06);
  for(const a of [-1,1]) { beam(g,'#b8aa76',[a*.6,1.4,1.3],[a*1.9,.06,2.04],.02); box(g,'#615744',a*1.9,.12,2.04,.07,.24,.07); }
  box(g,'#998c57',0,.04,1.98,1.6,.025,1);
}
export function structure(type) {
  const g=new T.Group();
  if(type==='fence') {
    for(let i=0;i<7;i++) { const x=(i-3)*.44; box(g,i%2?'#9b7b4c':'#aa8957',x,.7,0,.28,1.35,.24); mesh(g,new T.ConeGeometry(.2,.27,4),'#b59863',x,1.5,0,1,1,1).rotation.y=Math.PI/4; }
    for(const y of [.45,1.03]) box(g,'#6e593a',0,y,-.19,3.25,.17,.15);
  } else if(type==='tower') {
    for(const x of [-.94,.94]) for(const z of [-.85,.85]) { beam(g,'#887047',[x*1.1,0,z*1.1],[x,3.8,z],.2); box(g,'#afa38a',x*1.1,.13,z*1.1,.43,.26,.43); }
    for(const z of [-.85,.85]) { beam(g,'#a18a59',[-1,.6,z],[1,2.95,z],.13); beam(g,'#79633f',[1,.6,z],[-1,2.95,z],.13); }
    for(let i=0;i<9;i++) box(g,i%2?'#ae905e':'#9f8455',0,3.16,(i-4)*.26,2.5,.17,.23);
    for(const x of [-1.08,1.08]) { box(g,'#b19766',x,3.75,0,.13,.97,2.25); box(g,'#d3b37a',x,4.28,0,.2,.15,2.5); }
    box(g,'#b79b6a',0,3.76,-1.09,2.13,.94,.14); box(g,'#d3b37a',0,4.28,-1.1,2.5,.15,.21);
    for(const x of [-.47,.47]) beam(g,'#bda476',[x,.1,1.62],[x,3.35,1.05],.095);
    for(let i=0;i<9;i++) box(g,'#ccb182',0,.2+i*.35,1.58-i*.06,1,.07,.1);
    const guard=character(); guard.position.set(0,3.27,0); guard.scale.setScalar(.78); g.add(guard);
    box(g,'#5d6546',1.05,4.8,-.8,.065,1.5,.065); box(g,'#b66d42',1.38,5.25,-.8,.66,.41,.045);
  } else {
    box(g,'#676b54',0,.1,0,.6,.2,.6); box(g,'#846f49',0,1.6,0,.15,3.1,.15); beam(g,'#a28c5a',[0,3.1,0],[.9,3.1,0],.12);
    box(g,'#544e37',.78,2.83,0,.035,.52,.035); box(g,'#ffe0a0',.78,2.53,0,.34,.43,.34,true);
    for(const y of [2.28,2.77]) box(g,'#62573c',.78,y,0,.45,.08,.45);
    for(const x of [.59,.97]) for(const z of [-.19,.19]) box(g,'#6c5a3b',x,2.53,z,.035,.43,.035);
  }
  return g;
}
function mergeStatic(group) {
  group.updateMatrixWorld(true);
  const batches=new Map();
  group.traverse(o=>{ if(o.isMesh) { const key=o.material.uuid; if(!batches.has(key)) batches.set(key,{material:o.material,geos:[],cast:o.castShadow}); const geo=o.geometry.clone().applyMatrix4(o.matrixWorld); if(geo.index) { const flat=geo.toNonIndexed(); geo.dispose(); batches.get(key).geos.push(flat); } else batches.get(key).geos.push(geo); } });
  group.clear();
  for(const {material,geos,cast} of batches.values()) { const m=new T.Mesh(mergeGeometries(geos),material); m.castShadow=cast; m.receiveShadow=!material.isMeshBasicMaterial; group.add(m); geos.forEach(g=>g.dispose()); }
}
// Deform the already-batched vegetation on the GPU; shadows use the same wind.
function animateVegetation(group, wind, grass = false) {
  mergeStatic(group);
  const deformation = `
    float phase = position.x * .17 + position.z * .13;
    float breeze = sin(windTime * .85 + phase) * .7 + sin(windTime * 1.37 + phase * 1.8) * .3;
    float weight = ${grass ? 'max(position.y, 0.) * .38' : 'pow(max(position.y, 0.), 2.) * .007'};
    transformed.x += breeze * weight * windStrength;
    transformed.z += sin(windTime * .68 + phase + 1.2) * weight * .55 * windStrength;
  `;
  const patch = shader => {
    shader.uniforms.windTime = wind.time; shader.uniforms.windStrength = wind.strength;
    shader.vertexShader = 'uniform float windTime; uniform float windStrength;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + deformation);
  };
  for (const batch of group.children) {
    batch.material = batch.material.clone(); batch.material.onBeforeCompile = patch;
    batch.material.customProgramCacheKey = () => `pinefall-wind-${grass}`;
    batch.customDepthMaterial = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking });
    batch.customDepthMaterial.onBeforeCompile = patch;
    batch.customDepthMaterial.customProgramCacheKey = () => `pinefall-wind-depth-${grass}`;
    batch.geometry.computeBoundingSphere(); batch.geometry.boundingSphere.radius += 1;
  }
}
export function makeWorld(scene) {
  const fixed=new T.Group(), forest=new T.Group(), meadow=new T.Group(); scene.add(fixed, forest, meadow);
  const wind = { time: { value: 0 }, strength: { value: 1 } };
  const ground=mesh(fixed,new T.PlaneGeometry(MAP.size,MAP.size),new T.MeshStandardMaterial({map:groundTexture(),roughness:1}),0,-.07,0); ground.rotation.x=-Math.PI/2; ground.castShadow=false;
  // Canvas rows follow world +Z after the plane is rotated.
  ground.material.map.flipY=false;
  const trees=[];
  for(let i=0;i<5800;i++) {
    const x=rand(-89,89), z=rand(-89,89);
    if(x>shore(z)-1.1 || isClearing(x,z) || x*x/215+z*z/162<1) continue;
    if(trees.some(t=>(t.x-x)**2+(t.z-z)**2<2.7)) continue;
    const size=rand(3.9,8.7), front=z>12&&Math.abs(x)<13;
    if(front && random()<.3) continue;
    if(random()<.09) birch(forest,x,z,size*.76); else pine(forest,x,z,front?size*.83:size);
    trees.push({x,z,r:.33});
  }
  for(let i=0;i<1000;i++) {
    const x=rand(-89,89),z=rand(-89,89);
    if(x>shore(z)-.8 || (Math.abs(x)<5&&Math.abs(z)<7)) continue;
    if(isClearing(x,z) && random()<.82) continue;
    rock(fixed,x,z,rand(.12,.5));
  }
  // Angular boulders hug the irregular shoreline, with pale shingle underneath.
  for(let z=-89;z<89;z+=.8) { const x=shore(z); rock(fixed,x+rand(-.3,.4),z,rand(.55,1.3)); if(random()>.45) rock(fixed,x-.8,z+.3,rand(.2,.55)); }
  const flowerGeo=new T.PlaneGeometry(.075,.22); flowerGeo.translate(0,.11,0);
  const stems=[];
  for(let i=0;i<16000;i++) {
    const x=rand(-89,89),z=rand(-89,89); if(x>shore(z)-.8 || (isClearing(x,z)&&random()<.93)) continue;
    const stalk=mesh(meadow,flowerGeo,['#9b9e5e','#81904c','#536e40'][i%3],x,0,z); stalk.rotation.y=rand(0,6.28);
    if(i%4===0) { box(meadow,i%8===0?'#d9d1a0':'#b6b882',x,.24,z,.1,.07,.1); stems.push({x,z}); }
  }
  camper(fixed); tent(fixed,-5.5,4.1,'#7c8850',-.2); tent(fixed,5.2,4.3,'#c2753e',.22);
  // Campfire: stone ring, charred logs, glowing coals.
  const fireAt=new T.Vector3(.1,0,5.6);
  for(let i=0;i<13;i++) { const a=i/13*Math.PI*2; rock(fixed,fireAt.x+Math.cos(a)*.88,fireAt.z+Math.sin(a)*.88,rand(.2,.31)); }
  for(let i=0;i<4;i++) { const log=box(fixed,'#59452d',.1,.18,5.6,.22,.22,1.45); log.rotation.y=i*Math.PI/4; }
  mesh(fixed,new T.CylinderGeometry(.59,.68,.05,9),'#e78c35',.1,.09,5.6,1,1,1,true);
  const flames=new T.Group(); flames.position.copy(fireAt); scene.add(flames);
  for(let i=0;i<7;i++) { const f=mesh(flames,new T.ConeGeometry(.25,1,5),i%2?'#ffce61':'#fff0a7',rand(-.3,.3),rand(.3,.65),rand(-.3,.3),rand(.6,1),rand(.65,1.3),rand(.6,1),true); f.userData.seed=random()*10; }
  const fireLight=new T.PointLight('#ffb84f',30,18,1.5); fireLight.position.set(.1,1.7,5.6); scene.add(fireLight);
  const haloCanvas=document.createElement('canvas'); haloCanvas.width=128; haloCanvas.height=128; const hc=haloCanvas.getContext('2d'); const grad=hc.createRadialGradient(64,64,0,64,64,64); grad.addColorStop(0,'rgba(255,172,63,.36)'); grad.addColorStop(.3,'rgba(255,143,28,.14)'); grad.addColorStop(1,'rgba(255,139,24,0)'); hc.fillStyle=grad; hc.fillRect(0,0,128,128);
  const halo=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(haloCanvas),transparent:true,depthWrite:false,blending:T.AdditiveBlending})); halo.position.set(.1,.8,5.6); halo.scale.set(6,6,1); scene.add(halo);
  // Folding chairs, cooler, mugs, crates and a wood pile.
  for(const [x,z,a] of [[-2.1,6.3,-.85],[2.5,6.6,.8]]) { const chair=new T.Group(); fixed.add(chair); chair.position.set(x,0,z); chair.rotation.y=a;
    for(const sx of [-.39,.39]) { beam(chair,'#b1ae91',[sx,.05,-.4],[sx,.76,.4],.045); beam(chair,'#b1ae91',[sx,.05,.4],[sx,.8,-.4],.045); beam(chair,'#a3a48c',[sx,.5,-.4],[sx,1.25,-.5],.045); }
    box(chair,'#a59460',0,.61,0,.79,.055,.77); const back=box(chair,'#b3a16b',0,1,-.47,.78,.53,.05); back.rotation.x=-.12;
  }
  box(fixed,'#577f79',-4.2,.3,1.8,.9,.58,.55); box(fixed,'#d3ceb0',-4.2,.63,1.8,.96,.12,.62);
  box(fixed,'#9e784c',-5.2,.34,-.1,.9,.68,.83); for(let i=0;i<4;i++) box(fixed,'#c0a271',-5.2,.13+i*.17,.32,.96,.05,.05);
  // Picnic table to the left of the RV.
  const table=new T.Group(); table.position.set(-8.5,0,-2.5); table.rotation.y=.22; fixed.add(table);
  for(let i=0;i<5;i++) box(table,i%2?'#ae925b':'#b69b63',(i-2)*.25,1.12,0,.23,.13,2.6);
  for(const x of [-1,1]) box(table,'#a98b53',x,.61,0,.45,.12,2.8);
  for(const z of [-.83,.83]) { beam(table,'#756744',[-.8,0,z],[.45,1.1,z],.13); beam(table,'#756744', [.8,0,z],[-.45,1.1,z],.13); box(table,'#7b6941',0,.5,z,2.3,.12,.15); }
  box(table,'#b65e3c',.1,1.28,-.4,.2,.25,.2); box(table,'#dfd5b0',.1,1.42,-.4,.2,.035,.2); box(table,'#d1c6a0',-.2,1.22,.55,.36,.05,.3);
  // String lights arc from campsite poles across the clearing.
  const bulbs=[], pendants=[]; const wireMat=new T.LineBasicMaterial({color:'#454f39'});
  for(const x of [-9,8.8]) box(fixed,'#75623d',x,2.3,2,.12,4.6,.12);
  const wire=[];
  for(let i=0;i<=40;i++) { const p=new T.Vector3(-9+i/40*17.8,4.6-Math.sin(i/40*Math.PI)*1.05,2); wire.push(p); if(i%3===1) { const pendant=new T.Group(); scene.add(pendant); pendant.position.copy(p); pendant.userData.fraction=i/40; pendants.push(pendant); const bulb=box(pendant,'#ffe1a0',0,-.17,0,.11,.18,.11,true); bulbs.push(bulb); beam(pendant,'#4f5239',[0,0,0],[0,-.12,0],.025); } }
  const lightWire=new T.Line(new T.BufferGeometry().setFromPoints(wire),wireMat); scene.add(lightWire);
  const logs=[];
  for(const [x,z,a] of [[-12,7,-.2],[10,-7,.4],[-8,-12,1.1],[9,14,1.4]]) {
    const g=new T.Group(); fixed.add(g); g.position.set(x,0,z); g.rotation.y=a;
    const trunk=mesh(g,new T.CylinderGeometry(.36,.43,3.2,7),'#695236',0,.42,0); trunk.rotation.z=Math.PI/2;
    for(const side of [-1,1]) { const cut=mesh(g,new T.CylinderGeometry(.3,.3,.015,9),'#b3a075',side*1.61,.42,0); cut.rotation.z=Math.PI/2; }
    beam(g,'#6f5838',[.3,.5,0],[.5,1.1,.5],.13); logs.push({x,z,remaining:4});
  }
  // Dock disappearing into the blue-green water.
  const dock=new T.Group(); fixed.add(dock); dock.position.set(shore(14)+.4,0,14); dock.rotation.y=.12;
  for(let i=0;i<14;i++) box(dock,i%3?'#96875e':'#a9996a',i*.36,.13,0,.33,.17,2.25);
  for(const x of [0,4.4]) for(const z of [-1.03,1.03]) { box(dock,'#675b40',x,.31,z,.19,1.3,.19); box(dock,'#b4a17b',x,1,z,.23,.09,.23); }
  // Shoreline water shader: softly moving faceted ripples and broken foam.
  const waterMat=new T.ShaderMaterial({uniforms:{time:{value:0},day:{value:1}},vertexShader:`varying vec3 world; void main(){world=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(world,1.);}`,fragmentShader:`varying vec3 world; uniform float time; uniform float day; float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);} void main(){float z=world.z;float edge=24.-.19*z+sin(z*.15)*2.2+sin(z*.41)*.6;float d=world.x-edge;if(d<0.)discard;vec2 p=floor(world.xz*5.)/5.;float n=sin(p.x*1.6+p.y*2.4+time*.7)*sin(p.y*3.7-time*.45);vec3 shallow=vec3(.27,.48,.43),deep=vec3(.12,.32,.34);vec3 c=mix(shallow,deep,smoothstep(0.,8.,d));c+=n*.018;float wave=sin(d*8.-time*1.4+sin(z*3.)*.5);if(d<.85&&wave>.66)c=mix(c,vec3(.67,.73,.57),.7);float shine=step(.974,hash(floor(p*vec2(1.3,7.)+vec2(time*.1,0.))))*step(.4,sin(p.y*4.+time));c+=shine*.15;c*=mix(vec3(.3,.45,.62),vec3(1.),day);gl_FragColor=vec4(c,1.);}`});
  const water=mesh(scene,new T.PlaneGeometry(MAP.size,MAP.size),waterMat,0,-.015,0); water.rotation.x=-Math.PI/2; water.castShadow=false;
  mergeStatic(fixed); animateVegetation(forest, wind); animateVegetation(meadow, wind, true);
  return {fixed,trees,flames,fireLight,fireAt,halo,waterMat,logs,wind,lightWire,pendants};
}
