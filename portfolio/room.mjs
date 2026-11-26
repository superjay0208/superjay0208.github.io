import * as THREE from 'three';
import { createProjectorModel } from './projector.ts';
import { detailSpecimen } from './specimens.mjs';
import { batch, box, makeExhibit, makeTitle, material, stock, tube } from './objects.mjs';

import { makeExhibitReaction } from './exhibit-reactions.mjs';
import { makeRoomParticles } from './room-particles.mjs';
import { fixtures, makeDust, makeFragments, makeGlows, makeGrain, reflections } from './atmosphere.mjs';

const clamp = THREE.MathUtils.clamp;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const LENS = new THREE.Vector3(0, .045, -.475);
const SETUPS = {
  wide: {
    eye: [.85, 3.12, 10.7], look: [0, 1.83, -.90], fov: 42,
    title: [0, 3.35, -4.15], textScale: 2.10,
    base: [-.75, 1.03, 5.55], projectorScale: 1.84, travel: 1.64,
    bench: [-.80, .59, 5.60, 4.84, 2.09],
    exhibits: [
      ['motion', -4.68, 1.58, -2.93], ['research', -1.65, 1.58, -2.93],
      ['rendering', 1.61, 1.58, -2.93], ['vision', 4.64, 1.58, -2.93],
      ['crux', -3.42, .70, -.67], ['optics', .02, .70, -.67], ['counts', 3.28, .70, -.67]
    ]
  },
  tall: {
    eye: [.12, 3.94, 12.42], look: [0, 1.67, -1.1], fov: 44,
    title: [0, 4.29, -4.14], textScale: 1.21,
    base: [-.40, 1.03, 6.12], projectorScale: 2.15, travel: .96,
    bench: [-.08, .565, 6.13, 3.83, 1.92],
    exhibits: [
      ['motion', -2.32, 2.82, -3.62], ['research', -.78, 2.82, -3.62],
      ['rendering', .78, 2.82, -3.62], ['vision', 2.32, 2.82, -3.62],
      ['crux', -1.82, 1.07, -.66], ['optics', 0, 1.07, -.66], ['counts', 1.82, 1.07, -.66]
    ]
  }
};

function structure() {
  const room = new THREE.Group();
  const dark = material(0x232528);
  const concreteMap = makeGrain('concrete');
  const walls = material(0x939392, .96, .04, { map: concreteMap, bumpMap: concreteMap, bumpScale: .048, envMapIntensity: .27 });
  const floor = material(0x666867, .40, .24, { map: concreteMap, roughnessMap: concreteMap, envMapIntensity: .58 });
  const casing = material(0x393e40, .69, .36);
  const redLight = material(0x8a1a0c, .45, 0, { emissive: 0xf02512, emissiveIntensity: 2.4 });
  const whiteLight = material(0x6e7a7d, .43, 0, { emissive: 0xa0b5bd, emissiveIntensity: 1.4 });
  box(room, 0, 3.08, -4.85, 27, 6.55, .35, dark);
  for (let row = 0; row < 3; row++) for (let col = -6; col <= 6; col++) {
    box(room, col * 2.16, .99 + row * 2.02, -4.63, 2.135, 1.998, .24, walls, false);
  }
  box(room, 0, 0, 2, 26, .2, 25, dark, false);
  for (let x = -4; x <= 4; x++) for (let z = -1; z <= 4; z++) {
    box(room, x * 2.65, .07, z * 2.65 - .95, 2.626, .075, 2.626, floor, false);
  }
  for (const x of [-7.56, 7.56]) {
    for (const z of [-4.03, -.9, 2.24, 5.37]) {
      box(room, x, 3.06, z, .81, 6.1, .97, walls);
    }
    box(room, x * 1.12, 3.15, 1.75, .26, 6.30, 13.15, dark);
  }
  for (const z of [-4, -.75, 2.5, 5.75, 9]) {
    box(room, 0, 5.90, z, 18.1, .42, .58, walls);
  }
  box(room, 0, 6.27, 2.2, 25, .25, 18, dark);
  for (const side of [-1, 1]) {
    box(room, side * 5.95, 1.35, -4.40, 1.29, 2.51, .19, casing);
    box(room, side * 5.95, 1.30, -4.29, 1.09, 2.37, .05, dark);
    box(room, side * 5.95, 2.69, -4.23, 1.30, .15, .25, casing);
    box(room, side * 5.95, 2.69, -4.084, .89, .023, .03, redLight, false);
    for (let vent = 0; vent < 5; vent++) {
      box(room, side * 5.95, .54 + vent * .092, -4.252, .73, .034, .02, casing, false);
    }
    box(room, side * 4.96, 5.42, -2.5, 2.39, .10, .31, casing);
    box(room, side * 4.96, 5.36, -2.5, 2.17, .035, .13, whiteLight, false);
  }
  for (let rung = 0; rung < 10; rung++) {
    box(room, -5.83, .166, 1.06 + rung * .32, .49, .036, .16, stock.black, false);
  }
  tube(room, [[-7.1,.19,4.65],[-4.1,.15,4.38],[-3.3,.155,5.27],[-1.8,.15,6.7],[.24,.19,6.81],[.32,.78,6.35]], .025, stock.black, 29);
  fixtures(room, walls, casing);
  batch(room);
  return room;
}

function makeBench(layout) {
  const [x, y, z, width, depth] = layout.bench;
  const bench = new THREE.Group();
  const laminate = material(0x484743, .65, .32, { map: stock.steel.map, roughnessMap: stock.steel.roughnessMap });
  box(bench, x, y + .042, z, width, .105, depth, laminate);
  box(bench, x, y - .03, z, width - .03, .062, depth - .038, stock.steel);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    box(bench, x + side * (width / 2 - .22), y / 2, z + end * (depth / 2 - .19), .104, y, .11, stock.black);
  }
  for (const end of [-1, 1]) box(bench, x, .245, z + end * (depth / 2 - .19), width - .30, .055, .06, stock.black);
  for (let bolt = 0; bolt < 7; bolt++) {
    box(bench, x - width * .42 + bolt * width * .14, y + .096, z + depth * .45, .027, .012, .027, stock.steel);
  }
  for (const side of [-1, 1]) {
    box(bench, x + side * (width * .46), y + .068, z, .045, .055, depth * .91, stock.iron);
  }
  batch(bench);
  return bench;
}

function beamVolume() {
  const surface = new THREE.ShaderMaterial({
    uniforms: {
      origin: { value: new THREE.Vector3() },
      direction: { value: new THREE.Vector3() },
      throwLength: { value: 0 },
      angleSquared: { value: 0 },
      energy: { value: 0 },
      occlusion: { value: null },
      projectorMatrix: { value: new THREE.Matrix4() }
    },
    vertexShader: `
      varying vec3 worldPoint;
      void main() {
        worldPoint = (modelMatrix * vec4(position, 1.)).xyz;
        gl_Position = projectionMatrix * viewMatrix * vec4(worldPoint, 1.);
      }`,
    fragmentShader: `
      uniform vec3 origin;
      uniform vec3 direction;
      uniform float throwLength;
      uniform float angleSquared, energy;
      uniform highp sampler2DShadow occlusion;
      uniform mat4 projectorMatrix;
      varying vec3 worldPoint;
      void main() {
        vec3 ray = normalize(worldPoint - cameraPosition);
        vec3 fromLens = worldPoint - origin;
        float alongRay = dot(ray, direction);
        float axialStart = dot(fromLens, direction);

        // worldPoint is already on the cone. Solve for the other
        // intersection, then integrate a short chord of illuminated haze.
        float a = alongRay * alongRay - angleSquared;
        float halfB = axialStart * alongRay - angleSquared * dot(fromLens, ray);
        float chord = abs(a) < 0.00001 ? 0. : max(0., -2. * halfB / a);
        float endPlane = alongRay > 0. ? throwLength : 0.;
        if (abs(alongRay) > 0.00001) chord = min(chord, max(0., (endPlane - axialStart) / alongRay));
        float scatter = 0.;
        for (int i = 0; i < 5; ++i) {
          vec3 point = fromLens + ray * chord * ((float(i) + .5) / 5.);
          float axial = dot(point, direction);
          float radius = length(point - direction * axial);
          float width = max(.01, axial * sqrt((1. - angleSquared) / angleSquared));
          float feather = 1. - smoothstep(.60, 1., radius / width);
          float grain = .90 + .10 * sin(16. * point.x + 5. * point.y) * sin(9. * point.z - 13. * point.y);
          vec4 projected = projectorMatrix * vec4(origin + point, 1.);
          vec3 coordinates = projected.xyz / projected.w;
          float lit = texture(occlusion, vec3(coordinates.xy, coordinates.z - 0.0007));
          scatter += lit * feather * grain / (1. + axial * axial * .057);
        }
        float density = min(.18, scatter * chord * (.039 + energy * .026));
        gl_FragColor = vec4(.63, .75, .91, density);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  return new THREE.Mesh(new THREE.ConeGeometry(1, 1, 48, 1, true), surface);
}

export function mountRoom({ room, canvas, grip, reveal, links }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.23;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131514);
  scene.fog = new THREE.FogExp2(0x242a30, .037);
  const brushed = makeGrain('metal');
  for (const [name, surface] of Object.entries(stock)) {
    if (name === 'glass') continue;
    surface.map = brushed;
    surface.roughnessMap = brushed;
    surface.bumpMap = brushed;
    surface.bumpScale = name === 'ivory' ? .012 : .024;
    surface.envMapIntensity = name === 'steel' || name === 'brass' ? .87 : .48;
  }
  scene.environment = reflections(renderer).texture;
  scene.environmentIntensity = .48;
  const camera = new THREE.PerspectiveCamera(42, 1, .14, 34);
  scene.add(structure());
  const title = makeTitle();
  scene.add(title);

  scene.add(new THREE.HemisphereLight(0xa2b7ca, 0x625751, .77));
  const strip = new THREE.DirectionalLight(0xc0d5f0, 1.25);
  strip.position.set(-4.9, 6.1, 2.1);
  strip.castShadow = true;
  strip.shadow.autoUpdate = false;
  strip.shadow.mapSize.set(1024, 1024);
  Object.assign(strip.shadow.camera, { left: -9, right: 9, top: 7, bottom: -7, far: 25 });
  strip.shadow.bias = -.00022;
  strip.shadow.normalBias = .027;
  strip.shadow.radius = 2.75;
  scene.add(strip);
  const kick = new THREE.PointLight(0xff341e, 68, 10.6, 2);
  kick.position.set(5.65, 3.20, -3.5);
  scene.add(kick);
  const blueSpill = new THREE.PointLight(0xbecee9, 27, 8.7, 2);
  blueSpill.position.set(-4.35, 4.05, -3.06);
  scene.add(blueSpill);
  const bounce = new THREE.PointLight(0xf26638, 11, 8, 2);
  bounce.position.set(6.32, .52, -2.30);
  scene.add(bounce);
  const frontBounce = new THREE.PointLight(0xbbd4ed, 34, 9, 2);
  frontBounce.position.set(-3.4, 3.63, 7.1);
  scene.add(frontBounce);

  const projector = createProjectorModel();
  const projectorMaterials = new Set();
  projector.traverse(item => {
    if (!item.isMesh || item.material.map || item.material.emissiveIntensity > 1) return;
    if (projectorMaterials.has(item.material)) return;
    projectorMaterials.add(item.material);
    item.material.map = brushed;
    item.material.bumpMap = brushed;
    item.material.bumpScale = .015;
  });
  batch(projector);
  scene.add(projector);
  const beam = beamVolume();
  scene.add(beam);
  const lensGlow = makeGlows(scene);
  const dust = makeDust(scene);
  const bursts = makeRoomParticles(scene);
  const driftFragments = makeFragments(scene);
  const spot = new THREE.SpotLight(0xdcecff, 610, 24, .197, .53, 2);
  spot.castShadow = true;
  spot.shadow.autoUpdate = false;
  spot.shadow.mapSize.set(1536, 1536);
  spot.shadow.camera.near = .16;
  spot.shadow.bias = -.00027;
  spot.shadow.normalBias = .017;
  spot.shadow.radius = 4.25;
  scene.add(spot, spot.target);
  beam.onBeforeRender = () => {
    beam.material.uniforms.occlusion.value = spot.shadow.map.depthTexture;
    beam.material.uniforms.projectorMatrix.value.copy(spot.shadow.matrix);
  };

  const entries = new Map([...links.keys()].map(id => {
    const entry = makeExhibit(id);
    detailSpecimen(id, entry.work, stock.glass);
    batch(entry.work);
    entry.bounds = new THREE.Box3();
    entry.activation = 0;
    entry.gesture = 0;
    entry.reaction = makeExhibitReaction(entry, scene);
    scene.add(entry.root);
    return [id, entry];
  }));
  const raycaster = new THREE.Raycaster();
  const cursor = new THREE.Vector2();
  const position = new THREE.Vector3();
  const liftedAim = new THREE.Vector3();
  const source = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const toObject = new THREE.Vector3();
  const projectorBounds = new THREE.Box3();
  const projectorLocalBounds = new THREE.Box3().setFromObject(projector).expandByScalar(.085);
  const projectorHits = [];
  const matrix = new THREE.Matrix4();
  const screen = new THREE.Vector3();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const witness = new THREE.Vector3();
  const targetPoint = new THREE.Vector3();
  const pickLocation = new THREE.Vector3();
  const projectorBase = new THREE.Vector3();
  const initialAim = new THREE.Vector3();
  const goalPosition = new THREE.Vector3();
  const goalAim = new THREE.Vector3();
  const wake = new THREE.Vector3();
  const burstPoint = new THREE.Vector3();
  const contour = new THREE.Vector3();
  const hover = new THREE.Vector2();
  const delta = new THREE.Vector3();
  const inspection = new THREE.Vector2();
  const response = {power:0, progress:0, side:0, lastSide:1, time:0, x:0, y:0, source};
  let opening;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previousPreference;
  try { previousPreference = localStorage.getItem('zw-motion'); } catch { /* Settings storage is optional. */ }

  let layout, bench, grab, pendingClick, selected, frame = 0, lastTime = 0;
  let visible = true;
  let steered = false;
  let available = true;
  let lastInput = -Infinity;
  let particleTime = 0;
  let dustTimer = 0;
  let angle = 0;
  let lastFrame = 0;
  let lightDirty = true;
  let downstroke = false, lastPuff = -Infinity;
  let aperture = spot.angle, targetAperture = spot.angle;
  let resolutionPenalty = 1, slowFrames = 0;
  let width = 0, height = 0;
  let chosenAt = -Infinity;
  let pinch;

  function stillsOnly() {
    return reduced.matches || previousPreference === 'off';
  }

  function renderSize() {
    const budget = layout === SETUPS.tall ? 1100000 : 2780000;
    const quality = Math.min(devicePixelRatio || 1, 2.1, Math.sqrt(budget / (width * height)));
    renderer.setPixelRatio(quality * resolutionPenalty);
    renderer.setSize(width, height, false);
    dust.uniforms.scale.value = Math.min(980, canvas.height * .77);
    bursts.resize(layout === SETUPS.tall, Math.min(1130, canvas.height * .86));
  }

  function wakeRoom() {
    lastInput = performance.now();
    schedule();
  }

  function quietRoom() {
    cancelAnimationFrame(frame);
    clearTimeout(dustTimer);
    frame = 0;
    dustTimer = 0;
    lastTime = 0;
    lastFrame = 0;
  }

  function schedule() {
    if (!frame && visible && !document.hidden && available) frame = requestAnimationFrame(draw);
  }

  function resize() {
    width = room.clientWidth;
    height = room.clientHeight;
    if (!width || !height) return;
    const next = width / height < .92 ? SETUPS.tall : SETUPS.wide;
    camera.aspect = width / height;
    camera.position.set(...next.eye);
    camera.lookAt(...next.look);
    camera.fov = next.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const [shadowSize, particles] = next === SETUPS.tall ? [1536, 1080] : [2048, 1850];
    if (spot.shadow.mapSize.x !== shadowSize) {
      spot.shadow.mapSize.set(shadowSize, shadowSize);
      spot.shadow.map?.dispose();
      spot.shadow.map = null;
    }
    dust.geometry.setDrawRange(0, particles);
    lightDirty = true;
    if (next !== layout) {
      if (bench) {
        bench.removeFromParent();
        bench.traverse(item => { if (item.isMesh) item.geometry.dispose(); });
      }
      bench = makeBench(next);
      scene.add(bench);
      title.position.set(...next.title);
      title.scale.setScalar(next.textScale);
      for (const [id, x, y, z] of next.exhibits) {
        const entry = entries.get(id);
        entry.root.position.set(x, y, z);
        entry.root.scale.setScalar(next === SETUPS.tall ? .91 : 1.13);
        entry.bounds.setFromObject(entry.root).expandByScalar(.075);
        placeBracket(entry, x, y, z);
      }
      projectorBase.set(...next.base);
      projector.scale.setScalar(next.projectorScale);
      initialAim.set(-.62, next.title[1] + .63, -4.30);
      position.copy(projectorBase);
      goalPosition.copy(position);
      liftedAim.copy(initialAim);
      goalAim.copy(initialAim);
      steered = false;
      opening = null;
      select(null);
      layout = next;
      downstroke = false;
      refreshLight();
      strip.shadow.needsUpdate = true;
    }
    renderSize();
    wakeRoom();
  }

  function refreshLight() {
    projector.position.copy(position);
    matrix.lookAt(position, liftedAim, UP);
    projector.quaternion.setFromRotationMatrix(matrix);
    projector.rotateZ(angle);
    projector.updateMatrixWorld(true);
    source.copy(LENS).applyMatrix4(projector.matrixWorld);
    direction.subVectors(liftedAim, source).normalize();
    spot.angle = aperture;
    spot.intensity = 610 * (.197 / aperture) ** .58;
    spot.position.copy(source);
    spot.target.position.copy(liftedAim);
    const depth = Math.min(14, (-4.50 - source.z) / Math.min(-.15, direction.z));
    const rim = Math.tan(spot.angle) * depth;
    beam.scale.set(rim, depth, rim);
    beam.position.copy(source).addScaledVector(direction, depth / 2);
    beam.quaternion.setFromUnitVectors(DOWN, direction);
    const uniforms = beam.material.uniforms;
    uniforms.origin.value.copy(source);
    uniforms.direction.value.copy(direction);
    uniforms.throwLength.value = depth;
    uniforms.angleSquared.value = Math.cos(spot.angle) ** 2;
    uniforms.energy.value = Math.min(1, wake.length() * .8);
    lensGlow.position.copy(source).addScaledVector(direction, .07);
    lensGlow.material.opacity = .86 + uniforms.energy.value * .12;
  }

  function draw(now) {
    frame = 0;
    if (!layout || !visible || document.hidden || !available) return;
    const dt = lastTime ? Math.min(48, now - lastTime) : 16;
    const immediate = stillsOnly();
    const lensShift = Math.abs(targetAperture - aperture);
    const focusing = lensShift > .0005;
    aperture = immediate || !focusing ? targetAperture
      : THREE.MathUtils.lerp(aperture, targetAperture, 1 - Math.exp(-dt / 86));
    const displacement = position.distanceToSquared(goalPosition) + liftedAim.distanceToSquared(goalAim);
    const moving = displacement > .00004;
    const targetRoll = grab?.moved && !immediate ? clamp((goalPosition.x - position.x) * -.12, -.11, .11) : 0;
    const rolling = Math.abs(angle - targetRoll) > .001;
    if (moving && !immediate) {
      const fraction = 1 - Math.exp(-dt / (grab?.moved ? 34 : 58));
      delta.subVectors(goalPosition, position);
      wake.lerp(delta.multiplyScalar(1.7), .24);
      position.lerp(goalPosition, fraction);
      liftedAim.lerp(goalAim, fraction);
      lastTime = now;
    } else {
      position.copy(goalPosition);
      liftedAim.copy(goalAim);
      lastTime = 0;
    }
    angle = rolling ? THREE.MathUtils.lerp(angle, targetRoll, .22) : targetRoll;
    if (!moving) wake.multiplyScalar(.84);

    if (displacement || rolling || lensShift || lightDirty) {
      refreshLight();
      updateGrip();
      updateSelection();
      spot.shadow.needsUpdate = true;
      lightDirty = false;
    }
    const reacting = animateSpecimens(dt, immediate, now);
    const elapsed = lastFrame ? now - lastFrame : 16;
    if (!immediate) particleTime += Math.min(82, elapsed) * .001;
    lastFrame = now;
    const frantic = !immediate && (grab?.moved || pendingClick?.moved || moving || focusing);
    slowFrames = frantic && elapsed > 28 ? slowFrames + 1 : 0;
    if (resolutionPenalty === 1 && slowFrames >= 5) {
      resolutionPenalty = .78;
      renderSize();
    } else if (resolutionPenalty < 1 && !frantic && now - lastInput > 550) {
      resolutionPenalty = 1;
      renderSize();
    }

    if (immediate) downstroke = false;
    if (downstroke && position.y - projectorBase.y < .054) {
      burstPoint.copy(position);
      burstPoint.y = layout.bench[1] + .11;
      bursts.emit('impact', burstPoint, particleTime, 1);
      downstroke = false;
    }
    if (!immediate && grab?.moved && wake.lengthSq() > .18 && particleTime - lastPuff > .105) {
      burstPoint.copy(source).addScaledVector(direction, .32);
      bursts.emit('wake', burstPoint, particleTime, wake.length());
      lastPuff = particleTime;
    }
    bursts.update(particleTime, source, direction, aperture, !immediate);
    const uniforms = dust.uniforms;
    uniforms.time.value = particleTime;
    uniforms.origin.value.copy(source);
    uniforms.heading.value.copy(direction);
    uniforms.aperture.value = Math.tan(aperture);
    uniforms.wake.value.copy(wake);
    uniforms.energy.value = Math.min(1, wake.length() * 1.45);
    uniforms.resonance.value = selected?.activation ?? 0;
    if (selected) uniforms.specimen.value.copy(selected.root.position).y += .55;
    driftFragments(particleTime, source, direction);
    renderer.render(scene, camera);

    if (opening?.complete) {
      const destination = links.get(opening.entry.id);
      if (opening.entry.id === 'vision') document.getElementById('project-index').open = true;
      opening = null;
      destination.click();
    }
    if (!immediate && (moving || rolling || reacting || focusing)) schedule();
    else if (!immediate && now - lastInput < 5200 && !dustTimer) {
      dustTimer = setTimeout(() => {
        dustTimer = 0;
        schedule();
      }, 53);
    }
  }

  function animateSpecimens(dt, immediate, now) {
    const blend = immediate ? 1 : 1 - Math.exp(-dt / 124);
    let animating = Boolean(opening);
    for (const entry of entries.values()) {
      const focused = entry === selected;
      const target = focused ? 1 : 0;
      const previous = entry.activation;
      const difference = target - previous;
      entry.activation = Math.abs(difference) < .003 ? target : previous + difference * blend;
      if (!entry.activation && !previous) continue;

      const drag = pendingClick?.entry === entry ? pendingClick : null;
      let goal = drag?.progress ?? 0;
      if (opening?.entry === entry) {
        const elapsed = immediate ? 1 : clamp((now - opening.start) / 650, 0, 1);
        goal = opening.from + (1 - opening.from) * THREE.MathUtils.smoothstep(elapsed * 1.7, 0, 1);
        if (elapsed === 1) opening.complete = true;
      }
      const gap = goal - entry.gesture;
      entry.gesture = Math.abs(gap) < .004 ? goal : entry.gesture + gap * blend;
      response.power = entry.activation;
      response.progress = entry.gesture;
      response.time = particleTime;
      response.x = focused ? inspection.x : 0;
      response.y = focused ? inspection.y : 0;
      response.side = response.x ? Math.sign(response.x) : (entry.side ?? 1);
      response.lastSide = entry.side ?? 1;
      entry.reaction.update(response);

      // The rigs stay bolted down. Only the objects and their mechanisms respond.
      const lift = entry.id === 'rendering' ? entry.activation * .046 : 0;
      const yaw = entry.activation * response.x * (entry.id === 'optics' ? .28 : .11);
      const pitch = entry.activation * response.y * .08;
      const orient = entry.work.rotation;
      const error = Math.abs(orient.y - yaw) + Math.abs(orient.x - pitch);
      const pivot = immediate || error < .003 ? 1 : Math.min(1, blend * 2.1);
      if (entry.work.position.y !== lift || error > 0) {
        entry.work.position.y = lift;
        orient.set(THREE.MathUtils.lerp(orient.x, pitch, pivot), THREE.MathUtils.lerp(orient.y, yaw, pivot), 0);
        spot.shadow.needsUpdate = true;
      }
      if (entry.activation !== target || Math.abs(gap) > .004 || error > .003) animating = true;
    }
    return animating;
  }

  function placeGrip(element, bounds, worldMatrix) {
    const { min, max } = bounds;
    let left = 1, right = -1, bottom = 1, top = -1;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      witness.set(x, y, z);
      if (worldMatrix) witness.applyMatrix4(worldMatrix);
      witness.project(camera);
      left = Math.min(left, witness.x);
      right = Math.max(right, witness.x);
      bottom = Math.min(bottom, witness.y);
      top = Math.max(top, witness.y);
    }
    element.style.left = `${(left + 1) * 50}%`;
    element.style.top = `${(1 - top) * 50}%`;
    element.style.width = `${(right - left) * 50}%`;
    element.style.height = `${(top - bottom) * 50}%`;
    element.hidden = false;
  }

  function updateGrip() {
    projectorBounds.setFromObject(projector).expandByScalar(.13);
    placeGrip(grip, projectorLocalBounds, projector.matrixWorld);
  }

  function select(entry) {
    if (entry === selected) return;
    selected = entry;
    inspection.set(0, 0);
    if (!entry) {
      reveal.hidden = true;
      return;
    }
    if (performance.now() - chosenAt > 160 && !stillsOnly()) {
      contour.copy(entry.root.position);
      contour.y += .51;
      contour.z += .18;
      bursts.emit('exhibit', contour, particleTime);
      chosenAt = performance.now();
    }
    placeGrip(reveal, entry.bounds);
    const link = links.get(entry.id);
    reveal.href = link.href;
    reveal.firstElementChild.textContent = link.textContent;
    reveal.hidden = false;
  }

  function updateSelection() {
    if (!steered) return;
    let closest = null;
    let best = Math.cos(Math.min(aperture * .83, .127));
    for (const entry of entries.values()) {
      toObject.copy(entry.root.position);
      toObject.y += .46;
      toObject.z += .13;
      toObject.sub(source).normalize();
      const alignment = direction.dot(toObject);
      if (alignment > best) {
        closest = entry;
        best = alignment;
      }
    }
    if (!opening) select(closest);
    if (selected) placeGrip(reveal, selected.bounds);
  }

  function ray(event) {
    const bound = canvas.getBoundingClientRect();
    cursor.set((event.clientX - bound.left) / bound.width * 2 - 1,
      1 - (event.clientY - bound.top) / bound.height * 2);
    raycaster.setFromCamera(cursor, camera);
  }

  function atDepth(z, target) {
    plane.constant = -z;
    return raycaster.ray.intersectPlane(plane, target);
  }

  function overProjector() {
    return raycaster.ray.intersectsBox(projectorBounds);
  }

  function pointAim() {
    let pointed;
    let closest = Infinity;
    for (const entry of entries.values()) {
      if (!raycaster.ray.intersectBox(entry.bounds, witness)) continue;
      const distance = raycaster.ray.origin.distanceToSquared(witness);
      if (distance < closest) {
        pointed = entry;
        closest = distance;
      }
    }
    if (pointed && atDepth(pointed.root.position.z + .13, targetPoint)) {
      // A little assist toward the exhibit, with the actual pointer retaining control.
      contour.copy(pointed.root.position);
      contour.y += .46;
      contour.z += .13;
      targetPoint.lerp(contour, .17);
      return true;
    }
    if (!atDepth(-2.30, targetPoint)) return false;
    targetPoint.x = clamp(targetPoint.x, -6.7, 6.7);
    targetPoint.y = clamp(targetPoint.y, .22, 5.76);
    return true;
  }

  function placeBracket(entry, x, y, z) {
    if (!entry.bracket && z < -2) {
      entry.bracket = new THREE.Group();
      const arm = box(entry.bracket, 0, 0, -.28, .75, .16, 1.77, stock.black);
      arm.castShadow = false;
      box(entry.bracket, 0, -.14, -.98, .87, .41, .23, stock.steel).castShadow = false;
      batch(entry.bracket);
      scene.add(entry.bracket);
    }
    if (entry.bracket) {
      entry.bracket.position.set(x, y - .48, z - (z < -3.3 ? .05 : .14));
      entry.bracket.scale.z = z < -3.3 ? .64 : 1.08;
    }
  }

  function overSelected() {
    return selected && raycaster.ray.intersectsBox(selected.bounds);
  }

  function startOpening(entry, side) {
    if (!entry || opening) return;
    entry.side = side || 1;
    opening = { entry, start: performance.now(), from: Math.min(entry.gesture, .78) };
    wakeRoom();
  }

  function inScene(target) {
    return target === canvas || target === grip || reveal.contains(target);
  }

  room.addEventListener('pointerdown', event => {
    if (!available || event.button !== 0 || !inScene(event.target)) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (grab) {
      if (event.pointerType === 'touch' && !pinch && grab.id !== event.pointerId) {
        pinch = { id: event.pointerId, x: event.clientX, y: event.clientY,
          span: Math.max(20, Math.hypot(event.clientX - grab.lastX, event.clientY - grab.lastY)), aperture: targetAperture };
        canvas.setPointerCapture(event.pointerId);
      }
      return;
    }
    ray(event);
    const onExhibit = reveal.contains(event.target) || overSelected();
    const nearProjector = event.target === grip || overProjector();
    // Projected rectangles can overlap. Only the visible chassis wins the overlap.
    projectorHits.length = 0;
    const onProjector = nearProjector &&
      (!onExhibit || raycaster.intersectObject(projector, true, projectorHits).length > 0);
    if (onProjector) {
      if (!atDepth(position.z, pickLocation)) return;
      opening = null;
      event.preventDefault();
      grab = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        lastX: event.clientX, lastY: event.clientY,
        offsetX: position.x - pickLocation.x, startZ: position.z, aim: liftedAim.clone()
      };
      downstroke = false;
      pendingClick = null;
      canvas.classList.remove('inspecting');
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
      canvas.classList.remove('over-object');
    } else if (onExhibit) {
      if (!selected || opening || pendingClick) return;
      const label = reveal.contains(event.target);
      const box = reveal.getBoundingClientRect();
      const side = event.clientX < box.left + box.width * .5 ? -1 : 1;
      pendingClick = { id: event.pointerId, x: event.clientX, y: event.clientY, entry: selected, label, side };
      canvas.setPointerCapture(event.pointerId);
    }
  });
  room.addEventListener('pointermove', event => {
    if (!available) return;
    if (event.pointerType === 'mouse' && event.buttons === 0 &&
        (grab?.id === event.pointerId || pendingClick?.id === event.pointerId)) {
      finishPointer(event, false);
    }
    ray(event);
    const inspecting = pendingClick?.id === event.pointerId && pendingClick.entry === selected;
    if (inspecting) {
      const dx = event.clientX - pendingClick.x;
      const dy = event.clientY - pendingClick.y;
      if (Math.hypot(dx, dy) < 7 && !pendingClick.moved) return;
      pendingClick.moved = true;
      pendingClick.progress = selected.reaction.gesture(dx, dy);
      if (Math.abs(dx) > 4) pendingClick.side = Math.sign(dx);
      selected.side = pendingClick.side;
      canvas.classList.add('inspecting');
      if (!stillsOnly() && particleTime - lastPuff > .16 &&
          Math.hypot(event.movementX, event.movementY) > 4) {
        burstPoint.copy(selected.root.position);
        burstPoint.y += .59;
        burstPoint.z += .27;
        bursts.emit('wake', burstPoint, particleTime, .58);
        lastPuff = particleTime;
      }
      inspection.set(clamp(dx / 88, -1.4, 1.4), clamp(-dy / 78, -1, 1));
      wakeRoom();
      return;
    }
    if (pinch?.id === event.pointerId) {
      pinch.x = event.clientX;
      pinch.y = event.clientY;
      adjustPinch();
      return;
    }
    if (grab?.id !== event.pointerId) {
      if (event.pointerType === 'mouse' && selected &&
          (reveal.contains(event.target) || (event.target === canvas && overSelected()))) {
        screen.copy(selected.root.position);
        screen.y += .53;
        screen.project(camera);
        hover.set(clamp((cursor.x - screen.x) * 5.5, -1, 1), clamp((screen.y - cursor.y) * 5.5, -1, 1));
        if (hover.distanceToSquared(inspection) > .002) {
          inspection.copy(hover);
          wakeRoom();
        }
      } else if (inspection.lengthSq() > 0) {
        inspection.set(0, 0);
        wakeRoom();
      }
      const picking = overProjector();
      canvas.classList.toggle('over-projector', picking);
      canvas.classList.toggle('over-object', !picking && overSelected());
      return;
    }
    grab.lastX = event.clientX;
    grab.lastY = event.clientY;
    if (pinch) {
      adjustPinch();
      return;
    }
    const dx = event.clientX - grab.x;
    const dy = event.clientY - grab.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 5 && !grab.moved) return;
    grab.moved = true;
    steered = true;

    // The hand carries the chassis across the bench. The same grip turns the lens toward the wall.
    if (atDepth(grab.startZ, pickLocation)) {
      goalPosition.x = clamp(pickLocation.x + grab.offsetX, projectorBase.x - layout.travel, projectorBase.x + layout.travel);
      goalPosition.y = projectorBase.y + clamp(.105 - dy / room.clientHeight * .57, .074, .32);
      goalPosition.z = clamp(grab.startZ + dy / room.clientHeight * .64, projectorBase.z - .60, projectorBase.z + .53);
    }
    if (pointAim()) {
      goalAim.copy(grab.aim).lerp(targetPoint, clamp((distance - 5) / 48, 0, 1));
    }
    wakeRoom();
  });
  function adjustPinch() {
    const span = Math.hypot(pinch.x - grab.lastX, pinch.y - grab.lastY);
    targetAperture = clamp(pinch.aperture * (span / pinch.span) ** .75, .117, .33);
    wakeRoom();
  }

  room.addEventListener('wheel', event => {
    if (!grab) return;
    event.preventDefault();
    const step = event.deltaMode === 0 ? .00033 : .027;
    targetAperture = clamp(targetAperture + clamp(event.deltaY * step, -.045, .045), .117, .33);
    wakeRoom();
  }, { passive: false });

  function finishPointer(event, released) {
    const id = event.pointerId;
    if (pinch?.id === id) {
      pinch = null;
      if (grab) {
        ray({ clientX: grab.lastX, clientY: grab.lastY });
        if (atDepth(position.z, pickLocation)) {
          grab.offsetX = position.x - pickLocation.x;
          grab.startZ = position.z;
        }
        grab.x = grab.lastX;
        grab.y = grab.lastY;
        grab.aim.copy(liftedAim);
      }
    }
    if (grab?.id === id) {
      downstroke = Boolean(grab.moved && !stillsOnly());
      const second = pinch?.id;
      grab = null;
      pinch = null;
      goalPosition.y = projectorBase.y;
      if (second !== undefined && canvas.hasPointerCapture(second)) canvas.releasePointerCapture(second);
      canvas.classList.remove('dragging', 'over-projector');
      wakeRoom();
    }
    if (pendingClick?.id === id) {
      const press = pendingClick;
      pendingClick = null;
      canvas.classList.remove('inspecting');
      inspection.set(0, 0);
      if (released && press.entry === selected) {
        const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y);
        ray(event);
        if (press.progress >= 1 ||
            (!press.moved && moved < 10 && (press.label || overSelected()))) startOpening(press.entry, press.side);
      }
      wakeRoom();
    }
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }

  window.addEventListener('pointerup', event => finishPointer(event, true));
  window.addEventListener('pointercancel', event => finishPointer(event, false));
  canvas.addEventListener('lostpointercapture', event => finishPointer(event, false));
  window.addEventListener('blur', () => {
    for (const id of [grab?.id, pendingClick?.id, pinch?.id]) {
      if (id !== undefined) finishPointer({ pointerId: id }, false);
    }
  });
  canvas.addEventListener('pointerleave', () => canvas.classList.remove('over-projector', 'over-object'));

  reveal.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (event.detail === 0) startOpening(selected, selected?.side);
  });
  new ResizeObserver(resize).observe(room);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
    else quietRoom();
  }).observe(room);
  document.addEventListener('visibilitychange', () => document.hidden ? quietRoom() : schedule());
  reduced.addEventListener('change', () => { quietRoom(); schedule(); });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    available = false;
    quietRoom();
    canvas.classList.remove('dragging', 'over-projector', 'over-object', 'inspecting');
    grab = null;
    pinch = null;
    pendingClick = null;
    opening = null;
    room.classList.remove('ready');
    grip.hidden = true;
    select(null);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    available = true;
    room.classList.add('ready');
    strip.shadow.needsUpdate = true;
    resize();
  });
  room.classList.add('ready');
  resize();
}
