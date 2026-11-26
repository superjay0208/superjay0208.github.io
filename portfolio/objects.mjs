import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { titleGlyphs } from './title-outlines.mjs';

export const stock = {
  steel: material(0x666d6d, .55, .54),
  black: material(0x26292b, .8, .18),
  ivory: material(0xc8bbae, .72),
  iron: material(0x413738, .84, .26),
  red: material(0x98432f, .74),
  brass: material(0xa78a58, .55, .4),
  blue: material(0x496f79, .59, .27),
  glass: material(0x426a61, .25, .3)
};

export function material(color, roughness = .87, metalness = 0, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
}

function mesh(group, geometry, x, y, z, surface, shadow = true) {
  const item = new THREE.Mesh(geometry, surface);
  item.position.set(x, y, z);
  item.castShadow = shadow;
  item.receiveShadow = true;
  group.add(item);
  return item;
}

export function box(group, x, y, z, w, h, d, surface, shadow) {
  return mesh(group, new THREE.BoxGeometry(w, h, d), x, y, z, surface, shadow);
}

export function tube(group, points, radius, surface, segments = 18) {
  const path = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
  return mesh(group, new THREE.TubeGeometry(path, segments, radius, 6, false), 0, 0, 0, surface);
}

function cylinder(group, x, y, z, r, h, surface, segments = 20, r2 = r) {
  return mesh(group, new THREE.CylinderGeometry(r, r2, h, segments), x, y, z, surface);
}

function ring(group, x, y, z, radius, thickness, surface) {
  return mesh(group, new THREE.TorusGeometry(radius, thickness, 8, 26), x, y, z, surface);
}

// Batch static parts by material and shadow flags, while keeping projectors and exhibits movable.
export function batch(group) {
  const sets = new Map();
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert();
  group.traverse(node => {
    if (!node.isMesh || Array.isArray(node.material)) return;
    const key = [node.material.id, node.castShadow, node.receiveShadow].join(':');
    if (!sets.has(key)) sets.set(key, []);
    sets.get(key).push(node);
  });
  for (const items of sets.values()) {
    const first = items[0];
    if (items.length === 1 && first.parent === group) continue;
    const geometries = items.map(item => {
      const geometry = item.geometry.index ? item.geometry.toNonIndexed() : item.geometry.clone();
      geometry.applyMatrix4(inverse.clone().multiply(item.matrixWorld));
      return geometry;
    });
    const combined = new THREE.Mesh(mergeGeometries(geometries), first.material);
    combined.castShadow = first.castShadow;
    combined.receiveShadow = first.receiveShadow;
    group.add(combined);
    for (const item of items) {
      item.removeFromParent();
      item.geometry.dispose();
    }
    for (const geometry of geometries) geometry.dispose();
  }
}

export function makeTitle() {
  const group = new THREE.Group();
  const surface = material(0xb8ae9d, .74, .19);
  const edge = material(0x6a6358, .71, .25);
  let advance = 0;
  for (const char of 'ZIXUN WANG') {
    const glyph = titleGlyphs[char];
    const path = new THREE.ShapePath();
    let startX;
    let startY;
    for (const [method, ...coordinates] of glyph.path) {
      const points = coordinates.map((value, index) => (value + (index % 2 ? 0 : advance)) / 1000);
      if (method === 'moveTo') [startX, startY] = points;
      if (method === 'closePath') path.lineTo(startX, startY);
      else path[method](...points);
    }
    const shapes = path.toShapes(true);
    if (shapes.length) {
      const geometry = new THREE.ExtrudeGeometry(shapes, {
        depth: .082, bevelEnabled: true, bevelThickness: .017, bevelSize: .012,
        bevelSegments: 1, steps: 1, curveSegments: 5
      });
      const letter = new THREE.Mesh(geometry, [surface, edge]);
      letter.castShadow = letter.receiveShadow = true;
      group.add(letter);
    }
    advance += glyph.width + 10;
  }
  const width = (advance - 10) / 1000;
  for (const letter of group.children) letter.position.x -= width / 2;
  return group;
}

function plaque(group, text, y, width) {
  const canvas = document.createElement('canvas');
  canvas.width = 448;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#323330';
  ctx.fillRect(0, 0, 448, 96);
  ctx.fillStyle = '#7e392c';
  ctx.fillRect(0, 0, 22, 96);
  ctx.fillStyle = '#d8c8b4';
  ctx.font = 'bold 35px monospace';
  ctx.fillText(text, 41, 60);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  mesh(group, new THREE.PlaneGeometry(width, width * .215), 0, y, .438, material(0xffffff, .9, 0, { map }), false);
}

function objects() {
  const { steel, black, ivory, iron, red, brass, blue, glass } = stock;
  return {
    optics(group) {
      box(group, 0, .045, 0, .91, .09, .74, black);
      const wedge = new THREE.Shape();
      wedge.moveTo(-.36, -.24);
      wedge.lineTo(.35, -.24);
      wedge.lineTo(.02, .33);
      wedge.closePath();
      const prism = mesh(group, new THREE.ExtrudeGeometry(wedge, { depth: .26, bevelEnabled: true, bevelThickness: .018, bevelSize: .018, bevelSegments: 1 }), .08, .37, -.16, glass);
      prism.rotation.y = -.37;
      for (const [index, color] of [0xbb6750, 0xca9855, 0x7f995e, 0x65939e].entries()) {
        box(group, -.51 + index * .07, .1, .31, .05, .045, .17, material(color, .62));
      }
      ring(group, -.34, .4, .04, .22, .027, brass).rotation.y = -.38;
    },
    motion(group) {
      box(group, 0, .7, -.16, .995, 1.32, .13, iron).rotation.z = -.045;
      for (const [x, y, radius] of [[-.28,.32,.17],[.17,.5,.13],[-.19,.81,.185],[.22,1.09,.16]]) {
        const hold = mesh(group, new THREE.IcosahedronGeometry(radius, 1), x, y, -.02, y > .6 ? red : blue);
        hold.scale.set(1.1, .78, .6);
      }
      for (const x of [-.39, .38]) {
        tube(group, [[x, .1, .18], [x, .33, .21], [x * .78, .59, .27], [x * .55, .76, .12]], .024, brass);
      }
      ring(group, 0, .89, .17, .24, .011, steel);
    },
    research(group) {
      for (let depth = 0; depth < 3; depth++) {
        const plate = new THREE.Group();
        plate.position.set((depth - 1) * .10, .51 + depth * .05, (depth - 1) * -.18);
        plate.rotation.y = .23;
        group.add(plate);
        box(plate, 0, 0, -.04, .86, .85, .05, black);
        for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
          const tones = depth === 0 ? [glass, black, ivory, blue] : [steel, iron, whiteChip, red];
          const value = (col * 3 + row * 7 + col * row + depth) % 4;
          box(plate, (col - 2) * .142, (row - 2) * .142, 0, .133, .133, .034 + .012 * value, tones[value]);
        }
      }
      const path = Array.from({ length: 13 }, (_, i) => {
        const x = (i - 6) * .073;
        return [x, .11 + .22 * Math.exp(-Math.abs(x) * 6.5), .43];
      });
      tube(group, path, .012, brass, 20);
    },
    crux(group) {
      const slope = box(group, 0, .57, -.1, 1.07, 1.14, .10, black);
      slope.rotation.x = -.27;
      for (const [x, y, size, tone] of [[-.25,.24,.2,ivory],[.24,.46,.16,brass],[-.07,.69,.16,ivory],[.24,.89,.135,brass],[-.21,1.08,.20,ivory]]) {
        const chip = mesh(group, new THREE.DodecahedronGeometry(size, 0), x, y, Math.sin((y - .56) * .52) + .04, tone);
        chip.scale.z = .57;
      }
      tube(group, [[-.33, .08, .31], [-.10, .21, .40], [.29, .39, .34], [-.05, .63, .20], [.14, .93, .24]], .009, red);
    },
    counts(group) {
      box(group, 0, .055, 0, .98, .10, .56, iron);
      cylinder(group, 0, .39, 0, .055, .66, brass);
      const arm = box(group, 0, .72, 0, .96, .037, .048, brass);
      arm.rotation.z = -.12;
      for (const [x, y, surface] of [[-.37,.43,black],[.37,.34,ivory]]) {
        for (const z of [-.11, .11]) tube(group, [[x, .72 - x * .12, 0], [x, y, z]], .009, brass, 5);
        cylinder(group, x, y, 0, .22, .047, surface, 6);
      }
      ring(group, 0, .76, 0, .073, .015, steel);
    },
    rendering(group) {
      for (let i = 0; i < 3; i++) {
        const tone = [steel, red, ivory][i];
        const piece = mesh(group, new THREE.IcosahedronGeometry(.23, i === 0 ? 0 : 1), (i - 1) * .37, .25 + (i === 1 ? .24 : 0), -.03, tone);
        piece.scale.set(.84, 1.42, .84);
        piece.rotation.y = .19 * i;
        box(group, (i - 1) * .37, .035, -.045, .34, .07, .53, black);
        for (let band = 0; band < 3; band++) {
          const line = ring(group, (i - 1) * .37, .21 + band * .12 + (i === 1 ? .24 : 0), -.03, .14 + band * .019, .009, black);
          line.rotation.x = Math.PI / 2;
        }
      }
    },
    vision(group) {
      box(group, 0, .4, 0, .86, .64, .58, black);
      box(group, 0, .63, .22, .83, .15, .22, steel);
      for (let i = 0; i < 4; i++) {
        const lens = cylinder(group, -.12, .42, .27 + .058 * i, .255 - i * .028, .13, i % 2 ? brass : iron, 26);
        lens.rotation.x = Math.PI / 2;
      }
      const optic = cylinder(group, -.12, .42, .55, .143, .025, glass, 28);
      optic.rotation.x = Math.PI / 2;
      box(group, .29, .62, .30, .13, .08, .02, ivory);
      for (const x of [-.36, .35]) tube(group, [[x, 0, -.15], [x * .6, .26, -.03], [x * .72, .22, .33]], .019, steel);
    }
  };
}
const whiteChip = material(0x8b887d, .8);
const builders = objects();
const mark = {
  optics: '01 / OPTICS',
  motion: '02 / MOTION',
  research: '03 / FITS',
  crux: '04 / CRUX',
  counts: '05 / VERDICT',
  rendering: '06 / SHADERS',
  vision: '07 / IMAGE'
};

export function makeExhibit(id) {
  const root = new THREE.Group();
  const plinth = new THREE.Group();
  const work = new THREE.Group();
  root.add(plinth, work);
  box(plinth, 0, -.048, 0, 1.26, .096, .92, stock.steel);
  box(plinth, 0, -.34, 0, 1.12, .51, .87, stock.black);
  box(plinth, 0, -.16, .441, 1.05, .033, .015, stock.iron, false);
  plaque(plinth, mark[id], -.36, .69);
  builders[id](work);
  batch(plinth);
  batch(work);
  return { id, root, plinth, work };
}
