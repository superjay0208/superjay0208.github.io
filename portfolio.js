(() => {
  'use strict';

  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const glassCanvas = document.getElementById('glass-canvas');
  const dustCanvas = document.getElementById('dust-canvas');
  const video = document.getElementById('projector-video');
  const motionButton = document.getElementById('motion-toggle');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = null;
  try { preference = localStorage.getItem('zw-motion'); } catch { /* Storage can be unavailable in private browsing. */ }
  let motion = preference ? preference === 'on' : !systemMotion.matches;
  let heroVisible = true;
  let videoVisible = false;
  let frameId = 0;
  let elapsed = 0;
  let lastTime = 0;
  let lastDraw = 0;
  let width = 1;
  let height = 1;
  let heroProgress = 0;
  const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };

  document.getElementById('year').textContent = new Date().getFullYear();

  // A real, ray-marched glass object. No downloaded 3D engine or model is needed.
  const vertexSource = `
    attribute vec2 a_position;
    void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_scroll;
    uniform float u_mobile;
    mat2 turn(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
    vec3 localPoint(vec3 p) {
      p.xy = turn(-0.36 + sin(u_time * 0.17) * 0.08 + u_pointer.x * 0.08) * p.xy;
      p.xz = turn(0.33 + sin(u_time * 0.21) * 0.21 + u_scroll * 0.7 + u_pointer.x * 0.13) * p.xz;
      p.yz = turn(0.34 + cos(u_time * 0.16) * 0.13 + u_pointer.y * 0.10) * p.yz;
      return p;
    }
    float shape(vec3 p) {
      p = localPoint(p);
      p.x /= 1.16;
      vec2 ring = vec2(length(p.xy) - 1.03, p.z);
      return length(ring) - 0.285;
    }
    vec3 normalAt(vec3 p) {
      vec2 e = vec2(0.0012, 0.0);
      return normalize(vec3(shape(p+e.xyy)-shape(p-e.xyy),shape(p+e.yxy)-shape(p-e.yxy),shape(p+e.yyx)-shape(p-e.yyx)));
    }
    vec3 studio(vec3 d) {
      vec3 color = mix(vec3(0.11,0.13,0.12),vec3(0.39,0.30,0.22),smoothstep(-0.9,0.7,d.y));
      float key = pow(max(0.0, dot(d,normalize(vec3(-0.7,1.0,1.2)))), 10.0);
      float strip = pow(max(0.0,1.0-abs(d.x*0.55+d.y*0.8-0.3)),32.0) * smoothstep(-0.4,0.4,d.z);
      float rim = pow(max(0.0,dot(d,normalize(vec3(0.9,-0.5,0.4)))),16.0);
      color += vec3(1.5,1.24,0.94)*key + vec3(1.1,1.05,0.89)*strip + vec3(0.53,0.23,0.10)*rim;
      float cool = pow(max(0.0,dot(d,normalize(vec3(-1.0,-0.3,-0.2)))),9.0);
      return color + vec3(0.15,0.32,0.37)*cool;
    }
    void main() {
      vec2 uv = (2.0*gl_FragCoord.xy-u_resolution)/min(u_resolution.x,u_resolution.y);
      if (u_mobile > 0.5) { uv -= vec2(0.0,-0.75); uv *= 1.7; }
      else { uv -= vec2(u_resolution.x/u_resolution.y * 0.40,-0.015); uv *= 1.1; }
      uv.y += sin(u_time*0.37)*0.035;
      vec3 ro = vec3(0.0,0.0,4.5);
      vec3 rd = normalize(vec3(uv,-3.4));
      float distance = 0.0;
      float nearEdge = 1.0;
      bool hit = false;
      for (int i = 0; i < 76; i++) {
        float stepSize = shape(ro + rd * distance);
        nearEdge = min(nearEdge,stepSize);
        if (stepSize < 0.0016) { hit = true; break; }
        distance += stepSize * 0.83;
        if (distance > 8.0) break;
      }
      if (!hit) { gl_FragColor = vec4(0.0); return; }
      vec3 p = ro+rd*distance;
      vec3 n = normalAt(p);
      float facing = max(0.0,dot(-rd,n));
      float fresnel = 0.12+0.88*pow(1.0-facing,3.0);
      vec3 reflected = studio(reflect(rd,n));
      vec3 refracted = refract(rd,n,0.68);
      vec3 transmission = studio(refracted) * vec3(0.49,0.43,0.34);
      vec3 material = mix(transmission,reflected,fresnel*0.72+0.20);
      vec3 lp = localPoint(p);
      float interference = 0.5+0.5*cos(17.0*facing+lp.x*2.7+lp.y*1.8);
      vec3 spectral = mix(vec3(0.20,0.36,0.37),vec3(0.67,0.30,0.14),interference);
      material += spectral * (0.13+fresnel*0.27);
      material += pow(1.0-facing,10.0)*vec3(0.95,0.76,0.50)*0.5;
      material = pow(material,vec3(0.87));
      gl_FragColor = vec4(material,0.93);
    }
  `;

  let gl = null;
  let program = null;
  let uniforms = null;
  function initializeGlass() {
    try {
      gl = glassCanvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
      if (!gl) return;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const info = gl.getShaderInfoLog(shader);
          gl.deleteShader(shader);
          throw new Error(info);
        }
        return shader;
      };
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = Object.fromEntries(['resolution','pointer','time','scroll','mobile'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
      root.classList.add('webgl-ready');
    } catch (error) {
      gl = null;
      root.classList.remove('webgl-ready');
      console.warn('The glass illustration is using its static fallback.', error.message);
    }
  }

  const dust = dustCanvas.getContext('2d');
  // A seeded field makes the first frame consistent and keeps particles stable on resize.
  let seed = 7381;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const particles = Array.from({ length: 350 }, () => ({
    angle: random() * Math.PI * 2,
    radius: 0.4 + random() * 1.4,
    depth: random(),
    size: 0.4 + random() * 1.1,
    alpha: 0.08 + random() * 0.42
  }));

  function resize() {
    const box = hero.getBoundingClientRect();
    width = box.width;
    height = box.height;
    // Cap fragment work on high-DPI phones and large monitors.
    const ratio = Math.min(devicePixelRatio || 1, 1.4, 1500 / width);
    glassCanvas.width = Math.round(width * ratio);
    glassCanvas.height = Math.round(height * ratio);
    dustCanvas.width = Math.round(width * ratio);
    dustCanvas.height = Math.round(height * ratio);
    if (dust) dust.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
    updateScroll();
  }

  function drawDust() {
    if (!dust) return;
    dust.clearRect(0, 0, width, height);
    const mobile = width <= 700;
    const centerX = width * (mobile ? 0.51 : 0.705);
    const centerY = height * (mobile ? 0.65 : 0.51);
    const scale = Math.min(width, height) * (mobile ? 0.43 : 0.35);
    particles.forEach(p => {
      const angle = p.angle + elapsed * 0.027 * (0.4 + p.depth);
      const orbitX = Math.cos(angle) * p.radius;
      const orbitY = Math.sin(angle) * p.radius * 0.62;
      const x = centerX + (orbitX * 0.91 + orbitY * 0.36) * scale + pointer.x * p.depth * 8;
      const y = centerY + (orbitY * 0.91 - orbitX * 0.36) * scale + pointer.y * p.depth * 7;
      dust.beginPath();
      dust.fillStyle = `rgba(207,166,119,${p.alpha})`;
      dust.arc(x, y, p.size * (0.5 + p.depth * 0.5), 0, Math.PI * 2);
      dust.fill();
    });
  }

  function draw() {
    drawDust();
    if (!gl || gl.isContextLost() || !uniforms) return;
    gl.viewport(0, 0, glassCanvas.width, glassCanvas.height);
    gl.uniform2f(uniforms.resolution, glassCanvas.width, glassCanvas.height);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.scroll, motion ? heroProgress : 0);
    gl.uniform1f(uniforms.mobile, width <= 700 ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(time) {
    frameId = 0;
    if (!motion || !heroVisible || document.hidden) { lastTime = 0; return; }
    if (lastTime) elapsed += Math.min((time - lastTime) / 1000, 0.05);
    lastTime = time;
    pointer.x += (pointer.targetX - pointer.x) * 0.055;
    pointer.y += (pointer.targetY - pointer.y) * 0.055;
    // 30fps is enough for this quiet sculpture, with much lower idle GPU use.
    if (time - lastDraw > 32) { draw(); lastDraw = time; }
    frameId = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    if (motion && heroVisible && !document.hidden) frameId = requestAnimationFrame(tick);
    if (motion && videoVisible && !document.hidden) {
      const play = video.play();
      if (play) play.catch(() => { /* The poster remains if autoplay is unavailable. */ });
    } else video.pause();
  }

  function syncMotion() {
    root.classList.toggle('motion-paused', !motion);
    motionButton.hidden = false;
    motionButton.setAttribute('aria-pressed', String(!motion));
    motionButton.querySelector('span').textContent = motion ? 'Pause motion' : 'Enable motion';
    motionButton.querySelector('path').setAttribute('d', motion ? 'M2 1h3v10H2zm5 0h3v10H7z' : 'M3 1l8 5-8 5z');
    syncAnimation();
    draw();
  }

  motionButton.addEventListener('click', () => {
    motion = !motion;
    preference = motion ? 'on' : 'off';
    try { localStorage.setItem('zw-motion', preference); } catch { /* Optional preference only. */ }
    syncMotion();
  });
  systemMotion.addEventListener('change', () => {
    if (!preference) { motion = !systemMotion.matches; syncMotion(); }
  });

  let scrollPending = false;
  const perspective = document.querySelector('.perspective-section');
  const phrases = [...document.querySelectorAll('.perspective-text > span')];
  function updateScroll() {
    scrollPending = false;
    const total = document.documentElement.scrollHeight - innerHeight;
    root.style.setProperty('--scroll', total > 0 ? String(scrollY / total) : '0');
    heroProgress = Math.min(1, Math.max(0, scrollY / height));
    root.style.setProperty('--hero-scroll', motion ? String(heroProgress) : '0');
    const box = perspective.getBoundingClientRect();
    const progress = Math.max(0, Math.min(1, (innerHeight * 0.65 - box.top) / Math.max(innerHeight, box.height - innerHeight * 0.3)));
    perspective.style.setProperty('--perspective-progress', String(progress));
    phrases.forEach((phrase, index) => phrase.classList.toggle('lit', progress >= index * 0.23));
    if (heroVisible && !motion) draw();
  }
  addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  hero.addEventListener('pointermove', event => {
    if (!motion || event.pointerType === 'touch') return;
    const box = hero.getBoundingClientRect();
    pointer.targetX = (event.clientX / box.width - 0.5) * 2;
    pointer.targetY = ((event.clientY - box.top) / box.height - 0.5) * 2;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; });

  if ('IntersectionObserver' in window) {
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); reveals.unobserve(entry.target); }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(element => reveals.observe(element));
    root.classList.add('motion-ready');
    new IntersectionObserver(entries => {
      heroVisible = entries[0].isIntersecting;
      syncAnimation();
    }).observe(hero);
    new IntersectionObserver(entries => {
      videoVisible = entries[0].isIntersecting;
      syncAnimation();
    }, { threshold: 0.1 }).observe(video);
  }
  document.addEventListener('visibilitychange', syncAnimation);
  glassCanvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    root.classList.remove('webgl-ready');
  });
  glassCanvas.addEventListener('webglcontextrestored', () => { initializeGlass(); resize(); });
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(hero);
  initializeGlass();
  resize();
  syncMotion();
})();
