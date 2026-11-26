import * as THREE from 'three';
import { generateTeachingImage } from '../research/image-lab.mjs';
import { haar2D } from '../research/math.mjs';
import { box, material, stock, tube } from './objects.mjs';

function add(group, geometry, surface, x, y, z, shadow = true) {
  const mesh = new THREE.Mesh(geometry, surface);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function fastener(group, x, y, z, r = .015) {
  const screw = add(group, new THREE.CylinderGeometry(r, r, .012, 6), stock.steel, x, y, z);
  screw.rotation.x = Math.PI / 2;
}

function screenTexture(render) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  render(canvas.getContext('2d'));
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

function interfacePlate(group, map, x, y, z, w, h) {
  return add(group, new THREE.PlaneGeometry(w, h), material(0xc5c6bc, .68, .04, { map }),
    x, y, z, false);
}

function traceGraph(ctx) {
  ctx.fillStyle = '#1b2324';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#566058';
  for (let i = 20; i < 254; i += 24) {
    ctx.strokeRect(i, 0, 0, 256);
    ctx.strokeRect(0, i, 256, 0);
  }
}

function opticalDetail(group, glass) {
  const bracket = stock.steel;
  for (const x of [-.30, .35]) {
    box(group, x, .12, 0, .08, .24, .61, bracket);
    for (const z of [-.25, .25]) {
      add(group, new THREE.CylinderGeometry(.032, .032, .018, 6), stock.brass, x, .247, z);
    }
  }
  for (let ray = 0; ray < 6; ray++) {
    const color = material([0x902e26, 0xbc5732, 0xcd982e, 0x638e56, 0x5990ac, 0x685c91][ray], .4, .2);
    box(group, .40 + ray * .028, .171, .07 + ray * .026, .014, .05, .29, color).rotation.y = -.36;
  }
  add(group, new THREE.TorusGeometry(.143, .012, 10, 36), glass, -.34, .40, .069).rotation.y = -.38;
  const pointer = interfacePlate(group, screenTexture(ctx => {
    traceGraph(ctx);
    ctx.strokeStyle = '#adb9a7';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 160);
    ctx.lineTo(100, 160);
    ctx.lineTo(170, 48);
    ctx.lineTo(245, 160);
    ctx.stroke();
  }), .46, .348, -.17, .205, .203);
  pointer.rotation.y = -.20;
}

function glove(group) {
  const metal = stock.steel, rubber = stock.black;
  const origin = new THREE.Group();
  origin.position.set(.30, .57, .285);
  origin.rotation.set(.1, .25, -.27);
  group.add(origin);
  const palm = add(origin, new THREE.SphereGeometry(1, 22, 16), rubber, 0, 0, 0);
  palm.scale.set(.122, .163, .067);
  const plate = box(origin, 0, .015, .048, .168, .16, .046, metal);
  plate.rotation.z = -.12;
  group.userData.fingers = [];
  for (let finger = 0; finger < 5; finger++) {
    const x = (finger - 2) * .048;
    const y = finger === 0 ? .052 : .135;
    const extension = finger === 0 ? .104 : .19 - Math.abs(finger - 2) * .024;
    const curl = .05 + Math.abs(finger - 2) * .022;
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.userData.articulated = true;
    origin.add(pivot);
    group.userData.fingers.push(pivot);
    tube(pivot, [[0, 0, .013], [x * .17, extension * .55, .028],
      [x * .32, extension, curl]], .019, metal, 10);
    add(pivot, new THREE.SphereGeometry(.024, 12, 8), stock.brass, x * .17, extension * .55, .026);
    add(pivot, new THREE.SphereGeometry(.023, 12, 8), rubber, x * .32, extension, curl);
  }
  tube(origin, [[.018,-.12,0],[.036,-.19,.01],[.09,-.29,-.10],[.005,-.46,-.19]], .024, rubber, 12);
}

function researchPlate(group) {
  const image = generateTeachingImage('fields', 32);
  const { coefficients } = haar2D(image, 32);
  const map = screenTexture(ctx => {
    traceGraph(ctx);
    for (let i = 0; i < image.length; i++) {
      const value = image[i];
      const cellX = i % 32;
      const cellY = Math.floor(i / 32);
      ctx.fillStyle = `rgb(${56 + value * 110}, ${61 + value * 143}, ${55 + value * 122})`;
      ctx.fillRect(10 + cellX * 3.7, 61 + cellY * 3.7, 3.8, 3.8);
      const coefficient = Math.min(1, Math.log1p(Math.abs(coefficients[i]) * 32) / 2.1);
      ctx.fillStyle = coefficient === 0 ? '#22292a' : `rgb(${34 + coefficient * 177}, ${41 + coefficient * 145}, ${43 + coefficient * 103})`;
      ctx.fillRect(139 + cellX * 3.35, 67 + cellY * 3.35, 3.5, 3.5);
    }
    ctx.fillStyle = '#c8c1a8';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('FIELD SAMPLE', 9, 38);
    ctx.fillText('HAAR', 139, 38);
    ctx.strokeStyle = '#bda77e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 128; i++) {
      const x = i * 1.80 + 13;
      const y = 229 - 27 * Math.exp(-Math.abs(i - 64) * .058);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  });
  const front = new THREE.Group();
  front.userData.articulated = true;
  group.userData.researchLayer = front;
  front.position.set(-.087, .48, .285);
  front.rotation.y = .11;
  group.add(front);
  box(front, 0, 0, 0, .99, .76, .09, stock.black);
  interfacePlate(front, map, 0, 0, .048, .91, .69);
  for (const x of [-.465, .465]) for (const y of [-.354, .354]) fastener(front, x, y, .05);
  tube(group, [[-.50,.19,.15],[-.54,.079,.15],[-.46,.034,-.05],[-.24,.05,-.21]], .018, stock.brass, 12);
}

function routeFrame(group) {
  for (const x of [-.53, .53]) {
    box(group, x, .55, .062, .027, 1.12, .032, stock.steel).rotation.x = -.27;
    for (let drill = 0; drill < 8; drill++) {
      const y = .15 + drill * .115;
      fastener(group, x * .91, y, .072 - Math.sin((y - .55) * .27), .012);
    }
  }
  box(group, -.35, .105, .14, .20, .105, .049, stock.red);
  box(group, .35, .105, .14, .20, .105, .049, stock.ivory);
}

function measuringScale(group) {
  const dial = screenTexture(ctx => {
    ctx.fillStyle = '#2a2e2c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.translate(128, 128);
    ctx.fillStyle = '#9d8b61';
    ctx.beginPath();
    ctx.arc(0, 0, 118, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#292c2a';
    ctx.beginPath();
    ctx.arc(0, 0, 108, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e1d7ad';
    for (let i = 0; i <= 24; i++) {
      ctx.save();
      ctx.rotate((i - 12) * .13);
      ctx.lineWidth = i % 4 ? 2 : 4;
      ctx.beginPath();
      ctx.moveTo(0, -91);
      ctx.lineTo(0, i % 4 ? -82 : -72);
      ctx.stroke();
      ctx.restore();
    }
    ctx.strokeStyle = '#e76c44';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(0, 13);
    ctx.lineTo(32, -76);
    ctx.stroke();
  });
  add(group, new THREE.CircleGeometry(.165, 40), material(0xffffff, .57, .23, { map: dial }),
    0, .49, .161, false);
  const rim = add(group, new THREE.TorusGeometry(.170, .019, 10, 42), stock.brass, 0, .49, .164);
  rim.receiveShadow = false;
  for (const x of [-.36, .37]) {
    for (let i = 0; i < (x < 0 ? 3 : 2); i++) {
      const weight = add(group, new THREE.CylinderGeometry(.103 - i * .016, .12 - i * .016, .039, 26),
        i % 2 ? stock.black : stock.steel, x, (x < 0 ? .47 : .38) + i * .039, 0);
      weight.rotation.y = .38 * i;
    }
  }
}

function renderSpecimens(group) {
  const metal = stock.steel;
  for (const x of [-.37, 0, .37]) {
    const cage = add(group, new THREE.TorusGeometry(.162, .02, 8, 40), metal, x, .29 + (x === 0 ? .24 : 0), .032);
    cage.rotation.set(.67, .52, -.4);
    box(group, x, .055, .169, .222, .073, .053, stock.brass);
  }
  for (const x of [-.51, .49]) {
    tube(group, [[x,.035,.23],[x,.061,.30],[x * .65,.094,.19]], .013, stock.black, 9);
  }
}

function cameraBellows(group) {
  const gasket = stock.black;
  for (let i = 0; i < 7; i++) {
    const diameter = .63 - .032 * i;
    const sleeve = box(group, -.12, .42, -.05 + .041 * i, diameter, diameter * .88, .021, i % 2 ? stock.iron : gasket);
    sleeve.rotation.z = -.007 * i;
  }
  const lens = add(group, new THREE.SphereGeometry(.13, 30, 20), stock.glass, -.12, .42, .571, false);
  lens.scale.z = .37;
  for (let tooth = 0; tooth < 30; tooth++) {
    const radians = tooth / 30 * Math.PI * 2;
    const strip = box(group, -.12 + Math.cos(radians) * .204, .42 + Math.sin(radians) * .204, .461, .011, .015, .052, stock.steel, false);
    strip.rotation.z = radians;
  }
  for (const x of [-.40,.37]) for (const y of [.145,.63]) fastener(group, x, y, .30);
}

export function detailSpecimen(id, group, glass) {
  if (id === 'optics') opticalDetail(group, glass);
  if (id === 'motion') glove(group);
  if (id === 'research') researchPlate(group);
  if (id === 'crux') routeFrame(group);
  if (id === 'counts') measuringScale(group);
  if (id === 'rendering') renderSpecimens(group);
  if (id === 'vision') cameraBellows(group);
}
