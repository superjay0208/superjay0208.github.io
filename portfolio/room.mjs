import * as THREE from 'three';
import { createProjectorModel } from './projector.ts';
import { batch, box, makeExhibit, makeTitle, material, stock, tube } from './objects.mjs';

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

function concrete() {
  const canvas = document.createElement('canvas');
  const n = canvas.height = canvas.width = 256;
  const context = canvas.getContext('2d');
  const pattern = context.createImageData(n, n);
  let seed = 1842512;
  function noise() {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const index = (x + y * n) * 4;
    const pore = noise();
    const grain = (pore - .51) * 46 - (pore < .019 ? 41 : 0);
    const board = Math.cos(y * .076) * 11 + Math.cos(x * .05 + .015 * y) * 7;
    const water = Math.sin(x * .022 + 6) * Math.sin(y * .011 + x * .019) * 23;
    const value = 164 + grain + board + water;
    pattern.data.set([value, value - 2, value - 6, 255], index);
  }
  context.putImageData(pattern, 0, 0);
  context.fillStyle = '#373937';
  for (const x of [13, n - 13]) for (const y of [19, n - 19]) {
    context.beginPath();
    context.arc(x, y, 3.7, 0, Math.PI * 2);
    context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function structure() {
  const room = new THREE.Group();
  const dark = material(0x232528);
  const concreteMap = concrete();
  const walls = material(0xa3a29c, .93, 0, { map: concreteMap, bumpMap: concreteMap, bumpScale: .035 });
  const floor = material(0x78726d, .83, .04, { map: concreteMap });
  const casing = material(0x373837, .76, .29);
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
  batch(room);
  return room;
}

function makeBench(layout) {
  const [x, y, z, width, depth] = layout.bench;
  const bench = new THREE.Group();
  const laminate = material(0x544942, .82, .1);
  box(bench, x, y + .042, z, width, .105, depth, laminate);
  box(bench, x, y - .03, z, width - .03, .062, depth - .038, stock.steel);
  for (const side of [-1, 1]) for (const end of [-1, 1]) {
    box(bench, x + side * (width / 2 - .22), y / 2, z + end * (depth / 2 - .19), .104, y, .11, stock.black);
  }
  for (const end of [-1, 1]) box(bench, x, .245, z + end * (depth / 2 - .19), width - .30, .055, .06, stock.black);
  batch(bench);
  return bench;
}

function beamVolume() {
  const surface = new THREE.ShaderMaterial({
    uniforms: {
      origin: { value: new THREE.Vector3() },
      direction: { value: new THREE.Vector3() },
      throwLength: { value: 0 },
      angleSquared: { value: 0 }
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
      uniform float angleSquared;
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
          scatter += feather * grain / (1. + axial * axial * .057);
        }
        float density = min(.125, scatter * chord * .033);
        gl_FragColor = vec4(.78, .72, .59, density);
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
  renderer.toneMappingExposure = 1.16;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131514);
  scene.fog = new THREE.FogExp2(0x211f1d, .053);
  const camera = new THREE.PerspectiveCamera(42, 1, .14, 34);
  scene.add(structure());
  const title = makeTitle();
  scene.add(title);

  scene.add(new THREE.HemisphereLight(0xb8c0c4, 0x594437, 1.02));
  const strip = new THREE.DirectionalLight(0xc7d7df, 1.18);
  strip.position.set(-3.9, 6.1, 5);
  scene.add(strip);
  const kick = new THREE.PointLight(0xff3821, 47, 11, 2);
  kick.position.set(5.15, 3.65, -3.30);
  scene.add(kick);
  const frontBounce = new THREE.PointLight(0xdab99b, 23, 9, 2);
  frontBounce.position.set(-3.15, 3.65, 7.2);
  scene.add(frontBounce);

  const projector = createProjectorModel();
  batch(projector);
  scene.add(projector);
  const beam = beamVolume();
  scene.add(beam);
  const spot = new THREE.SpotLight(0xffe9c9, 460, 24, .19, .54, 2);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.camera.near = .16;
  spot.shadow.bias = -.00027;
  spot.shadow.normalBias = .017;
  spot.shadow.radius = 3.2;
  scene.add(spot, spot.target);

  const entries = new Map([...links.keys()].map(id => {
    const entry = makeExhibit(id);
    entry.bounds = new THREE.Box3();
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let previousPreference;
  try { previousPreference = localStorage.getItem('zw-motion'); } catch { /* Settings storage is optional. */ }

  let layout, bench, grab, pendingClick, selected, frame = 0, lastTime = 0;
  let visible = true;
  let steered = false;
  let available = true;

  function schedule() {
    if (!frame && visible && !document.hidden && available) frame = requestAnimationFrame(draw);
  }

  function resize() {
    const width = room.clientWidth;
    const height = room.clientHeight;
    if (!width || !height) return;
    const next = width / height < .92 ? SETUPS.tall : SETUPS.wide;
    camera.aspect = width / height;
    camera.position.set(...next.eye);
    camera.lookAt(...next.look);
    camera.fov = next.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    const pixelBudget = next === SETUPS.tall ? 400000 : 780000;
    renderer.setPixelRatio(Math.min(devicePixelRatio, Math.sqrt(pixelBudget / (width * height))));
    renderer.setSize(width, height, false);
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
        entry.root.scale.setScalar(next === SETUPS.tall ? .85 : 1);
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
      select(null);
      layout = next;
      refreshLight();
    }
    schedule();
  }

  function refreshLight() {
    projector.position.copy(position);
    matrix.lookAt(position, liftedAim, UP);
    projector.quaternion.setFromRotationMatrix(matrix);
    projector.updateMatrixWorld(true);
    source.copy(LENS).applyMatrix4(projector.matrixWorld);
    direction.subVectors(liftedAim, source).normalize();
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
  }

  function draw(now) {
    frame = 0;
    if (!layout || !visible || document.hidden || !available) return;
    const dt = lastTime ? Math.min(45, now - lastTime) : 16;
    const immediate = reduced.matches || previousPreference === 'off';
    const moving = position.distanceToSquared(goalPosition) + liftedAim.distanceToSquared(goalAim) > .00004;
    if (moving && !immediate) {
      const fraction = 1 - Math.exp(-dt / 47);
      position.lerp(goalPosition, fraction);
      liftedAim.lerp(goalAim, fraction);
      lastTime = now;
    } else {
      position.copy(goalPosition);
      liftedAim.copy(goalAim);
      lastTime = 0;
    }
    refreshLight();
    renderer.render(scene, camera);
    updateGrip();
    updateSelection();
    if (moving && !immediate) schedule();
  }

  function updateGrip() {
    projectorBounds.setFromObject(projector).expandByScalar(.13);
    const { min, max } = projectorBounds;
    let left = 1, right = -1, bottom = 1, top = -1;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      witness.set(x, y, z).project(camera);
      left = Math.min(left, witness.x);
      right = Math.max(right, witness.x);
      bottom = Math.min(bottom, witness.y);
      top = Math.max(top, witness.y);
    }
    grip.style.left = `${(left + 1) * 50}%`;
    grip.style.top = `${(1 - top) * 50}%`;
    grip.style.width = `${(right - left) * 50}%`;
    grip.style.height = `${(top - bottom) * 50}%`;
    grip.hidden = false;
  }

  function select(entry) {
    if (entry === selected) return;
    selected = entry;
    if (!entry) {
      reveal.hidden = true;
      return;
    }
    const link = links.get(entry.id);
    reveal.href = link.href;
    reveal.firstElementChild.textContent = link.textContent;
    reveal.hidden = false;
  }

  function updateSelection() {
    if (!steered) return;
    let closest = null;
    let best = .992;
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
    select(closest);
    if (closest) {
      screen.copy(closest.root.position);
      screen.y += layout === SETUPS.tall ? 1.11 : 1.25;
      screen.z += .35;
      screen.project(camera);
      reveal.style.setProperty('--x', `${clamp((screen.x + 1) * 50, 18, 82)}%`);
      reveal.style.setProperty('--y', `${clamp((1 - screen.y) * 50, 18, 83)}%`);
    }
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
    if (pointed) {
      targetPoint.copy(pointed.root.position);
      targetPoint.y += .46;
      targetPoint.z += .13;
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

  room.addEventListener('pointerdown', event => {
    if (!available || grab || event.button !== 0 || ![canvas, grip].includes(event.target)) return;
    ray(event);
    if (event.target === grip || overProjector()) {
      if (!atDepth(position.z, pickLocation)) return;
      grab = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        offsetX: position.x - pickLocation.x, startZ: position.z, aim: liftedAim.clone()
      };
      pendingClick = null;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('dragging');
      canvas.classList.remove('over-object');
    } else if (overSelected()) {
      pendingClick = { id: event.pointerId, x: event.clientX, y: event.clientY, entry: selected };
    }
  });
  room.addEventListener('pointermove', event => {
    if (!available) return;
    ray(event);
    if (grab?.id !== event.pointerId) {
      const picking = overProjector();
      canvas.classList.toggle('over-projector', picking);
      canvas.classList.toggle('over-object', !picking && overSelected());
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
    schedule();
  });
  function release(event) {
    if (grab?.id === event.pointerId) {
      grab = null;
      goalPosition.y = projectorBase.y;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      canvas.classList.remove('dragging', 'over-projector');
      schedule();
    }
    if (pendingClick?.id === event.pointerId) {
      const click = pendingClick;
      pendingClick = null;
      ray(event);
      if (event.type === 'pointerup' && click.entry === selected &&
          Math.hypot(event.clientX - click.x, event.clientY - click.y) < 10 && overSelected()) reveal.click();
    }
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, release);
  canvas.addEventListener('pointerleave', () => canvas.classList.remove('over-projector', 'over-object'));

  reveal.addEventListener('click', () => {
    if (selected?.id === 'vision') document.getElementById('project-index').open = true;
  });
  new ResizeObserver(resize).observe(room);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) schedule();
  }).observe(room);
  document.addEventListener('visibilitychange', schedule);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    available = false;
    canvas.classList.remove('dragging', 'over-projector', 'over-object');
    grab = null;
    pendingClick = null;
    room.classList.remove('ready');
    grip.hidden = true;
    select(null);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    available = true;
    room.classList.add('ready');
    resize();
  });
  room.classList.add('ready');
  resize();
}
