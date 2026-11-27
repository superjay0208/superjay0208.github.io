import * as THREE from 'three';
import { box, material, tube } from './objects.mjs';
import { generateTeachingImage, retainHaarDetails } from '../research/image-lab.mjs';
import { haar2D, inverseHaar2D } from '../research/math.mjs';

const limit = THREE.MathUtils.clamp;

function lightSurface(color) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
}

function litTube(parent, points, color, width = .011) {
  const mesh = tube(parent, points, width, lightSurface(color), 17);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

function plane(parent, width, height, surface, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), surface);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function display(parent, width, height, size, x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const surface = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false });
  const mesh = plane(parent, width, height, surface, x, y, z);
  return {
    mesh, ctx,
    paint(drawing) {
      ctx.clearRect(0, 0, size, size);
      drawing(ctx, size);
      texture.needsUpdate = true;
    }
  };
}

function gradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,.94)');
  gradient.addColorStop(.38, 'rgba(255,255,255,.52)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function prism(entry, local, room) {
  const receivers = new THREE.Group();
  const spectrumEnd = new THREE.Vector3();
  room.add(receivers);
  const baseTexture = gradientTexture();
  const wavelengths = [
    [650, 0xff3728], [609, 0xff7935], [575, 0xffcf57], [541, 0x78e852],
    [506, 0x4de8d2], [475, 0x4e9eff], [445, 0x8265ff]
  ];
  const at = new THREE.Vector3();
  const beamDirection = new THREE.Vector3();
  const end = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const beam = new THREE.CylinderGeometry(.018, .009, 1, 9, 1, true);
  const rays = wavelengths.map(([wave, color]) => {
    const shaft = new THREE.Mesh(beam, lightSurface(color));
    const patchSurface = lightSurface(color);
    patchSurface.map = baseTexture;
    const wall = plane(receivers, .27, .67, patchSurface, 0, 0, -4.497);
    wall.rotation.z = -.19;
    receivers.add(shaft);
    return { shaft, wall, wave };
  });
  return {
    gesture: axis('x', 52),
    spectrumEnd,
    update({ power, x, progress, source }) {
      receivers.visible = power > .007;
      if (!receivers.visible) return;
      entry.work.localToWorld(at.set(.08, .48, -.04));
      beamDirection.subVectors(at, source);
      const azimuth = Math.atan2(beamDirection.x, -beamDirection.z);
      // Cauchy dispersion, around a 55-degree equivalent thin prism.
      const separation = 11.8 + Math.abs(x) * 3.0 + progress * 2.2;
      const distance = at.z + 4.498;
      for (const { shaft, wall, wave } of rays) {
        const index = 1.49 + .0074 / (wave * .001) ** 2;
        const spread = (index - 1.515) * separation;
        end.set(at.x + (azimuth * .35 + .065 + x * .24 + spread) * distance,
          at.y + (.30 + x * .060 + spread * .63) * distance, -4.496);
        wall.position.copy(end);
        if (wave === 541) spectrumEnd.copy(end);
        wall.material.opacity = power * (.69 + progress * .22);
        beamDirection.subVectors(end, at);
        shaft.scale.set(1, beamDirection.length(), 1);
        shaft.position.copy(at).lerp(end, .5);
        shaft.quaternion.setFromUnitVectors(up, beamDirection.normalize());
        shaft.material.opacity = power * (.44 + progress * .19);
      }
    }
  };
}

function hand(entry, local) {
  const holds = [[-.28,.32,.13],[.17,.5,.11],[-.19,.81,.145],[.22,1.09,.125]];
  const trace = litTube(local, holds.map(([x,y])=>[x,y,.123]), 0x5bd8db, .012);
  const rings = holds.map(([x,y,r]) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, .009, 6, 26), lightSurface(0x94ffd5));
    ring.position.set(x, y, .148);
    local.add(ring);
    return ring;
  });
  const pivots = entry.work.userData.fingers;
  return {
    gesture: axis('close', 52),
    update({ power, time, progress, x }) {
      const travel = (time * 2.2 + .35 + x + progress * 2) % 4;
      for (const [i, ring] of rings.entries()) {
        const intensity = limit(1 - Math.abs(i - travel), 0, 1);
        ring.material.opacity = power * (.23 + intensity * .72);
        ring.scale.setScalar(1 + intensity * .19);
      }
      for (const [index, pivot] of pivots.entries()) pivot.rotation.x = -(progress * .96 + power * .24) * (.6 + index * .09);
      trace.material.opacity = power * (.31 + progress * .45);
    }
  };
}

function imagePlates(entry, local) {
  const source = generateTeachingImage('fields', 32);
  const transform = haar2D(source, 32);
  const levels = [.3, .75, 1.6, 4, 10, 28, 100].map(percent => inverseHaar2D(retainHaarDetails(transform, percent)));
  const screen = display(local, .881, .664, 192, -.09, .48, .339);
  screen.mesh.rotation.y = .11;
  const layer = entry.work.userData.researchLayer;
  screen.mesh.material.opacity = 0;
  let lastStep = -1;
  return {
    gesture: axis('x', 47),
    update({ power, progress, x }) {
      const step = Math.min(levels.length - 1, Math.floor((.24 + .76 * progress + x * .12) * levels.length));
      const index = Math.max(0, step);
      screen.mesh.material.opacity = power * .93;
      layer.position.z = .285 + .15 * Math.abs(x) * (1 - progress);
      screen.mesh.position.z = layer.position.z + .055;
      if (index === lastStep || !power) return;
      lastStep = index;
      screen.paint((ctx, size) => {
        ctx.fillStyle = '#152323';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < levels[index].length; i++) {
          const t = limit(levels[index][i], 0, 1);
          ctx.fillStyle = `rgb(${27 + t * 154},${46 + t * 178},${45 + t * 165})`;
          ctx.fillRect(16 + 5 * (i % 32), 16 + 5 * Math.floor(i / 32), 5, 5);
        }
        ctx.strokeStyle = '#91cbc1';
        ctx.strokeRect(7, 7, size - 14, size - 14);
      });
    }
  };
}

function climbing(entry, local) {
  const knots = [[-.34,.09,.29],[-.12,.30,.34],[.25,.49,.33],[-.05,.72,.23],[.22,.92,.27],[-.21,1.08,.35]];
  const route = litTube(local, knots, 0xefb160, .012);
  const line = new THREE.CatmullRomCurve3(knots.map(point => new THREE.Vector3(...point)));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(.033, 12, 7), lightSurface(0xfff4b2));
  local.add(bead);
  const pin = new THREE.Mesh(new THREE.TorusGeometry(.093, .012, 7, 18), lightSurface(0xffb965));
  pin.position.set(-.21, 1.08, .36);
  local.add(pin);
  return {
    gesture: axis('up', 55),
    update({ power, time, y, progress }) {
      const travel = limit(.10 + progress * .88 + Math.max(0, y) * .11 + .045 * Math.sin(time * 4), .02, .99);
      line.getPointAt(travel, bead.position);
      pin.material.opacity = power * (.16 + progress * .78);
      route.material.opacity = power * .63;
      bead.material.opacity = power * 1.0;
    }
  };
}

function verdict(entry, local) {
  const assembly = entry.work.userData.scaleBeam;
  const markers = [-.37,.37].map((x,index) =>
    plane(local, .12, .035, lightSurface(index ? 0xcd512b : 0x7feac0), x, .075, .291));
  const needle = box(local, 0, .49, .183, .008, .19, .006, lightSurface(0xf2d19a), false);
  // The dial pivots around its own hub.
  const pivot = new THREE.Group();
  pivot.position.set(0, .49, .18);
  local.add(pivot);
  pivot.add(needle);
  needle.position.set(0, .04, .007);
  return {
    gesture: axis('x', 43),
    update({ power, x, side, progress, lastSide }) {
      const bias = x || lastSide * progress * .82;
      const angle = power * limit(bias, -.85, .85) * -.48;
      assembly.rotation.z = angle;
      pivot.rotation.z = angle * 2.65;
      needle.material.opacity = power * (.54 + progress * .38);
      markers[0].material.opacity = power * (side < 0 ? .92 : .16);
      markers[1].material.opacity = power * (side > 0 ? .92 : .16);
    }
  };
}

function shaders(entry, local) {
  const surfaces = entry.work.userData.renderSurfaces;
  const patterns = [
    `float band = floor(clamp(normal.y * .48 + .5, 0., .999) * 5.) / 4.;
     totalEmissiveRadiance *= mix(vec3(.02, .34, .83), vec3(1.58, .35, .13), band) * (.19 + band);`,
    `vec2 dotCell = fract(vViewPosition.xy * 23.) - .5;
     float dots = 1. - smoothstep(.15, .29, length(dotCell));
     totalEmissiveRadiance *= .23 + dots * 1.22;`,
    `float edge = 1. - abs(dot(normal, normalize(vViewPosition)));
     float band = sin(normal.y * 31.);
     totalEmissiveRadiance *= .29 + step(.61, band) * .67 + smoothstep(.63,.91,edge) * .94;`
  ];
  for (const [index, surface] of surfaces.entries()) {
    surface.customProgramCacheKey = () => `portfolio-exhibit-style-${index}`;
    surface.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n' + patterns[index]);
    };
  }
  const scanned = [-.37,0,.37].map((x,index) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.16, .008, 7, 32),
      lightSurface([0x51baed, 0xfdbb65, 0xf47a58][index]));
    ring.position.set(x, .38 + (index === 1 ? .24 : 0), 0);
    ring.rotation.x = -Math.PI / 2;
    local.add(ring);
    return ring;
  });
  return {
    gesture: axis('x', 57),
    update({ power, x, time, progress }) {
      const phase = limit(.45 + x * .35 + progress * .46, .05, .98);
      for (const [index, ring] of scanned.entries()) {
        const strength = 1 - Math.abs(index / 2 - phase) * .7;
        ring.material.opacity = power * strength;
        ring.position.y = .17 + (index === 1 ? .24 : 0) + phase * .41 + .035 * Math.sin(index + time * 3);
        const surface = surfaces[index];
        surface.emissiveIntensity = power * strength * .66;
        surface.roughness = .64 - progress * .23;
      }
    }
  };
}

function camera(entry, local, room) {
  const iris = [];
  const focus = new THREE.Group();
  focus.position.set(-.12, .42, .630);
  local.add(focus);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(.170, .012, 8, 42), lightSurface(0x97dcff));
  focus.add(rim);
  const surface = material(0x656560, .42, .64);
  for (let blade = 0; blade < 6; blade++) {
    const angle = blade / 6 * Math.PI * 2;
    const panel = box(focus, Math.cos(angle) * .105, Math.sin(angle) * .105, .009, .068, .12, .004, surface, false);
    panel.rotation.z = angle;
    iris.push({ panel, angle });
  }
  const image = display(room, 1.2, .85, 224, 0, 0, -4.491);
  image.mesh.material.blending = THREE.AdditiveBlending;
  const point = new THREE.Vector3();
  let sharpness = -1;
  return {
    gesture: axis('y', 52),
    update({ power, progress, y }) {
      const focusAmount = limit(.30 + progress * .65 + y * .19, .1, 1);
      rim.material.opacity = power * (.61 + focusAmount * .31);
      for (const { panel, angle } of iris) {
        const radius = .103 + focusAmount * .02;
        panel.position.x = Math.cos(angle) * radius;
        panel.position.y = Math.sin(angle) * radius;
        panel.rotation.z = angle + .28 + focusAmount * .41;
        panel.visible = power > .1;
      }
      entry.work.getWorldPosition(point);
      image.mesh.position.x = point.x + .59;
      image.mesh.position.y = point.y + 1.13;
      image.mesh.material.opacity = power * (.28 + progress * .48);
      const level = Math.round(focusAmount * 13);
      if (level === sharpness || power < .01) return;
      sharpness = level;
      image.paint((ctx, size) => {
        const channels = ['#507690', '#778e76', '#ba7e70'];
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          const offset = (1 - level / 13) * (i - 1) * 25;
          ctx.save();
          ctx.translate(offset, 0);
          ctx.strokeStyle = channels[i];
          ctx.lineWidth = 2;
          ctx.strokeRect(16, 28, size - 32, size - 56);
          ctx.strokeRect(61, 72, size - 122, size - 144);
          for (const [x,y] of [[16,28],[208,28],[16,196],[208,196]]) {
            ctx.beginPath();
            ctx.moveTo(x,y);
            ctx.lineTo(size*.5,size*.5);
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
      });
    }
  };
}

function axis(kind, distance) {
  return function gesture(dx, dy) {
    const value = kind === 'x' ? Math.abs(dx)
      : kind === 'y' ? Math.abs(dy)
        : kind === 'up' ? Math.max(0, -dy)
          : Math.hypot(dx, dy);
    return limit(value / distance, 0, 1);
  };
}

const builders = { optics: prism, motion: hand, research: imagePlates, crux: climbing,
  counts: verdict, rendering: shaders, vision: camera };

export function makeExhibitReaction(entry, room) {
  const effects = new THREE.Group();
  entry.work.add(effects);
  return builders[entry.id](entry, effects, room);
}
