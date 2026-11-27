import * as THREE from 'three';
import { generateTeachingImage, retainHaarDetails } from '../research/image-lab.mjs';
import { haar2D, inverseHaar2D } from '../research/math.mjs';

const config = {
  optics:    { duration: 980, anchor: [.09, .43, .08], arc: [-.19, .09, .12] },
  motion:    { duration: 920, anchor: [.26, .73, .33], arc: [.23, .28, -.12] },
  research:  { duration: 1070, anchor: [-.10, .48, .35], arc: [-.13, .04, .035] },
  crux:      { duration: 1030, anchor: [-.21, 1.04, .32], arc: [-.24, -.53, .15] },
  counts:    { duration: 920, anchor: [.02, .50, .19], arc: [.40, -.11, -.23] },
  rendering: { duration: 1020, anchor: [.02, .51, .15], arc: [.37, .19, -.11] },
  vision:    { duration: 900, anchor: [-.12, .43, .61], arc: [0, .015, 0] }
};
const DARK = '#08090b';
const smooth = THREE.MathUtils.smoothstep;
const mix = THREE.MathUtils.lerp;
const TAU = Math.PI * 2;

function polygon(ctx, points, fill) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function ring(ctx, x, y, radius, tone, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, TAU);
  ctx.lineWidth = width;
  ctx.strokeStyle = tone;
  ctx.stroke();
}

function prism(ctx, p, span) {
  const colors = ['#eb482a','#ee8f38','#f1c65d','#95d779','#65cfbe','#579ada','#886ec4'];
  const split = smooth(p, .16, .78);
  const length = span * (.35 + split * 1.34);
  ctx.rotate(-.48 - split * .37);
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < colors.length; i++) {
    const offset = (i - 3) * (.027 + split * .075);
    ctx.save();
    ctx.rotate(offset);
    const shaft = ctx.createLinearGradient(-length * .04, 0, length, 0);
    shaft.addColorStop(0, colors[i]);
    shaft.addColorStop(.73, colors[i] + '88');
    shaft.addColorStop(1, colors[i] + '00');
    polygon(ctx, [[-length * .05,0],[length,-length * .04],[length,length * .04]], shaft);
    ctx.restore();
  }
}

function motion(ctx, p, span) {
  const stretch = span * (.08 + .42 * smooth(p, .15, .91));
  const points = [[-.61,.63],[-.33,.13],[.18,-.24],[.63,-.67]];
  ctx.strokeStyle = '#62d5c5';
  ctx.lineWidth = Math.max(1, span * .0016);
  ctx.setLineDash([span * .009, span * .007]);
  ctx.beginPath();
  points.forEach(([x,y], i) => i ? ctx.lineTo(x * stretch, y * stretch) : ctx.moveTo(x * stretch, y * stretch));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [i,[x,y]] of points.entries()) {
    const part = smooth(p, .26 + i * .075, .51 + i * .075);
    if (!part) continue;
    ctx.globalAlpha *= .85;
    ring(ctx,x * stretch,y * stretch,stretch * (.13 + part * .08), '#a2ffd8', span * .0018);
    ring(ctx,x * stretch,y * stretch,stretch * .04, '#c8fbe9', 1);
  }
  ctx.globalAlpha = smooth(p, .44, .85) * .89;
  const spread = span * mix(.63,.115,smooth(p,.47,.96));
  for (const sign of [-1,1]) {
    polygon(ctx, [[sign * span,span], [sign * span,-span],
      [sign * spread,-span], [sign * spread * .71,-stretch * .22],
      [sign * spread * .98,stretch * .43], [sign * spread * .54,span]], '#101a1d');
  }
}

let field;
function research(ctx, p, span) {
  if (!field) {
    const original = generateTeachingImage('fields', 16);
    const transform = haar2D(original, 16);
    field = [1, 4, 12, 36, 100].map(k => inverseHaar2D(retainHaarDetails(transform, k)));
  }
  const defined = smooth(p, .13, .82);
  const stage = defined * (field.length - 1);
  const low = Math.floor(stage), high = Math.ceil(stage);
  const size = span * (.10 + defined * 1.64);
  const cell = size / 16;
  ctx.rotate(-.10 * (1 - defined));
  for (let i = 0; i < 256; i++) {
    const amplitude = THREE.MathUtils.clamp(mix(field[low][i], field[high][i], stage - low), 0, 1);
    ctx.fillStyle = `rgb(${22 + amplitude * 103},${31 + amplitude * 139},${29 + amplitude * 126})`;
    const gap = cell * .18 * (1 - defined);
    const offset = gap * Math.sin(i * 11);
    ctx.fillRect((i % 16 - 8) * cell + offset, (Math.floor(i / 16) - 8) * cell, cell - gap + .2, cell - gap + .2);
  }
  ctx.strokeStyle = '#9bb7a3';
  ctx.lineWidth = 1.4;
  ctx.strokeRect(-size * .5, -size * .5, size, size);
}

function crux(ctx, p, span) {
  const ascent = smooth(p, .12, .91);
  const size = span * (.14 + ascent * .48);
  const knots = [[-.63,1.12],[-.29,.86],[.23,.51],[-.25,.18],[.2,-.15],[-.33,-.75]];
  ctx.strokeStyle = '#d7a467';
  ctx.lineWidth = Math.max(2, span * .003);
  ctx.beginPath();
  knots.forEach(([x,y], i) => i ? ctx.lineTo(x * size, (y + ascent * 1.15) * size) : ctx.moveTo(x * size, (y + ascent * 1.15) * size));
  ctx.stroke();
  for (const [i,[x,y]] of knots.entries()) {
    ctx.save();
    ctx.translate(x * size, (y + ascent * 1.15) * size);
    ctx.rotate(-i * .61);
    polygon(ctx, [[-.12,-.03],[-.05,-.12],[.08,-.085],[.13,.018],[.029,.11],[-.07,.082]]
      .map(([x,y])=>[x * size,y * size]), i % 2 ? '#918577' : '#c5b7a7');
    ring(ctx, 0, 0, size * .024, '#3c3731', 1.3);
    ctx.restore();
  }
  ctx.fillStyle = '#c5bcad';
  for (let i = 0; i < 50; i++) {
    const offset = Math.sin(i * 1753) * .75;
    const distance = ((i * .157 + ascent * 1.9) % 1) * 1.8;
    ctx.fillRect(size * (offset + .19 * p), size * (distance - .7), 1 + i % 3, 1 + i % 2);
  }
}

function verdict(ctx, p, span, side) {
  const tip = smooth(p, .23, .85);
  ctx.rotate(side * (-.15 - tip * .73));
  const reach = span * (.22 + tip * .95);
  polygon(ctx, [[-reach,-span],[reach,-span],[reach,3],[-reach,0]], '#151618');
  polygon(ctx, [[-reach,0],[reach,3],[reach,span],[-reach,span]], side < 0 ? '#342721' : '#24312b');
  ctx.fillStyle = side < 0 ? '#be8867' : '#a8b7a3';
  ctx.fillRect(-reach, -2.5, reach * 2, 3.5 + tip * 7);
  for (let i = -12; i <= 12; i++) {
    const x = reach * i / 12;
    ctx.fillRect(x, -9, 1.5, i % 3 ? 12 : 20);
  }
}

function rendering(ctx, p, span) {
  const scan = smooth(p,.13,.95);
  const size = span * (.16 + .81 * scan);
  const rows = ['#284d66','#587282','#b37e4d','#ce753c','#c5ad84','#70685a'];
  for (const [i, tone] of rows.entries()) {
    ctx.fillStyle = tone;
    ctx.fillRect(-size, (i - 3) * size / 3, size * 2, size / 3 + 1);
  }
  const step = Math.max(10,span * .026);
  ctx.fillStyle = '#171719';
  ctx.beginPath();
  for (let y = -size; y < size; y += step) {
    for (let x = -size; x < size; x += step) {
      const radius = step * (.12 + .16 * (.5 + Math.sin(x * .016 + y * .024) * .5));
      ctx.moveTo(x + radius,y);
      ctx.arc(x,y,radius,0,TAU);
    }
  }
  ctx.fill();
  ctx.fillStyle = '#c5e0de';
  ctx.fillRect(-size, size * (scan * 2 - 1), size * 2, Math.max(1.5, span * .003));
}

function iris(ctx, p, span) {
  const open = span * mix(.55, .012, smooth(p,.26,.95));
  ctx.rotate(.17 + p * .40);
  for (let i = 0; i < 6; i++) {
    const a = TAU * i / 6;
    ctx.save();
    ctx.rotate(a);
    polygon(ctx, [[open,0],[open * .48,open * -.88],
      [span * 1.41,-span * 1.10],[span * 1.79,span * .72],[open * .51,open * .86]],
    i % 2 ? '#20282a' : '#141a1e');
    ctx.restore();
  }
  ring(ctx, 0, 0, open, '#668a90', 2);
  ring(ctx, 0, 0, open * 1.15, '#b4c8c8', 1);
}

const effects = { optics: prism, motion, research, crux, counts: verdict, rendering, vision: iris };

export function makeProjectPassage(room, camera) {
  const element = document.createElement('canvas');
  element.className = 'archive-passage';
  element.setAttribute('aria-hidden','true');
  element.hidden = true;
  document.body.append(element);
  const ctx = element.getContext('2d');
  const point = new THREE.Vector3();
  const look = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const projected = new THREE.Vector3();
  let viewportWidth = 0, viewportHeight = 0;
  let arrival;
  let effectFrame = 0;

  function size() {
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    if (width === viewportWidth && height === viewportHeight) return;
    viewportWidth = width;
    viewportHeight = height;
    const pixelRatio = Math.min(devicePixelRatio, 1.35, Math.sqrt(1600000 / (width * height)));
    element.width = Math.round(width * pixelRatio);
    element.height = Math.round(height * pixelRatio);
  }

  function restore() {
    cancelAnimationFrame(effectFrame);
    effectFrame = 0;
    arrival?.cancel();
    arrival = null;
    element.hidden = true;
    room.classList.remove('entering');
  }

  return {
    begin(entry, start) {
      const treatment = config[entry.id];
      entry.work.localToWorld(point.set(...treatment.anchor));
      const [x,y] = treatment.arc;
      const from = camera.position.clone();
      const end = point.clone().add(new THREE.Vector3(x, y + .12, 1.06));
      const initialLook = camera.getWorldDirection(new THREE.Vector3())
        .multiplyScalar(from.distanceTo(point)).add(from);
      const control = from.clone().lerp(end, .52);
      control.x += x * 2.9;
      control.y += y * 1.75;
      return { treatment, entry, lastFrame: start, elapsed: 0, from, end, control, point: point.clone(), initialLook, fov: camera.fov };
    },
    position(passage, now) {
      passage.elapsed += THREE.MathUtils.clamp(now - passage.lastFrame, 0, 85);
      passage.lastFrame = now;
      const p = Math.min(1, passage.elapsed / passage.treatment.duration);
      const travel = smooth(p, .06, .96);
      const inverse = 1 - travel;
      eye.copy(passage.from).multiplyScalar(inverse * inverse)
        .addScaledVector(passage.control, 2 * inverse * travel)
        .addScaledVector(passage.end, travel * travel);
      look.copy(passage.initialLook).lerp(passage.point, smooth(p, .02, .65));
      camera.position.copy(eye);
      camera.lookAt(look);
      camera.rotateZ(passage.treatment.arc[2] * Math.sin(travel * Math.PI * .86) * (passage.entry.side ?? 1));
      camera.fov = passage.fov - 6 * smooth(p, .13, .70);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      return p;
    },
    paint(passage, p) {
      if (!ctx) return;
      size();
      const width = viewportWidth, height = viewportHeight;
      const bounds = room.getBoundingClientRect();
      projected.copy(passage.point).project(camera);
      const inView = Number.isFinite(projected.x) && Number.isFinite(projected.y);
      const x = inView ? bounds.left + (projected.x + 1) * bounds.width * .5 : width * .5;
      const y = inView ? bounds.top + (1 - projected.y) * bounds.height * .5 : height * .5;
      const span = Math.hypot(width,height);
      element.hidden = false;
      ctx.setTransform(element.width / width,0,0,element.height / height,0,0);
      ctx.clearRect(0,0,width,height);

      const edge = ctx.createRadialGradient(x,y,span * .06,x,y,span * .59);
      edge.addColorStop(0,'rgba(8,9,11,0)');
      edge.addColorStop(1,`rgba(8,9,11,${smooth(p,.06,.72) * .92})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0,0,width,height);

      ctx.save();
      ctx.translate(x,y);
      ctx.globalAlpha = smooth(p, .24, .64) * (1 - .31 * smooth(p, .79, 1));
      effects[passage.entry.id](ctx,p,span,passage.entry.side ?? 1);
      ctx.restore();
      ctx.globalAlpha = smooth(p,.78,.985);
      ctx.fillStyle = DARK;
      ctx.fillRect(0,0,width,height);
      ctx.globalAlpha = 1;
    },
    cover() {
      room.classList.add('entering');
    },
    unveil() {
      if (element.hidden) {
        restore();
        return;
      }
      effectFrame = requestAnimationFrame(() => {
        effectFrame = 0;
        arrival = element.animate([{opacity:1},{opacity:0}], {duration:370,easing:'cubic-bezier(.16,1,.3,1)'});
        arrival.onfinish = restore;
      });
    },
    restore
  };
}
