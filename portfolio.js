(() => {
  'use strict';

  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  const glassCanvas = document.getElementById('glass-canvas');
  const dustCanvas = document.getElementById('dust-canvas');
  const video = document.getElementById('projector-video');
  const projector = video.closest('.project-feature');
  const motionButton = document.getElementById('motion-toggle');
  const heroMotionButton = document.getElementById('hero-motion');
  const turnInput = document.getElementById('sculpture-turn');
  const formButtons = [...document.querySelectorAll('[data-form]')];
  const sculptureSurface = document.querySelector('.sculpture-surface');
  const systemMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let preference = null;
  try { preference = localStorage.getItem('zw-motion'); } catch { /* Storage can be unavailable in private browsing. */ }
  let motion = preference ? preference === 'on' : !systemMotion.matches;
  let heroVisible = true;
  let videoVisible = false;
  let videoHovered = false;
  let videoFocused = false;
  let frameId = 0;
  let elapsed = 0;
  let lastTime = 0;
  let lastDraw = 0;
  let wakeUntil = 0;
  let turnVelocity = 0;
  let drag = null;
  let needsDraw = true;
  let width = 1;
  let height = 1;
  let heroProgress = 0;
  let form = 0;
  let targetForm = 0;
  let turn = 0;
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
    uniform float u_form;
    uniform float u_turn;
    mat2 turn(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
    vec3 localPoint(vec3 p) {
      p.xy = turn(-0.36 + sin(u_time * 0.17) * 0.08 + u_pointer.x * 0.08) * p.xy;
      p.xz = turn(0.33 + u_turn + sin(u_time * 0.21) * 0.21 + u_scroll * 0.7 + u_pointer.x * 0.35) * p.xz;
      p.yz = turn(0.34 + cos(u_time * 0.16) * 0.13 + u_pointer.y * 0.10) * p.yz;
      return p;
    }
    float shape(vec3 p) {
      p = localPoint(p);
      p.x /= 1.16;
      vec2 ring = vec2(length(p.xy) - 1.03, p.z);
      float halo = length(ring) - 0.285;
      float orbit = min(length(ring) - 0.145, length(vec2(length(p.xz) - 0.93, p.y)) - 0.145);
      float pebble = length(p * vec3(0.96, 1.12, 1.35)) - 1.05;
      pebble += 0.035 * sin(p.x * 4.0 + u_time * 0.4) * sin(p.y * 3.5);
      return mix(mix(halo, orbit, clamp(u_form, 0.0, 1.0)), pebble, clamp(u_form - 1.0, 0.0, 1.0));
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
      else { uv -= vec2(u_resolution.x/u_resolution.y * 0.40,0.08); uv *= 1.28; }
      uv.y += sin(u_time*0.37)*0.035;
      vec3 ro = vec3(0.0,0.0,4.5);
      vec3 rd = normalize(vec3(uv,-3.4));
      // Skip the empty part of each ray and reject the surrounding canvas.
      // The largest rotated/scaled form fits inside a radius-1.65 sphere.
      float b = dot(ro, rd);
      float discriminant = b*b-dot(ro,ro)+2.7225;
      if (discriminant < 0.0) { gl_FragColor = vec4(0.0); return; }
      float root = sqrt(discriminant);
      float distance = max(0.0,-b-root);
      float farDistance = -b+root;
      bool hit = false;
      for (int i = 0; i < 64; i++) {
        float stepSize = shape(ro + rd * distance);
        if (stepSize < 0.0016) { hit = true; break; }
        distance += stepSize * 0.83;
        if (distance > farDistance) break;
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
      vec3 spectral = mix(vec3(0.20,0.36,0.42),vec3(0.67,0.30,0.14),interference);
      spectral = mix(spectral, vec3(0.23,0.42,0.41), 0.24*u_form);
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
      uniforms = Object.fromEntries(['resolution','pointer','time','scroll','mobile','form','turn'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
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
  const particles = Array.from({ length: 180 }, () => ({
    angle: random() * Math.PI * 2,
    radius: 0.4 + random() * 1.4,
    depth: random(),
    size: 0.4 + random() * 1.1,
    alpha: 0.1 + random() * 0.35
  }));

  function resize() {
    const box = hero.getBoundingClientRect();
    width = box.width;
    height = box.height;
    // A fixed area budget also bounds work on tall high-DPI phones.
    const budget = width <= 700 ? 450000 : 650000;
    const ratio = Math.min(devicePixelRatio || 1, 1.25, Math.sqrt(budget / (width * height)));
    glassCanvas.width = Math.round(width * ratio);
    glassCanvas.height = Math.round(height * ratio);
    const dustRatio = Math.min(1, ratio);
    dustCanvas.width = Math.round(width * dustRatio);
    dustCanvas.height = Math.round(height * dustRatio);
    if (dust) dust.setTransform(dustRatio, 0, 0, dustRatio, 0, 0);
    needsDraw = true;
    wake(0);
    updateScroll();
  }

  function drawDust() {
    if (!dust) return;
    dust.clearRect(0, 0, width, height);
    const mobile = width <= 700;
    const centerX = width * (mobile ? 0.51 : 0.705);
    const centerY = height * (mobile ? 0.65 : 0.51);
    const scale = Math.min(width, height) * (mobile ? 0.43 : 0.35);
    // Four alpha buckets use four fills rather than a path/fill per particle.
    for (let bucket = 0; bucket < 4; bucket++) {
      dust.beginPath();
      dust.fillStyle = `rgba(207,166,119,${0.12 + bucket * 0.09})`;
      particles.forEach((p, index) => {
      if (index % 4 !== bucket || (mobile && index > 105)) return;
      const angle = p.angle + elapsed * 0.027 * (0.4 + p.depth);
      const orbitX = Math.cos(angle) * p.radius;
      const orbitY = Math.sin(angle) * p.radius * 0.62;
      const x = centerX + (orbitX * 0.91 + orbitY * 0.36) * scale + pointer.x * p.depth * 8;
      const y = centerY + (orbitY * 0.91 - orbitX * 0.36) * scale + pointer.y * p.depth * 7;
      const radius = p.size * (0.5 + p.depth * 0.5);
      dust.moveTo(x + radius, y);
      dust.arc(x, y, radius, 0, Math.PI * 2);
      });
      dust.fill();
    }
  }

  function draw() {
    if (!heroVisible || document.hidden) { needsDraw = true; return; }
    needsDraw = false;
    drawDust();
    if (!gl || gl.isContextLost() || !uniforms) return;
    gl.viewport(0, 0, glassCanvas.width, glassCanvas.height);
    gl.uniform2f(uniforms.resolution, glassCanvas.width, glassCanvas.height);
    gl.uniform2f(uniforms.pointer, pointer.x, pointer.y);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.scroll, motion ? heroProgress : 0);
    gl.uniform1f(uniforms.mobile, width <= 700 ? 1 : 0);
    gl.uniform1f(uniforms.form, form);
    gl.uniform1f(uniforms.turn, turn);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  function tick(time) {
    frameId = 0;
    if (!heroVisible || document.hidden) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
    lastTime = time;
    if (motion) {
      const blend = 1 - Math.exp(-dt * 11);
      pointer.x += (pointer.targetX - pointer.x) * blend;
      pointer.y += (pointer.targetY - pointer.y) * blend;
      form += (targetForm - form) * blend;
      if (!drag && Math.abs(turnVelocity) > .002) {
        turn += turnVelocity * dt;
        turnVelocity *= Math.exp(-dt * 5.5);
        updateTurn();
      }
      if (time < wakeUntil) elapsed += dt * .65;
    } else {
      pointer.x = pointer.targetX; pointer.y = pointer.targetY; form = targetForm;
      turnVelocity = 0;
    }
    const unsettled = motion && (time < wakeUntil || Math.abs(targetForm-form) > .0005 || Math.abs(pointer.x-pointer.targetX) + Math.abs(pointer.y-pointer.targetY) > .001 || Math.abs(turnVelocity) > .002);
    // Active gestures get a smooth30Hz render. Resting pages schedule no frames.
    if (time-lastDraw >= 32 || !unsettled || !lastDraw) { draw(); lastDraw = time; }
    if (unsettled) frameId = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function wake(duration = 700) {
    needsDraw = true;
    if (motion) wakeUntil = Math.max(wakeUntil, performance.now() + duration);
    if (heroVisible && !document.hidden && !frameId) frameId = requestAnimationFrame(tick);
  }

  function syncAnimation() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    lastTime = 0;
    if (heroVisible && !document.hidden && (needsDraw || motion && performance.now()<wakeUntil)) wake(0);
    if (motion && videoVisible && (videoHovered || videoFocused) && !document.hidden) {
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
    heroMotionButton.setAttribute('aria-pressed', String(!motion));
    heroMotionButton.textContent = motion ? 'Pause' : 'Resume';
    if (!motion) form = targetForm;
    syncAnimation();
    wake(0);
  }

  function toggleMotion() {
    motion = !motion;
    preference = motion ? 'on' : 'off';
    try { localStorage.setItem('zw-motion', preference); } catch { /* Optional preference only. */ }
    syncMotion();
  }
  motionButton.addEventListener('click', toggleMotion);
  heroMotionButton.addEventListener('click', toggleMotion);
  document.querySelector('.sculpture-dock').hidden = false;
  formButtons.forEach(button => button.addEventListener('click', () => {
    targetForm = Number(button.dataset.form);
    formButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    root.dataset.sculpture = ['halo', 'orbit', 'pebble'][targetForm];
    if (!motion || !heroVisible) form = targetForm;
    wake(900);
  }));
  function updateTurn() {
    const degrees = ((turn * 180 / Math.PI + 180) % 360 + 360) % 360 - 180;
    turnInput.value = String(Math.round(degrees));
    document.getElementById('turn-value').textContent = `${Math.round(degrees)}°`;
    turnInput.setAttribute('aria-valuetext', `${Math.round(degrees)} degrees`);
    root.style.setProperty('--sculpture-turn', `${degrees}deg`);
  }
  turnInput.addEventListener('input', () => {
    turn = Number(turnInput.value) * Math.PI / 180;
    turnVelocity = 0;
    updateTurn();
    wake(400);
  });
  systemMotion.addEventListener('change', () => {
    if (!preference) { motion = !systemMotion.matches; syncMotion(); }
  });

  let scrollPending = false;
  function updateScroll() {
    scrollPending = false;
    const total = document.documentElement.scrollHeight - innerHeight;
    root.style.setProperty('--scroll', total > 0 ? String(scrollY / total) : '0');
    heroProgress = Math.min(1, Math.max(0, scrollY / height));
    root.style.setProperty('--hero-scroll', motion ? String(heroProgress) : '0');
    if (heroVisible) wake(0);
  }
  addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  hero.addEventListener('pointermove', event => {
    if (!motion || event.pointerType === 'touch') return;
    const box = hero.getBoundingClientRect();
    pointer.targetX = ((event.clientX - box.left) / box.width - 0.5) * 2;
    pointer.targetY = ((event.clientY - box.top) / box.height - 0.5) * 2;
    wake(450);
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.targetX = 0; pointer.targetY = 0; wake(500); });

  // Direct manipulation supplements the native angle slider. Vertical touch
  // gestures remain page scrolling; only an intentional horizontal drag turns it.
  sculptureSurface.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id:event.pointerId, x:event.clientX, y:event.clientY, previousX:event.clientX, time:event.timeStamp, turning:false };
    turnVelocity = 0;
  });
  sculptureSurface.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    if (!event.buttons) { turnVelocity=0;drag=null;sculptureSurface.classList.remove('is-turning');return; }
    const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
    if (!drag.turning) {
      if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { drag=null;turnVelocity=0;return; }
      if (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      drag.turning = true;
      sculptureSurface.setPointerCapture(event.pointerId);
      sculptureSurface.classList.add('is-turning');
    }
    const delta = (event.clientX-drag.previousX) * .009;
    turn += delta;
    turnVelocity = motion ? Math.max(-5,Math.min(5,delta / Math.max(.008,(event.timeStamp-drag.time)/1000))) : 0;
    drag.previousX = event.clientX; drag.time = event.timeStamp;
    updateTurn(); wake(250);
  });
  function finishDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    if (!drag.turning && event.type==='pointerup') { turn += Math.PI / 9; updateTurn(); }
    drag = null; sculptureSurface.classList.remove('is-turning'); wake(350);
  }
  sculptureSurface.addEventListener('pointerup',finishDrag);
  sculptureSurface.addEventListener('pointercancel',event=>{turnVelocity=0;finishDrag(event);});
  sculptureSurface.addEventListener('lostpointercapture',event=>{if(drag){turnVelocity=0;finishDrag(event);}});
  sculptureSurface.addEventListener('pointerleave',event=>{if(drag && !drag.turning){drag=null;turnVelocity=0;sculptureSurface.classList.remove('is-turning');}});

  // Local highlights respond directly to the hand; there is no extra animation loop.
  document.querySelectorAll('.project-feature, .project-card, .graphics-study, .doorways a').forEach(card => {
    let pending = 0, point = null;
    const paint = () => {
      pending = 0;
      if (!point) return;
      const box = card.getBoundingClientRect();
      const x = Math.max(0,Math.min(1,(point.x-box.left)/box.width));
      const y = Math.max(0,Math.min(1,(point.y-box.top)/box.height));
      card.style.setProperty('--light-x', `${(x*100).toFixed(1)}%`);
      card.style.setProperty('--light-y', `${(y*100).toFixed(1)}%`);
      card.style.setProperty('--look-x', `${((x-.5)*9).toFixed(2)}deg`);
      card.style.setProperty('--look-y', `${((.5-y)*6).toFixed(2)}deg`);
    };
    card.addEventListener('pointermove', event => {
      if (!motion || event.pointerType === 'touch') return;
      point = {x:event.clientX,y:event.clientY};
      if (!pending) pending = requestAnimationFrame(paint);
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      if (pending) cancelAnimationFrame(pending);
      pending = 0; point = null;
      card.style.setProperty('--look-x', '0deg');
      card.style.setProperty('--look-y', '0deg');
    });
    card.addEventListener('focusin',()=>{if(motion){point={x:card.getBoundingClientRect().left+card.clientWidth*.65,y:card.getBoundingClientRect().top+card.clientHeight*.35};paint();}});
    card.addEventListener('focusout',()=>{point=null;card.style.setProperty('--look-x','0deg');card.style.setProperty('--look-y','0deg');});
  });

  // The film comes alive with attention. Scrolling past keeps its still poster,
  // and touch navigation stays the normal project link without a playback step.
  projector.addEventListener('pointerenter',event=>{
    if(event.pointerType==='touch')return;
    videoHovered=true;syncAnimation();
  });
  projector.addEventListener('pointerleave',()=>{videoHovered=false;syncAnimation();});
  projector.addEventListener('focusin',()=>{videoFocused=true;syncAnimation();});
  projector.addEventListener('focusout',event=>{
    videoFocused=!!event.relatedTarget && projector.contains(event.relatedTarget);
    syncAnimation();
  });

  // Real unit-scale densities, explicitly presented as teaching examples, not fits.
  const densityButtons = [...document.querySelectorAll('[data-density]')];
  const curve = document.getElementById('density-curve');
  const area = document.getElementById('density-area');
  const densities = {
    normal: { value: x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI), caption: 'A familiar bell. Thin tails.', label: 'Normal probability density: a smooth bell with thin tails' },
    laplace: { value: x => Math.exp(-Math.abs(x)) / 2, caption: 'A sharp middle. Heavier tails.', label: 'Laplace probability density: a sharp middle with heavier tails than a normal distribution' },
    cauchy: { value: x => 1 / (Math.PI * (1 + x * x)), caption: 'Rare extremes stay plausible.', label: 'Cauchy probability density: a rounded middle with heavy, polynomially decaying tails' }
  };
  const sampleDensity = key => Array.from({length: 161}, (_, i) => densities[key].value(-4 + i / 20));
  let displayedDensity = sampleDensity('laplace');
  let densityFrame = 0;
  let probeFrame = 0, probeX = 0, probeVisible = false;
  const densitySvg = document.getElementById('density-preview');
  const svgNS = 'http://www.w3.org/2000/svg';
  const probe = document.createElementNS(svgNS,'g');
  probe.classList.add('density-probe');probe.setAttribute('aria-hidden','true');
  const probeLine = document.createElementNS(svgNS,'line');
  const probeDot = document.createElementNS(svgNS,'circle');
  const probeText = document.createElementNS(svgNS,'text');
  probeLine.setAttribute('y2','244');probeDot.setAttribute('r','4');
  probe.append(probeLine,probeDot,probeText);densitySvg.append(probe);
  function drawProbe() {
    probeFrame = 0;
    probe.style.display = probeVisible ? '' : 'none';
    if(!probeVisible)return;
    const index=Math.max(0,Math.min(160,(probeX+4)*20));
    const lower=Math.floor(index),upper=Math.min(160,lower+1);
    const value=displayedDensity[lower]+(displayedDensity[upper]-displayedDensity[lower])*(index-lower);
    const x=40+(probeX+4)*45,y=244-value*365;
    probeLine.setAttribute('x1',x);probeLine.setAttribute('x2',x);probeLine.setAttribute('y1',y);
    probeDot.setAttribute('cx',x);probeDot.setAttribute('cy',y);
    probeText.setAttribute('x',Math.max(100,Math.min(340,x)));probeText.setAttribute('y',Math.max(25,y-14));
    probeText.textContent=`${probeX.toFixed(1).replace('-','−')}  /  ${value.toFixed(3)}`;
  }
  function scheduleProbe(){if(!probeFrame)probeFrame=requestAnimationFrame(drawProbe);}
  densitySvg.setAttribute('tabindex','0');
  densitySvg.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const box=densitySvg.getBoundingClientRect();
    probeX=Math.max(-4,Math.min(4,((event.clientX-box.left)/box.width*440-40)/45));
    probeVisible=true;scheduleProbe();
  },{passive:true});
  densitySvg.addEventListener('pointerleave',()=>{probeVisible=document.activeElement===densitySvg;scheduleProbe();});
  densitySvg.addEventListener('focus',()=>{probeVisible=true;scheduleProbe();});
  densitySvg.addEventListener('blur',()=>{probeVisible=false;scheduleProbe();});
  densitySvg.addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();
    probeX=event.key==='Home'?-4:event.key==='End'?4:Math.max(-4,Math.min(4,probeX+(event.key==='ArrowLeft'?-.1:.1)));
    probeVisible=true;scheduleProbe();
  });
  function drawDensity(values) {
    const path = values.map((value, i) => `${i ? 'L' : 'M'}${(40 + i * 2.25).toFixed(2)},${(244 - value * 365).toFixed(2)}`).join('');
    curve.setAttribute('d', path);
    area.setAttribute('d', `${path}L400,244L40,244Z`);
    displayedDensity = values;
    if(probeVisible)drawProbe();
  }
  drawDensity(displayedDensity);
  drawProbe();
  document.querySelector('.density-switch').hidden = false;
  densityButtons.forEach(button => button.addEventListener('click', () => {
    const key = button.dataset.density;
    const startValues = displayedDensity.slice();
    const destination = sampleDensity(key);
    if (densityFrame) cancelAnimationFrame(densityFrame);
    densityButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    document.getElementById('density-caption').textContent = densities[key].caption;
    document.getElementById('density-preview').setAttribute('aria-label', densities[key].label);
    if (!motion) { drawDensity(destination); return; }
    const startTime = performance.now();
    function blend(time) {
      const progress = motion ? Math.min(1, (time - startTime) / 420) : 1;
      const eased = 1 - (1 - progress) ** 3;
      drawDensity(destination.map((value, i) => startValues[i] + (value - startValues[i]) * eased));
      densityFrame = progress < 1 ? requestAnimationFrame(blend) : 0;
    }
    densityFrame = requestAnimationFrame(blend);
  }));

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
      if (heroVisible) needsDraw = true;
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
  wake(1800);
})();
