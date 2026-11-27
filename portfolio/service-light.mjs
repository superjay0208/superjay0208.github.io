import * as THREE from 'three';
import { batch, box, material, stock, tube } from './objects.mjs';
import { randomSequence } from './atmosphere.mjs';

const clamp = THREE.MathUtils.clamp;
const noise = randomSequence(31907);

function beamAt(point, source, heading, tangent, offset) {
  offset.subVectors(point, source);
  const along = offset.dot(heading);
  if (along <= 0) return 0;
  const radius = Math.sqrt(Math.max(0, offset.lengthSq() - along * along));
  return 1 - THREE.MathUtils.smoothstep(radius, along * tangent * 0.35, along * tangent * 1.12);
}

// Porcelain pivot, cast housing, steel bail and moulded phenolic grip.
function makeBreaker(scene) {
  const body = new THREE.Group();
  const ceramic = material(0xded0ac, 0.32, 0.08);
  const enamel = material(0x64695e, 0.47, 0.45, { map: stock.steel.map });
  const handle = material(0xa9441c, 0.34, 0.14);
  box(body, 0, 0.065, 0, 0.64, 0.13, 0.64, stock.black);
  box(body, 0, 0.123, -0.015, 0.6, 0.12, 0.6, enamel);
  box(body, 0, 0.185, 0, 0.39, 0.051, 0.45, ceramic);
  box(body, 0, 0.22, 0, 0.25, 0.05, 0.32, stock.black);
  for (const x of [-0.245, 0.245])
    for (const z of [-0.233, 0.233]) {
      box(body, x, 0.189, z, 0.038, 0.012, 0.038, stock.steel, false);
    }
  for (const x of [-0.108, 0.108]) {
    box(body, x, 0.234, 0, 0.058, 0.085, 0.12, ceramic);
  }
  tube(
    body,
    [
      [0.22, 0.08, -0.23],
      [0.29, 0.07, -0.35],
      [0.46, 0.03, -0.42],
      [0.56, -0.04, -0.5],
      [0.59, -0.4, -0.54],
    ],
    0.022,
    stock.black,
  );
  batch(body);
  const lever = new THREE.Group();
  box(lever, -0.081, 0.12, 0, 0.028, 0.25, 0.032, stock.steel);
  box(lever, 0.081, 0.12, 0, 0.028, 0.25, 0.032, stock.steel);
  const grip = new THREE.Mesh(new THREE.CapsuleGeometry(0.053, 0.215, 4, 12), handle);
  grip.rotation.z = Math.PI / 2;
  grip.position.y = 0.252;
  grip.castShadow = true;
  lever.add(grip);
  batch(lever);
  body.add(lever);
  lever.position.y = 0.247;
  const pilot = material(0x927047, 0.28, 0.09, { emissive: 0xff9b52, emissiveIntensity: 0.85 });
  box(body, -0.227, 0.19, 0.075, 0.033, 0.018, 0.11, pilot, false);
  scene.add(body);
  return { body, lever, pilot };
}

function makeShutters(scene) {
  const root = new THREE.Group();
  const fixed = new THREE.Group();
  const black = material(0x211e1c, 0.78, 0.24);
  const enamel = material(0x574940, 0.57, 0.39, { map: stock.steel.map });
  const hot = new THREE.MeshBasicMaterial({ color: 0xff5331 });
  box(fixed, 0, 0, 0, 0.93, 2.96, 0.11, black);
  box(fixed, 0, 0, 0.064, 0.68, 2.77, 0.02, hot, false);
  for (const x of [-0.42, 0.42]) {
    box(fixed, x, 0, 0.078, 0.09, 2.98, 0.15, enamel);
    box(fixed, x, 0, 0.158, 0.018, 2.97, 0.018, stock.steel, false);
  }
  batch(fixed);
  root.add(fixed);
  const vanes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.715, 0.263, 0.069), enamel, 11);
  vanes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  vanes.receiveShadow = true;
  root.add(vanes);
  // A single fan of thin shafts. The ribbons originate in the gaps and dissolve into the air.
  const positions = [],
    uvs = [];
  for (let i = 0; i < 11; i++) {
    const y = (i - 5) * 0.249;
    const end = [-1.76, y - 0.76, 2.72];
    const quad = [
      [-0.32, y, 0.18],
      [0.32, y, 0.18],
      [end[0] + 0.62, end[1], end[2]],
      [end[0] - 0.62, end[1], end[2]],
    ];
    for (const j of [0, 1, 2, 0, 2, 3]) {
      positions.push(...quad[j]);
      uvs.push([0, 1, 1, 0][j], [0, 0, 1, 1][j]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const shafts = new THREE.ShaderMaterial({
    uniforms: { power: { value: 0 } },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    forceSinglePass: true,
    vertexShader: `varying vec2 panel;
      void main(){panel=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float power; varying vec2 panel;
      void main(){
        float edge=smoothstep(0.,.22,panel.x)*smoothstep(0.,.22,1.-panel.x);
        float falloff=pow(1.-panel.y,2.65);
        gl_FragColor=vec4(1.,.115,.036,edge*falloff*power);
      }`,
  });
  root.add(new THREE.Mesh(geometry, shafts));
  scene.add(root);
  // Project the eleven openings onto the concrete at a grazing angle. The pool stays on the floor.
  const spill = new THREE.ShaderMaterial({
    uniforms: { open: { value: 0 }, grain: { value: stock.steel.map } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 ground;
      void main(){ ground=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float open; uniform sampler2D grain; varying vec2 ground;
      void main(){
        float forward=1.-ground.y;
        float across=(ground.x-.77+forward*.54)/(.12+forward*.12);
        float penumbra=.065+forward*.31;
        float edge=1.-smoothstep(.67,1.,abs(across));
        float phase=(forward-.05)*12.3 + across*.12;
        float slot=abs(fract(phase)-.5);
        float bars=1.-smoothstep(.022+open*.14,.022+open*.14+penumbra*.57,slot);
        float range=smoothstep(.02,.13,forward)*(1.-smoothstep(.62,.98,forward));
        float grainValue=texture2D(grain,ground*2.).r;
        gl_FragColor=vec4(1.,.135,.041,edge*range*(.05+bars)*(.055+.48*open)*(.37+.72*grainValue));
      }`,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 6.8), spill);
  pool.rotation.x = -Math.PI / 2;
  scene.add(pool);
  return { root, hot, vanes, shafts, pool };
}

// Every folded sheet holds a ninth of the same optical resolution target.
function makeContactSheets(scene) {
  const stockPrint = document.createElement('canvas');
  stockPrint.width = 480;
  stockPrint.height = 672;
  const print = stockPrint.getContext('2d');
  print.scale(.5, .5);
  print.fillStyle = '#c4bcaa';
  print.fillRect(0, 0, 960, 1344);
  for (let i = 0; i < 9; i++) {
    const x = (i % 3) * 320, y = Math.floor(i / 3) * 448;
    print.fillStyle = '#bcb29e';
    print.fillRect(x + 19, y + 48, 281, 332);
    print.fillStyle = '#544d42';
    print.fillRect(x + 22, y + 32, 276, 2);
    print.font = 'bold 12px monospace';
    print.fillText('OPTICAL ALIGNMENT', x + 22, y + 24);
    print.font = '22px monospace';
    print.fillText(String(i + 1).padStart(2, '0'), x + 251, y + 31);
    print.fillRect(x + 23, y + 391, 274, 1);
    print.font = '10px monospace';
    print.fillText('PLATE  /  04', x + 23, y + 410);
    print.strokeStyle = '#9b4a35'; print.lineWidth = 2;
    print.strokeRect(x + 211, y + 396, 84, 28);
    print.fillStyle = '#914831'; print.font = 'bold 12px monospace';
    print.fillText('ARCHIVE', x + 222, y + 415);
  }
  const cx = 480, cy = 672;
  print.fillStyle = '#393b36';
  for (let i = 0; i < 36; i++) {
    const a = (i * Math.PI) / 18;
    print.beginPath();
    print.moveTo(cx, cy);
    print.arc(cx, cy, 421, a, a + Math.PI / 36);
    print.closePath();
    print.fill();
  }
  print.strokeStyle = '#a74632'; print.lineWidth = 8;
  for (const r of [98,443]) {
    print.beginPath(); print.arc(cx, cy, r, 0, Math.PI * 2); print.stroke();
  }
  for (let i = 0; i < 2400; i++) {
    print.fillStyle = noise() > .5 ? '#fff2' : '#2412';
    print.fillRect(noise() * 960, noise() * 1344, 1 + noise() * 2, 1);
  }
  const texture = new THREE.CanvasTexture(stockPrint);
  texture.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(0.42, 0.56, 6, 8);
  const vertices = geo.attributes.position;
  for (let i = 0; i < vertices.count; i++) {
    const x = vertices.getX(i),
      y = vertices.getY(i);
    vertices.setZ(i, 0.16 * Math.abs(x + 0.035) + 0.4 * y * y + 0.045 * Math.sin(y * 10 + 0.7) * x);
  }
  geo.computeVertexNormals();
  const surface = material(0xf2e5cb, 0.91, 0.02, { map: texture, side: THREE.DoubleSide });
  surface.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <uv_vertex>',
      `#include <uv_vertex>
      vMapUv=(vMapUv+vec2(float(gl_InstanceID % 3),float(2-gl_InstanceID / 3)))/3.;`,
    );
  };
  const paper = new THREE.InstancedMesh(geo, surface, 9);
  paper.castShadow = true;
  paper.receiveShadow = true;
  paper.frustumCulled = false;
  paper.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(paper);
  return paper;
}

// Fibres collecting against a pressure difference; both ends are fixed in room coordinates.
function makeFilings(scene) {
  const count = 380,
    data = new Float32Array(count * 3);
  for (let i = 0; i < data.length; i++) data[i] = noise();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
  const uniforms = {
    time: { value: 0 },
    circuit: { value: 0 },
    heat: { value: 0 },
    pixelScale: { value: 500 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    vertexShader: `uniform float time,circuit,heat,pixelScale;
      varying float alpha,shape,filament;
      varying vec2 spin;
      void main(){
        float t=fract(position.x + time*(.043+.046*position.z));
        float rest=1.-t;
        float a=position.y*6.283 + t*(2.3+3.4*circuit);
        float radius=rest*(.28+.67*position.z);
        vec3 path=vec3(-1.38*rest+cos(a)*radius, (position.y-.5)*2.55 + sin(a)*radius, .21+rest*1.74);
        path.y-=rest*rest*(1.-circuit)*.55;
        vec4 eye=modelViewMatrix*vec4(path,1.);
        gl_Position=projectionMatrix*eye;
        filament=step(.83,position.z)*(.25+.75*max(circuit,heat));
        spin=vec2(cos(a),sin(a));
        gl_PointSize=clamp(pixelScale*(.021+.037*position.z+.065*filament)/max(.1,-eye.z),1.1,9.);
        alpha=sin(t*3.14159)*(.10+.50*circuit+.32*heat)*(.35+.65*position.z);
        shape=position.y;
      }`,
    fragmentShader: `varying float alpha,shape,filament;
      varying vec2 spin;
      void main(){vec2 p=gl_PointCoord-.5;
        vec2 flake=vec2(dot(p,spin),dot(p,vec2(-spin.y,spin.x)));
        float d=length(flake*vec2(1.,1.1+shape+3.4*filament));
        gl_FragColor=vec4(1.,.32+.31*shape,.18+.2*shape,alpha*(1.+.48*filament)*(1.-smoothstep(.04,.49,d)));
      }`,
  });
  const filings = new THREE.Points(geometry, mat);
  filings.frustumCulled = false;
  scene.add(filings);
  return { filings, uniforms };
}

export function makeServiceLight(scene) {
  const breaker = makeBreaker(scene),
    shutters = makeShutters(scene),
    sheets = makeContactSheets(scene);
  const { filings, uniforms } = makeFilings(scene);
  const transform = new THREE.Object3D(),
    point = new THREE.Vector3(),
    offset = new THREE.Vector3();
  const anchors = Array.from({ length: sheets.count }, (_, i) => ({
    s: i / (sheets.count - 1),
    twist: noise() * 2 - 1,
    lift: 0,
  }));
  const tray = new THREE.Group();
  const liner = material(0x66584a, 0.78, 0.16, { map: stock.steel.map });
  box(tray, 0, 0, 0, 1.1, 0.065, 0.84, stock.iron);
  box(tray, 0, 0.036, 0, 1.01, 0.016, 0.76, liner, false);
  for (const x of [-0.532, 0.532]) box(tray, x, 0.098, 0, 0.035, 0.19, 0.82, stock.steel);
  box(tray, 0, 0.097, -0.401, 1.03, 0.18, 0.037, stock.steel);
  box(tray, 0, 0.052, 0.4, 1.04, 0.08, 0.037, stock.iron);
  batch(tray);
  scene.add(tray);
  const trayBounds = new THREE.Box3();
  const shutterBounds = new THREE.Box3();
  const rayHit = new THREE.Vector3();
  const hitBounds = new THREE.Box3(new THREE.Vector3(-0.33, 0, -0.32), new THREE.Vector3(0.33, 0.55, 0.32));
  let phone = false,
    level = 0,
    gate = 0,
    vaneAngle = Infinity,
    lastShadowPose = -1;
  let sheetsDirty = true;
  const state = { level: 0, settling: false, shadowDirty: false };
  function layout(narrow, bench, aspect) {
    phone = narrow;
    const [x, y, z, w] = bench;
    const side = phone ? clamp(aspect * 0.61, 0.21, 0.32) : 0.382;
    breaker.body.position.set(x + w * side, y + 0.097, z - (phone ? 0.07 : 0.16));
    breaker.body.rotation.y = phone ? -0.12 : -0.21;
    breaker.body.scale.setScalar(phone ? 0.85 : 1.03);
    breaker.body.updateMatrixWorld(true);
    shutters.root.position.set(phone ? 2.98 : 5.95, phone ? 2.98 : 2.28, -4.06);
    shutters.root.scale.setScalar(phone ? 0.73 : 1);
    shutters.pool.scale.setScalar(phone ? 0.68 : 1);
    shutters.pool.position.set(
      shutters.root.position.x - (phone ? 0.93 : 1.38),
      0.109,
      shutters.root.position.z + (phone ? 2.31 : 3.4),
    );
    tray.position.set(phone ? 1.12 : Math.min(3.91, 2.12 * aspect), 0.155, phone ? 2.46 : 2.5);
    tray.scale.setScalar(phone ? 0.62 : 0.87);
    sheetsDirty = true;
    tray.rotation.y = -0.18;
    trayBounds.setFromObject(tray).expandByScalar(.035);
    shutterBounds.setFromObject(shutters.root.children[0]);
    filings.position.copy(shutters.root.position);
    filings.scale.copy(shutters.root.scale);
    filings.geometry.setDrawRange(0, phone ? 215 : 380);
  }
  function aimAt(ray, target, nearest) {
    let found = false;
    for (const bounds of [trayBounds, sheets.boundingBox, shutterBounds]) {
      if (!bounds || !ray.intersectBox(bounds, rayHit)) continue;
      const distance = ray.origin.distanceToSquared(rayHit);
      if (distance >= nearest) continue;
      nearest = distance;
      target.copy(rayHit);
      if (bounds === trayBounds) target.y += .19 * tray.scale.y;
      found = true;
    }
    return found;
  }
  function update(dt, time, active, still, source, heading, tangent, pixels) {
    const blend = still ? 1 : 1 - Math.exp(-dt / 138);
    const approach = (current, target) =>
      Math.abs(current - target) < 0.003 ? target : current + (target - current) * blend;
    level = approach(level, Number(active));
    breaker.lever.rotation.x = THREE.MathUtils.lerp(0.88, -0.88, level);
    breaker.pilot.emissiveIntensity = 0.64 + level * 1.75;
    point.copy(shutters.root.position);
    const distanceToWall = (point.z - source.z) / Math.min(-.01, heading.z);
    const halfHeight = 1.33 * shutters.root.scale.y;
    point.y = clamp(source.y + heading.y * distanceToWall, point.y - halfHeight, point.y + halfHeight);
    const incidence = beamAt(point, source, heading, tangent, offset);
    gate = approach(gate, incidence);
    const openness = 0.035 + level * 0.72 + gate * (1 - level * 0.55) * 0.42;
    if (Math.abs(openness - vaneAngle) > 0.0002) {
      for (let i = 0; i < shutters.vanes.count; i++) {
        transform.position.set(0, (i - 5) * 0.249, 0.147);
        transform.rotation.set(-0.1 - openness * (1.12 + 0.14 * Math.cos(i * 0.56)), 0, 0);
        transform.scale.set(1, 1, 1);
        transform.updateMatrix();
        shutters.vanes.setMatrixAt(i, transform.matrix);
      }
      shutters.vanes.instanceMatrix.needsUpdate = true;
      vaneAngle = openness;
    }
    shutters.shafts.uniforms.power.value = 0.08 + openness * 0.45;
    shutters.pool.material.uniforms.open.value = openness;
    shutters.hot.color.setRGB(1, 0.029 + openness * 0.103, 0.009 + openness * 0.027);
    uniforms.time.value = time;
    uniforms.circuit.value = level;
    uniforms.heat.value = gate;
    uniforms.pixelScale.value = pixels * 0.68;
    let settling = level !== Number(active) || Math.abs(gate - incidence) > 0.003;
    let shadowPose = 0;
    const scale = tray.scale.x;
    let uploaded = false;
    for (let i = 0; i < anchors.length; i++) {
      const p = anchors[i],
        col = (i % 3) - 1,
        row = 1 - Math.floor(i / 3);
      point.copy(tray.position);
      point.x += col * 0.19 * scale;
      point.y += (0.44 + row * 0.11) * scale;
      const heat = beamAt(point, source, heading, tangent, offset);
      const target = Math.max(heat, level);
      const previousLift = p.lift;
      p.lift = approach(p.lift, target);
      settling ||= Math.abs(p.lift - target) > 0.003;
      const rise = THREE.MathUtils.smoothstep(p.lift, p.s * 0.17, 0.85 + p.s * 0.15);
      shadowPose += rise / anchors.length;
      if (!sheetsDirty && previousLift === p.lift && (still || rise === 0 || rise === 1)) continue;
      const phase = time * 0.81 + p.s * 4;
      const flutter = Math.sin(phase) * rise * (1 - rise);
      transform.position.copy(tray.position);
      transform.position.x += scale * THREE.MathUtils.lerp(p.twist * 0.2, col * 0.401, rise);
      transform.position.y +=
        scale * THREE.MathUtils.lerp(0.079 + i * 0.011, 0.99 + row * 0.53, rise) + flutter * 0.11;
      transform.position.z += scale * THREE.MathUtils.lerp(p.twist * 0.09, -0.14 + (1 - row) * 0.068, rise);
      transform.rotation.set(
        -1.54 + 1.4 * rise + flutter * 0.36,
        0.08 + p.twist * 0.11 * (1 - rise),
        p.twist * 0.44 * (1 - rise) + flutter * 0.3,
      );
      transform.scale.setScalar(scale * 0.94);
      transform.updateMatrix();
      sheets.setMatrixAt(i, transform.matrix);
      uploaded = true;
    }
    if (uploaded) {
      sheets.instanceMatrix.needsUpdate = true;
      sheets.computeBoundingBox();
      sheetsDirty = false;
    }
    state.level = level;
    state.settling = settling;
    state.shadowDirty =
      Math.abs(lastShadowPose - shadowPose) > 0.04 || (!settling && lastShadowPose !== shadowPose);
    if (state.shadowDirty) lastShadowPose = shadowPose;
    return state;
  }
  return { layout, update, aimAt, breaker: breaker.body, hitBounds };
}
