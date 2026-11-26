import * as THREE from 'three';
import { randomSequence } from './atmosphere.mjs';

// One draw call for tabletop dust and grains shaken loose from exhibits.
export function makeRoomParticles(scene) {
  const count = 540;
  const anchors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const timing = new Float32Array(count * 3);
  const style = new Float32Array(count * 2);
  timing.fill(-10);

  const geometry = new THREE.BufferGeometry();
  function attribute(name, data, width) {
    const item = new THREE.BufferAttribute(data, width).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, item);
    return item;
  }
  const anchor = attribute('position', anchors, 3);
  const velocity = attribute('velocity', velocities, 3);
  const clock = attribute('timing', timing, 3);
  const tone = attribute('style', style, 2);
  const uniforms = {
    time: { value: 0 }, scale: { value: 500 },
    origin: { value: new THREE.Vector3() }, heading: { value: new THREE.Vector3() },
    aperture: { value: .20 }
  };

  const points = new THREE.Points(geometry, new THREE.ShaderMaterial({
    uniforms,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 velocity, timing;
      attribute vec2 style;
      uniform float time, scale, aperture;
      uniform vec3 origin, heading;
      varying vec3 color;
      varying float alpha, elongation;
      void main() {
        float age = time - timing.x;
        float life = max(.001, timing.y);
        if (age < 0. || age >= life) {
          gl_Position = vec4(2., 2., 2., 1.);
          gl_PointSize = 0.;
          alpha = 0.;
          return;
        }
        float elapsed = age / life;
        vec3 point = position + velocity * (1. - exp(-1.8 * age)) / 1.8;
        point.y += style.x * (.12 * age - .24 * age * age);
        vec4 eye = modelViewMatrix * vec4(point, 1.);
        gl_Position = projectionMatrix * eye;
        gl_PointSize = clamp(scale * timing.z / max(.55, -eye.z), 1., 22.);
        vec3 offset = point - origin;
        float axial = dot(offset, heading);
        float illumination = smoothstep(.02, .55, axial) *
          (1. - smoothstep(aperture * .68, aperture * 1.18, length(offset - axial * heading) / max(axial, .09)));
        float warm = style.x * smoothstep(1., 6., point.x);
        color = mix(vec3(.57, .72, .93), vec3(.93, .42, .24), warm * (1. - illumination));
        alpha = (1. - elapsed) * smoothstep(-.035, .10, age) * style.y *
          (.29 + illumination * .71) * (.72 + .28 * sin(age * 12. + timing.z * 97.));
        elongation = mix(1., .37, style.x * exp(-age * 3.));
      }`,
    fragmentShader: `
      varying vec3 color;
      varying float alpha, elongation;
      void main() {
        vec2 p = (gl_PointCoord - .5) * 2.;
        p = vec2(p.x * .82 + p.y * .57, p.y * .82 - p.x * .57);
        float d = length(p * vec2(1.18, 1.18 / elongation));
        float core = 1. - smoothstep(.07, .94, d);
        gl_FragColor = vec4(color, core * core * alpha);
      }`
  }));
  points.frustumCulled = false;
  points.visible = false;
  scene.add(points);

  const random = randomSequence(461241);
  let cursor = 0;
  let lastEnd = 0;
  let fraction = 1;

  function emit(kind, at, time, impulse = 0) {
    const impact = kind === 'impact';
    const steering = kind === 'wake';
    const particles = Math.round((impact ? 112 : steering ? 18 : 144) * fraction);
    for (let burst = 0; burst < particles; burst++) {
      const i = cursor * 3;
      const j = cursor * 2;
      const angle = random() * Math.PI * 2;
      const radial = random() ** .8;
      const radius = impact ? .58 * radial : steering ? .25 * radial : .75 * Math.sqrt(radial);
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      anchors[i] = at.x + dx * radius;
      anchors[i + 1] = at.y + (impact ? random() * .035 : (random() - .43) * .77);
      anchors[i + 2] = at.z + dz * radius * (impact ? .45 : .8);
      const speed = (impact ? 1.10 + impulse * .28 : steering ? .48 + impulse * .35 : .26 + impulse * .41) * (.48 + radial * .74);
      velocities[i] = dx * speed;
      velocities[i + 1] = impact ? .18 + random() * .66 : .16 + random() * (steering ? .49 : .83);
      velocities[i + 2] = dz * speed;
      const lifetime = (impact ? .69 : .84) + random() * (impact ? .80 : 1.13);
      timing[i] = time;
      timing[i + 1] = lifetime;
      timing[i + 2] = .009 + random() ** 2.1 * (impact ? .084 : .066);
      style[j] = burst % 9 === 0 ? .9 : .13;
      style[j + 1] = .28 + random() * .72;
      lastEnd = Math.max(lastEnd, time + lifetime);
      cursor = (cursor + 1) % count;
    }
    for (const resource of [anchor, velocity, clock, tone]) resource.needsUpdate = true;
  }

  return {
    emit,
    resize(isPhone, height) {
      fraction = isPhone ? .67 : 1;
      uniforms.scale.value = height;
    },
    update(time, source, direction, aperture, enabled) {
      points.visible = enabled && time < lastEnd;
      if (!points.visible) return;
      uniforms.time.value = time;
      uniforms.origin.value.copy(source);
      uniforms.heading.value.copy(direction);
      uniforms.aperture.value = Math.tan(aperture);
    }
  };
}
