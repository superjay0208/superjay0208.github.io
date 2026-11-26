import * as THREE from 'three';
import { box, material, stock, tube } from './objects.mjs';

export function randomSequence(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

export function makeGrain(kind) {
  const canvas = document.createElement('canvas');
  const dim = canvas.height = canvas.width = 384;
  const ctx = canvas.getContext('2d');
  const noise = randomSequence(kind === 'metal' ? 1728 : 38091);
  const image = ctx.createImageData(dim, dim);
  for (let y = 0; y < dim; y++) for (let x = 0; x < dim; x++) {
    const w = noise(), angle = x * .023 + y * .009;
    const value = kind === 'metal'
      ? 177 + 14 * Math.sin(y * 1.7) + 18 * (w - .5) + 9 * Math.sin(angle)
      : 183 + (w - .5) * 39 - (w < .018 ? 53 : 0) + 22 * Math.sin(x * .017) * Math.sin(y * .022 + x * .009);
    const pixel = (x + y * dim) * 4;
    image.data[pixel] = value;
    image.data[pixel + 1] = value - 1;
    image.data[pixel + 2] = value - 3;
    image.data[pixel + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  if (kind !== 'metal') {
    for (let i = 0; i < 18; i++) {
      const x = noise() * dim;
      const y = noise() * dim;
      const size = 12 + noise() * 70;
      const stain = ctx.createRadialGradient(x, y, 1, x, y, size);
      stain.addColorStop(0, 'rgba(36,31,22,.25)');
      stain.addColorStop(1, 'rgba(36,31,22,0)');
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(.4, 1.6);
      ctx.translate(-x, -y);
      ctx.fillStyle = stain;
      ctx.fillRect(x - size, y - size, size * 2, size * 2);
      ctx.restore();
    }
    for (const x of [18, dim - 18]) for (const y of [28, dim - 28]) {
      ctx.fillStyle = '#545350';
      ctx.beginPath();
      ctx.arc(x, y, 4.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#88847b';
      ctx.fillRect(x - 2, y + 2, 4, 1);
    }
  } else {
    for (let i = 0; i < 85; i++) {
      ctx.fillStyle = i % 5 === 0 ? 'rgba(37,30,25,.29)' : 'rgba(249,243,211,.24)';
      ctx.fillRect(noise() * dim, noise() * dim, 3 + noise() * 47, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (kind === 'metal') texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function reflections(renderer) {
  const stage = new THREE.Scene();
  stage.background = new THREE.Color(0x24282d);
  const source = (position, width, height, color, strength) => {
    const shape = new THREE.Mesh(new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }));
    shape.position.set(...position);
    shape.lookAt(0, 0, 0);
    stage.add(shape);
  };
  source([-6, 5, 1], 3, 6, 0x9eb4d0, 3.4);
  source([3.9, 2.1, -4], 1.6, 5.5, 0xff3018, 2.2);
  source([1.6, 6.8, 2.2], 6.2, .6, 0xe0e9ef, 5.1);
  source([2, 2.5, 8], 4, 2, 0xb0c0cd, 1.12);
  const probe = new THREE.PMREMGenerator(renderer);
  const target = probe.fromScene(stage, .06, .1, 20, { size: 128 });
  probe.dispose();
  stage.traverse(item => {
    if (!item.isMesh) return;
    item.geometry.dispose();
    item.material.dispose();
  });
  return target;
}

export function fixtures(room, concrete, casing) {
  // Tall duct, descending cable trays and misaligned concrete at the service opening.
  const conduit = material(0x262b2d, .61, .46);
  const warning = material(0x692a21, .78, .23);
  for (const x of [-6.9, 6.9]) {
    box(room, x, 4.83, -3.89, .61, 2.02, .53, casing);
    for (let slat = 0; slat < 9; slat++) {
      box(room, x, 4.22 + slat * .104, -3.61, .48, .033, .025, conduit, false);
    }
    for (const offset of [-.11, .12]) {
      tube(room, [[x + offset, 5.3, -4.05], [x + offset, 5.25, -3.68], [x + offset, 4.46, -3.7],
        [x + offset * 2.7, 3.88, -4.07], [x + offset * 2.7, .36, -4.41]], .026, conduit, 24);
    }
  }
  for (let i = 0; i < 5; i++) {
    const slab = box(room, 5.93 + i * .34, 4.67 + i * .24, -3.77 - i * .06, .88, .25, 1.21, concrete);
    slab.rotation.set(.12 * i, -.12, -.36 + i * .06);
  }
  box(room, 6.84, 1.86, -4.38, .14, 3.13, .12, warning);
  for (const side of [-1, 1]) {
    box(room, 5.95 + side * .51, 1.29, -4.182, .065, 2.28, .058, stock.steel, false);
  }
  box(room, 6.22, 1.17, -4.162, .051, .27, .06, stock.brass);
  for (let i = 0; i < 4; i++) {
    box(room, -5.97 + i * .11, .149, -.03, .068, .016, .31, i % 2 ? stock.brass : stock.black, false).rotation.y = -.54;
  }
}

function glowMap() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,.86)');
  glow.addColorStop(.15, 'rgba(255,255,255,.36)');
  glow.addColorStop(.47, 'rgba(255,255,255,.09)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

export function makeGlows(scene) {
  const map = glowMap();
  const glow = (color, opacity, width, height, x, y, z) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color, opacity, transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.AdditiveBlending, fog: false
    }));
    sprite.scale.set(width, height, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
    return sprite;
  };
  glow(0xdf311d, .82, 2.43, 1.38, 5.95, 2.67, -3.87);
  glow(0xb2d3ff, .61, 3.8, .78, -4.96, 5.32, -2.29);
  glow(0xc2d8f2, .29, 3.6, .54, 4.96, 5.33, -2.29);
  return glow(0xa3cbf1, .76, .88, .43, 0, 0, 0);
}

// World-space particles. The projector cone exposes dust that is otherwise nearly invisible.
export function makeDust(scene) {
  const maximum = 950;
  const data = new Float32Array(maximum * 3);
  const variation = new Float32Array(maximum * 3);
  const noise = randomSequence(251217038);
  for (let i = 0; i < maximum; i++) {
    const central = i % 3 !== 0;
    data.set([(noise() - .5) * (central ? 10 : 17), .12 + noise() * 6, -4.5 + noise() * 11.8], i * 3);
    variation.set([noise(), noise(), noise()], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
  geometry.setAttribute('variation', new THREE.BufferAttribute(variation, 3));
  const uniforms = {
    time: { value: 0 }, energy: { value: 0 }, origin: { value: new THREE.Vector3() },
    heading: { value: new THREE.Vector3() }, wake: { value: new THREE.Vector3() },
    scale: { value: 360 }, resonance: { value: 0 }, specimen: { value: new THREE.Vector3() }
  };
  const dust = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 variation;
      uniform float time, energy, scale, resonance;
      uniform vec3 origin, heading, wake, specimen;
      varying vec3 color;
      varying float brightness, stripe;
      void main() {
        float speed = .28 + variation.x * .68;
        vec3 point = position + vec3(
          sin(time * speed + 33. * variation.x) * .18,
          sin(time * (speed + .37) + variation.y * 45.) * .14,
          cos(time * speed + 37. * variation.z) * .21
        );
        vec3 offset = point - origin;
        float local = exp(-dot(offset, offset) * .47);
        point += wake * local * (.22 + variation.y * .80);
        vec3 aboutSpecimen = point - specimen;
        float nearExhibit = exp(-dot(aboutSpecimen, aboutSpecimen) * 1.3);
        point.y += resonance * nearExhibit * (.22 + variation.x * .3);
        offset = point - origin;
        float axial = dot(offset, heading);
        float spread = length(offset - axial * heading);
        float beam = (1. - smoothstep(.10, .226, spread / max(axial, .05))) * smoothstep(.08, .70, axial);
        float redZone = smoothstep(1.8, 5.8, point.x) * (1. - smoothstep(-.8, 1.7, point.z));
        float blink = .63 + .37 * sin(time * speed + variation.z * 45.);
        color = mix(vec3(.51, .68, .86), vec3(1., .17, .095), redZone * (1. - beam));
        brightness = blink * (.035 + redZone * .085 + beam * (.73 + energy * .37) +
          resonance * nearExhibit * .30 + local * energy * .11);
        stripe = step(.94, variation.x) * energy;
        vec4 lens = modelViewMatrix * vec4(point, 1.);
        gl_Position = projectionMatrix * lens;
        gl_PointSize = clamp(scale * (.019 + variation.z * .092) / max(1., -lens.z), 1., 6.2);
      }`,
    fragmentShader: `
      varying vec3 color;
      varying float brightness, stripe;
      void main() {
        vec2 point = gl_PointCoord * 2. - 1.;
        float shape = 1. - smoothstep(.11, 1., length(point * vec2(1. + stripe, 1.)));
        gl_FragColor = vec4(color, shape * shape * brightness);
      }`
  }));
  dust.frustumCulled = false;
  scene.add(dust);
  return { geometry, uniforms };
}


export function makeFragments(scene) {
  const noise = randomSequence(81701);
  const pieces = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1), material(0x7b6053, .78, .22), 37);
  pieces.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pieces.receiveShadow = true;
  const frame = new THREE.Object3D();
  const location = new THREE.Vector3();
  const toward = new THREE.Vector3();
  const particles = Array.from({ length: pieces.count }, () => ({
    x: 4.0 + noise() * 2.9, y: 2.72 + noise() * 2.45, z: -4.11 + noise() * 1.88,
    scale: .012 + noise() ** 2 * .055, phase: noise() * Math.PI * 2,
    speed: .18 + noise() * .48, drift: .04 + noise() * .25
  }));
  scene.add(pieces);
  return function driftFragments(time, source, direction) {
    for (const [index, piece] of particles.entries()) {
      const { x, y, z, scale, phase, speed, drift } = piece;
      const progress = time * speed + phase;
      location.set(x + Math.sin(progress) * drift, y + Math.cos(progress * .79) * drift, z + Math.sin(progress * .68) * drift);
      toward.subVectors(location, source).normalize();
      const influence = THREE.MathUtils.smoothstep(toward.dot(direction), .98, .998);
      location.y += influence * .14;
      frame.position.copy(location);
      frame.scale.set(scale * 1.6, scale * .38, scale);
      frame.rotation.set(progress * .67, progress, phase + influence);
      frame.updateMatrix();
      pieces.setMatrixAt(index, frame.matrix);
    }
    pieces.instanceMatrix.needsUpdate = true;
  };
}
