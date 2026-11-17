import { mixture, normalPdf, createRng, sampleNormal, logGamma, ksGap } from './math.mjs';
import { initImageLab, initHeroArt } from './image-lab.mjs';
import { initEvidence } from './evidence-ui.mjs';
import { initJourney } from './journey.mjs';
import { createFitEvaluator } from './fit-model.mjs';
import { bindHorizontalControl } from './direct-input.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
const fmt = (value, places = 2) => Number(value).toFixed(places).replace('-', '−');
const ns = 'http://www.w3.org/2000/svg';
const palette = { forest: '#3e6042', copper: '#b96d49', cream: '#e6edcc', grid: '#99a878', sage: '#8d9c73' };
let plotSerial = 0;
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const preference = localStorage.getItem('zw-motion'); if (preference) motion = preference === 'on'; } catch { /* Optional storage only. */ }

function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function setAttr(node, name, value) {
  const str = String(value);
  if (node.getAttribute(name) !== str) node.setAttribute(name, str);
}
function setText(node, value) {
  const str = String(value);
  const first = node.firstChild;
  if (first && first.nodeType === 3 && first === node.lastChild) {
    if (first.nodeValue !== str) first.nodeValue = str;
  } else if (node.textContent !== str) {
    node.textContent = str;
  }
}
function describe(svg, text) {
  setAttr(svg, 'aria-label', text);
  if (svg._chart?.title) setText(svg._chart.title, text);
}

// Persistent SVG chart scaffold: updates axes, curves, markers, and labels in place without replaceChildren().
function chart(svg, { xMin = -4, xMax = 4, yMin = 0, yMax = 1, xTicks, yTicks, xLabel = 'Coefficient value', yLabel = 'Density', dark = false } = {}) {
  const [, , w, h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const textScale = Math.min(2.2, Math.max(1, w / Math.max(1, svg.getBoundingClientRect().width)));
  const box = { left: 49 + Math.max(0, textScale - 1) * 9, right: w - 18, top: 24 + Math.max(0, textScale - 1) * 7, bottom: h - 43 - Math.max(0, textScale - 1) * 8 };
  const x = value => box.left + (value - xMin) / (xMax - xMin) * (box.right - box.left);
  const y = value => box.bottom - (value - yMin) / (yMax - yMin) * (box.bottom - box.top);

  let state = svg._chart;
  if (!state) {
    const clipId = `plot-clip-${++plotSerial}`;
    const title = svgNode('title', {}, svg.getAttribute('aria-label') || '');
    const defs = svgNode('defs');
    const clip = svgNode('clipPath', { id: clipId });
    const clipRect = svgNode('rect');
    clip.append(clipRect);
    defs.append(clip);
    const axesGroup = svgNode('g');
    const zeroLine = svgNode('line', { 'stroke-dasharray': '3 5' });
    const yAxisLabel = svgNode('text');
    const xAxisLabel = svgNode('text', { 'text-anchor': 'middle' });
    const layer = svgNode('g', { 'clip-path': `url(#${clipId})` });
    const overlay = svgNode('g');
    svg.append(title, defs, axesGroup, zeroLine, yAxisLabel, xAxisLabel, layer, overlay);
    state = svg._chart = {
      title, clipRect, axesGroup, zeroLine, yAxisLabel, xAxisLabel, layer, overlay,
      yTicksPool: [], xTicksPool: [], paths: [], circles: [], segments: [], shapes: [], labels: [],
      pathIndex: 0, circleIndex: 0, segmentIndex: 0, shapeIndex: 0, labelIndex: 0
    };
  }

  setAttr(state.clipRect, 'x', box.left);
  setAttr(state.clipRect, 'y', box.top);
  setAttr(state.clipRect, 'width', box.right - box.left);
  setAttr(state.clipRect, 'height', box.bottom - box.top);

  const grid = dark ? '#9eaf7938' : '#9eaf7940';
  const labelColor = dark ? '#9db78a' : '#788b62';
  const yt = yTicks || [yMin, (yMin + yMax) / 2, yMax];
  while (state.yTicksPool.length < yt.length) {
    const gl = svgNode('line', { 'stroke-width': 1 });
    const tx = svgNode('text', { 'text-anchor': 'end' });
    state.axesGroup.append(gl, tx);
    state.yTicksPool.push({ gl, tx });
  }
  state.yTicksPool.forEach((item, i) => {
    if (i >= yt.length) { setAttr(item.gl, 'display', 'none'); setAttr(item.tx, 'display', 'none'); return; }
    const val = yt[i], py = y(val);
    setAttr(item.gl, 'display', ''); setAttr(item.tx, 'display', '');
    setAttr(item.gl, 'x1', box.left); setAttr(item.gl, 'y1', py); setAttr(item.gl, 'x2', box.right); setAttr(item.gl, 'y2', py); setAttr(item.gl, 'stroke', grid);
    setAttr(item.tx, 'x', box.left - 9); setAttr(item.tx, 'y', py + 4);
    setAttr(item.tx, 'style', `fill:${labelColor};font-size:${10 * textScale}px`);
    setText(item.tx, Math.abs(val) < 0.00001 ? '0' : Math.abs(val) >= 10 ? fmt(val, 0) : fmt(val, 1));
  });

  const xt = xTicks || [xMin, (xMin + xMax) / 2, xMax];
  while (state.xTicksPool.length < xt.length) {
    const gl = svgNode('line');
    const tx = svgNode('text', { 'text-anchor': 'middle' });
    state.axesGroup.append(gl, tx);
    state.xTicksPool.push({ gl, tx });
  }
  state.xTicksPool.forEach((item, i) => {
    if (i >= xt.length) { setAttr(item.gl, 'display', 'none'); setAttr(item.tx, 'display', 'none'); return; }
    const val = xt[i], px = x(val);
    setAttr(item.gl, 'display', ''); setAttr(item.tx, 'display', '');
    setAttr(item.gl, 'x1', px); setAttr(item.gl, 'y1', box.bottom); setAttr(item.gl, 'x2', px); setAttr(item.gl, 'y2', box.bottom + 4); setAttr(item.gl, 'stroke', grid);
    setAttr(item.tx, 'x', px); setAttr(item.tx, 'y', box.bottom + 20 + Math.max(0, textScale - 1) * 3);
    setAttr(item.tx, 'style', `fill:${labelColor};font-size:${10 * textScale}px`);
    setText(item.tx, Math.abs(val) < 1e-8 ? '0' : fmt(val, 1));
  });

  if (xMin < 0 && xMax > 0) {
    setAttr(state.zeroLine, 'display', '');
    setAttr(state.zeroLine, 'x1', x(0)); setAttr(state.zeroLine, 'y1', box.top); setAttr(state.zeroLine, 'x2', x(0)); setAttr(state.zeroLine, 'y2', box.bottom); setAttr(state.zeroLine, 'stroke', grid);
  } else setAttr(state.zeroLine, 'display', 'none');

  setAttr(state.yAxisLabel, 'x', box.left);
  setAttr(state.yAxisLabel, 'y', 14 + Math.max(0, textScale - 1) * 3);
  setAttr(state.yAxisLabel, 'style', `fill:${labelColor};font-size:${9 * textScale}px`);
  setText(state.yAxisLabel, yLabel);

  setAttr(state.xAxisLabel, 'x', (box.left + box.right) / 2);
  setAttr(state.xAxisLabel, 'y', h - 5);
  setAttr(state.xAxisLabel, 'style', `fill:${labelColor};font-size:${9 * textScale}px`);
  setText(state.xAxisLabel, xLabel);

  // Hide previous dynamic primitives; active calls below reveal only what this frame uses.
  for (let i = 0; i < state.pathIndex; i++) setAttr(state.paths[i], 'display', 'none');
  for (let i = 0; i < state.circleIndex; i++) setAttr(state.circles[i], 'display', 'none');
  for (let i = 0; i < state.segmentIndex; i++) setAttr(state.segments[i], 'display', 'none');
  for (let i = 0; i < state.shapeIndex; i++) setAttr(state.shapes[i], 'display', 'none');
  for (let i = 0; i < state.labelIndex; i++) setAttr(state.labels[i], 'display', 'none');
  state.pathIndex = state.circleIndex = state.segmentIndex = state.shapeIndex = state.labelIndex = 0;

  return { svg, state, layer: state.layer, overlay: state.overlay, x, y, box, w, h, xMin, xMax, yMin, yMax };
}

function line(plot, points, { color = palette.forest, width = 2.4, dash = '', opacity = 1, fill = false } = {}) {
  const valid = points.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!valid.length) return;
  let d = valid.map(([x, y], index) => `${index ? 'L' : 'M'}${plot.x(x).toFixed(2)},${plot.y(y).toFixed(2)}`).join(' ');
  if (fill) d += ` L${plot.x(valid.at(-1)[0]).toFixed(2)},${plot.y(plot.yMin).toFixed(2)} L${plot.x(valid[0][0]).toFixed(2)},${plot.y(plot.yMin).toFixed(2)}Z`;
  const { state } = plot;
  let node = state.paths[state.pathIndex];
  if (!node) {
    node = svgNode('path', { 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
    state.layer.append(node);
    state.paths.push(node);
  }
  state.pathIndex++;
  setAttr(node, 'display', '');
  setAttr(node, 'd', d);
  setAttr(node, 'fill', fill ? color : 'none');
  setAttr(node, 'fill-opacity', fill ? .09 : 1);
  setAttr(node, 'stroke', color);
  setAttr(node, 'stroke-width', width);
  setAttr(node, 'opacity', opacity);
  if (dash) setAttr(node, 'stroke-dasharray', dash);
  else node.removeAttribute?.('stroke-dasharray');
}

function plotSegment(plot, attrs) {
  const { state } = plot;
  let node = state.segments[state.segmentIndex];
  if (!node) { node = svgNode('line'); state.layer.append(node); state.segments.push(node); }
  state.segmentIndex++;
  setAttr(node, 'display', '');
  Object.entries(attrs).forEach(([k, v]) => setAttr(node, k, v));
  if (!attrs['stroke-dasharray']) node.removeAttribute?.('stroke-dasharray');
}

function plotCircle(plot, attrs) {
  const { state } = plot;
  let node = state.circles[state.circleIndex];
  if (!node) { node = svgNode('circle'); state.layer.append(node); state.circles.push(node); }
  state.circleIndex++;
  setAttr(node, 'display', '');
  Object.entries(attrs).forEach(([k, v]) => setAttr(node, k, v));
}

function plotShape(plot, attrs) {
  const { state } = plot;
  let node = state.shapes[state.shapeIndex];
  if (!node) { node = svgNode('path'); state.layer.append(node); state.shapes.push(node); }
  state.shapeIndex++;
  setAttr(node, 'display', '');
  Object.entries(attrs).forEach(([k, v]) => setAttr(node, k, v));
}

function plotLabel(plot, attrs, text) {
  const { state } = plot;
  let node = state.labels[state.labelIndex];
  if (!node) { node = svgNode('text'); state.overlay.append(node); state.labels.push(node); }
  state.labelIndex++;
  setAttr(node, 'display', '');
  Object.entries(attrs).forEach(([k, v]) => setAttr(node, k, v));
  setText(node, text);
}

function sampleCurve(fn, min, max, n = 220) {
  return Array.from({ length: n + 1 }, (_, i) => { const x = min + (max - min) * i / n; return [x, fn(x)]; });
}
function pressed(selector, selected) { $$(selector).forEach(button => button.setAttribute('aria-pressed', String(button === selected))); }
function coalesced(fn) { let pending = false; return () => { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; fn(); }); } }; }

function watchChart(selector, render) {
  const target = $(selector);
  let lastWidth = 0;
  const redraw = coalesced(() => {
    const width = target.getBoundingClientRect().width;
    if (width > 0 && Math.abs(width - lastWidth) > .5) { lastWidth = width; render(); }
  });
  new ResizeObserver(redraw).observe(target);
}

function initializeMotion() {
  const button = $('#motion');
  const update = () => {
    document.documentElement.classList.toggle('motion-paused', !motion);
    button.setAttribute('aria-pressed', String(!motion));
    button.textContent = motion ? 'Pause motion' : 'Enable motion';
    button.hidden = false;
  };
  button.addEventListener('click', () => {
    motion = !motion;
    try { localStorage.setItem('zw-motion', motion ? 'on' : 'off'); } catch { /* Optional preference. */ }
    update();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', event => {
    let hasPreference = false;
    try { hasPreference = !!localStorage.getItem('zw-motion'); } catch { /* Use OS setting. */ }
    if (!hasPreference) { motion = !event.matches; update(); }
  });
  update();
}

function inverseLab() {
  const control = $('#detail');
  const update = () => {
    const d = Number(control.value), left = .5 + d, right = .5 - d;
    $('#pixel-left').style.backgroundColor = `rgb(${Math.round(left * 255)} ${Math.round(left * 255)} ${Math.round(left * 255)})`;
    $('#pixel-right').style.backgroundColor = `rgb(${Math.round(right * 255)} ${Math.round(right * 255)} ${Math.round(right * 255)})`;
    $('#pixel-left-value').textContent = fmt(left);
    $('#pixel-right-value').textContent = fmt(right);
    $('#measurement').textContent = fmt((left + right) / 2);
    $('#detail-value').textContent = fmt(d);
    $('#haar-detail').textContent = fmt((left - right) / Math.SQRT2, 3);
    $('.two-pixels').setAttribute('aria-label', `Pixel brightnesses ${left.toFixed(2)} and ${right.toFixed(2)}. Their average stays 0.50.`);
    $$('[data-detail]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.detail) === d)));
  };
  control.addEventListener('input', update);
  bindHorizontalControl($('.two-pixels'), control, { sensitivity: 1.6 });
  $$('[data-detail]').forEach(button => button.addEventListener('click', () => { control.value = button.dataset.detail; update(); }));
  update();
}

function mixtureLab() {
  const rng = createRng(38768);
  let variances = [];
  let rainFrame = 0;
  let draws = [];
  const rain = $('#sample-rain'), ctx = rain.getContext('2d');
  function drawRain(progress = 1) {
    if (!ctx) return;
    const { width: w, height: h } = rain;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#a3b17a25';
    ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h - 18); ctx.stroke();
    const bins = Array(50).fill(0);
    draws.forEach((value, index) => {
      const bounded = clamp(value, -4, 4);
      const bin = clamp(Math.floor((bounded + 4) / 8 * 50), 0, 49);
      const row = bins[bin]++;
      const x = 38 + (bounded + 4) / 8 * (w - 56);
      const targetY = h - 25 - row * 6;
      const local = clamp((progress - index / draws.length * .22) / .78, 0, 1);
      const ease = 1 - Math.pow(1 - local, 3);
      const y = -15 - index % 9 * 9 + (targetY + 15 + index % 9 * 9) * ease;
      ctx.fillStyle = value < -4 || value > 4 ? '#d3aa78' : '#becd9f';
      ctx.beginPath(); ctx.arc(x, y, 2.0, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#93aa7f'; ctx.font = '9px Arial';
    ctx.fillText('−4', 35, h - 4); ctx.fillText('0', w / 2 - 4, h - 4); ctx.fillText('4', w - 22, h - 4);
    if (!draws.length) ctx.fillText('Samples from the mixture.', 40, 70);
  }
  const update = () => {
    cancelAnimationFrame(rainFrame);
    draws = []; drawRain();
    const count = Number($('#bells').value), variety = Number($('#width-variety').value);
    $('#bells-value').textContent = count;
    $('#width-variety-value').textContent = fmt(variety, 1);
    variances = Array.from({ length: count }, (_, i) => Math.exp(variety * Math.log(-Math.log(1 - (i + .5) / count) * 1.3)));
    const pdf = x => variances.reduce((sum, v) => sum + normalPdf(x, 0, Math.sqrt(v)) / count, 0);
    const maxPeak = Math.min(4.7, Math.max(...variances.map(v => normalPdf(0, 0, Math.sqrt(v)))) * 1.1);
    const plot = chart($('#mixture-plot'), { xMin: -4, xMax: 4, yMax: maxPeak, xTicks: [-4, -2, 0, 2, 4], yLabel: 'Probability density', dark: true });
    variances.forEach((v, index) => line(plot, sampleCurve(x => normalPdf(x, 0, Math.sqrt(v)), -4, 4, 140), { color: palette.copper, width: 1, opacity: .22 + index / count * .25 }));
    line(plot, sampleCurve(pdf, -4, 4, 240), { color: palette.cream, width: 3.2 });
    describe($('#mixture-plot'), `${count} zero-centered normal bells. Width variety ${variety.toFixed(2)}. The thick line is their equal-weight density mixture.`);
    $('#draw-summary').textContent = variety === 0 ? 'All variances are 1, so every component and the mixture are the same normal.' : `${count} normal components, all centered at zero. At full variety the variance choices approximate exponential mixing.`;
  };
  const scheduleUpdate = coalesced(update);
  $('#bells').addEventListener('input', scheduleUpdate);
  $('#width-variety').addEventListener('input', scheduleUpdate);
  $('#release-samples').addEventListener('click', () => {
    cancelAnimationFrame(rainFrame);
    draws = Array.from({ length: 120 }, () => sampleNormal(rng) * Math.sqrt(variances[Math.floor(rng() * variances.length)]));
    const outside = draws.filter(x => Math.abs(x) > 4).length;
    $('#draw-summary').textContent = `120 draws: each first chooses a variance, then a normal value. ${outside} outside the displayed [−4, 4] window are pinned to its edges.`;
    rain.setAttribute('aria-label', `120 values sampled from the finite normal mixture. ${outside} outside the visible range.`);
    const start = performance.now();
    const animate = time => {
      const progress = motion && !$('#three').hidden && !$('#probability-mixture').hidden && !document.hidden ? Math.min(1, (time - start) / 1400) : 1;
      drawRain(progress);
      if (progress < 1) rainFrame = requestAnimationFrame(animate);
    };
    rainFrame = requestAnimationFrame(animate);
  });
  watchChart('#mixture-plot', update);
  update();
}

const familyState = { r: 1, eta: -.5, vartheta: 2 };
let explorerModel;
let onFamilyChange = () => {};
function familyLab() {
  const branch = $('#tail-branch'), r = $('#r-control'), eta = $('#eta-control'), scale = $('#scale-control');
  const densitySvg = $('#family-density'), logSvg = $('#family-log');
  bindHorizontalControl(densitySvg, scale);
  bindHorizontalControl(logSvg, r);
  let cachedShape, densityPlot, logPlot, probeX = null;

  function makeProbe(svg) {
    const group = svgNode('g', { class: 'chart-probe', 'aria-hidden': 'true', display: 'none' });
    const vline = svgNode('line'), dot = svgNode('circle', { r: 4 }), label = svgNode('text', { 'text-anchor': 'middle' });
    group.append(vline, dot, label);
    return { svg, group, vline, dot, label };
  }
  const probes = [makeProbe(densitySvg), makeProbe(logSvg)];

  function updateProbes() {
    if (!densityPlot || !logPlot || !explorerModel) return;
    probes.forEach(p => { if (!p.group.parentNode) p.svg.append(p.group); });
    if (probeX === null) { probes.forEach(p => setAttr(p.group, 'display', 'none')); return; }
    const fx = explorerModel.pdf(probeX);
    const logFx = Math.log10(Math.max(fx, 1e-100));
    const configs = [
      { probe: probes[0], plot: densityPlot, val: Math.min(densityPlot.yMax, fx), text: `x ${fmt(probeX, 2)} · f ${fx > 99 ? fx.toExponential(1) : fx.toFixed(3)}` },
      { probe: probes[1], plot: logPlot, val: clamp(logFx, logPlot.yMin, logPlot.yMax), text: `log₁₀ f = ${logFx.toFixed(2)}` }
    ];
    configs.forEach(({ probe, plot, val, text }) => {
      const px = plot.x(probeX), py = plot.y(val);
      setAttr(probe.group, 'display', '');
      setAttr(probe.vline, 'x1', px); setAttr(probe.vline, 'x2', px); setAttr(probe.vline, 'y1', py); setAttr(probe.vline, 'y2', plot.box.bottom);
      setAttr(probe.dot, 'cx', px); setAttr(probe.dot, 'cy', py);
      setAttr(probe.label, 'x', clamp(px, plot.box.left + 64, plot.box.right - 64));
      setAttr(probe.label, 'y', Math.max(plot.box.top + 12, py - 10));
      setText(probe.label, text);
    });
  }

  for (const svg of [densitySvg, logSvg]) {
    svg.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || event.buttons) return;
      const plot = svg === densitySvg ? densityPlot : logPlot;
      if (!plot) return;
      const bounds = svg.getBoundingClientRect();
      const vx = (event.clientX - bounds.left) / Math.max(1, bounds.width) * plot.w;
      if (vx < plot.box.left || vx > plot.box.right) { probeX = null; updateProbes(); return; }
      probeX = clamp(plot.xMin + (vx - plot.box.left) / (plot.box.right - plot.box.left) * (plot.xMax - plot.xMin), -5, 5);
      updateProbes();
    }, { passive: true });
    svg.addEventListener('pointerleave', () => {
      if (document.activeElement !== densitySvg && document.activeElement !== logSvg) { probeX = null; updateProbes(); }
    });
    svg.addEventListener('focus', () => { if (probeX === null) probeX = 1.5; updateProbes(); });
    svg.addEventListener('blur', () => {
      if (document.activeElement !== densitySvg && document.activeElement !== logSvg) { probeX = null; updateProbes(); }
    });
    svg.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      probeX = event.key === 'Home' ? -5 : event.key === 'End' ? 5 : clamp((probeX ?? 0) + (event.key === 'ArrowLeft' ? -.2 : .2), -5, 5);
      updateProbes();
    });
  }

  function branchRanges(negative) {
    r.min = negative ? '-2' : '0.35'; r.max = negative ? '-.4' : '2.5'; r.step = '0.05';
    eta.min = negative ? '-5' : '-.75'; eta.max = negative ? '-1.7' : '3'; eta.step = '0.05';
    $('#r-label').textContent = negative ? 'Mixing exponent r' : 'Tail character r';
    $('#eta-label').textContent = negative ? 'Power-tail shape η' : 'Peak character η';
  }
  function render() {
    const previousParameters = [familyState.r, familyState.eta, familyState.vartheta];
    familyState.r = Number(r.value); familyState.eta = Number(eta.value); familyState.vartheta = 10 ** Number(scale.value);
    const shapeKey = JSON.stringify(familyState);
    if (cachedShape?.key !== shapeKey) {
      explorerModel = mixture(familyState.r, familyState.eta, familyState.vartheta);
      cachedShape = {
        key: shapeKey,
        model: explorerModel,
        points: Array.from({ length: 321 }, (_, i) => {
          const t = (i - 160) / 160, x = Math.sign(t) * 5 * t * t;
          return [x, explorerModel.pdf(x)];
        }),
        tails: Math.max(0, 2 * (1 - explorerModel.cdf(3)))
      };
    }
    explorerModel = cachedShape.model;
    $('#r-value').textContent = fmt(familyState.r);
    $('#eta-value').textContent = fmt(familyState.eta);
    $('#scale-value').textContent = fmt(familyState.vartheta);
    scale.setAttribute('aria-valuetext', `Variance scale ${familyState.vartheta.toPrecision(4)}`);
    $('#beta-value').textContent = fmt(explorerModel.beta);
    const points = cachedShape.points;
    const peak = explorerModel.pdf(0);
    const yMax = Math.min(50, Math.max(.06, peak * 1.13));
    densityPlot = chart(densitySvg, { xMin: -5, xMax: 5, yMax, xTicks: [-5, -2.5, 0, 2.5, 5], yLabel: 'Density f(x)' });
    line(densityPlot, points, { color: palette.forest, width: 2.7, fill: true });
    const logMax = Math.max(0, Math.ceil(Math.log10(peak)));
    logPlot = chart(logSvg, { xMin: -5, xMax: 5, yMin: -7, yMax: logMax, xTicks: [-5, 0, 5], yTicks: [-7, -4, 0, ...(logMax > 0 ? [logMax] : [])], yLabel: 'log₁₀ f(x)' });
    line(logPlot, points.map(([x, p]) => [x, Math.log10(Math.max(p, 1e-100))]), { color: palette.copper, width: 2.5 });
    updateProbes();
    const tails = cachedShape.tails;
    $('#tail-probability').textContent = `${(tails * 100).toFixed(tails < .001 ? 3 : 2)}%`;
    $('#peak-value').textContent = Number.isFinite(peak) ? peak > 999 ? peak.toExponential(2) : fmt(peak, 3) : 'unbounded';
    $('#variance-value').textContent = explorerModel.finiteVariance ? explorerModel.variance > 999 ? explorerModel.variance.toExponential(2) : fmt(explorerModel.variance, 3) : 'not finite';
    let description;
    if (familyState.r < 0) description = `Power-law density tails decay like |x|^(${fmt(2 * familyState.eta + 2, 1)}). η controls this exponent. ${explorerModel.finiteMean ? 'The mean exists.' : 'The mean does not exist.'} ${explorerModel.finiteVariance ? 'The variance is finite.' : 'There is no finite variance.'}`;
    else description = `${familyState.r < .99 ? 'Slower-than-exponential tails' : familyState.r > 1.01 ? 'Faster-than-exponential tails' : 'Exponential-type tails'}. η adjusts the central shape; ϑ stretches all standard deviations by its square root. ${familyState.eta < 0 ? 'This example has a sharp central shape.' : 'This example has a more rounded center.'}`;
    if (Math.abs(familyState.r - 1) < 1e-8 && Math.abs(familyState.eta + .5) < 1e-8) description = `Laplace: an exact special case. Its scale is √(ϑ/2) = ${fmt(Math.sqrt(familyState.vartheta / 2))}. It puts more mass near zero and in its far tails than a variance-matched normal.`;
    if (peak > 50) description += ' The top of the density is clipped at 50 in this view.';
    $('#family-explanation').textContent = description;
    describe(densitySvg, `Numerical mixture density for r=${familyState.r}, eta=${familyState.eta}, variance scale=${familyState.vartheta.toFixed(3)}. Probability beyond magnitude 3 is ${(tails * 100).toFixed(2)} percent.`);
    if ([familyState.r, familyState.eta, familyState.vartheta].some((value, index) => Math.abs(value - previousParameters[index]) > 1e-12 * Math.max(1, Math.abs(value)))) onFamilyChange();
  }
  const schedule = coalesced(() => { $$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false')); render(); });
  [r, eta, scale].forEach(control => control.addEventListener('input', schedule));
  branch.addEventListener('change', () => {
    const negative = branch.value === 'negative'; branchRanges(negative);
    r.value = negative ? -1 : 1; eta.value = negative ? -2 : -.5; scale.value = Math.log10(negative ? .5 : 2);
    $$('[data-preset]').forEach(b => b.setAttribute('aria-pressed', 'false')); render();
  });
  const presets = { laplace: [1, -.5, 2], rounded: [1, 1, 1], sharp: [.55, -.65, .2], cauchy: [-1, -2, .5] };
  $$('[data-preset]').forEach(button => button.addEventListener('click', () => {
    const [rp, ep, vp] = presets[button.dataset.preset]; branch.value = rp < 0 ? 'negative' : 'positive'; branchRanges(rp < 0);
    r.value = rp; eta.value = ep; scale.value = Math.log10(vp); pressed('[data-preset]', button); render();
  }));
  watchChart('#family-density', render);
  render();
}

function fitLab() {
  let seed = 91021;
  let observations = [];
  let mode = 'normal';
  let fittedFamily = null;
  let task = 0;
  let dirty = false;
  let evaluator;
  const widthControl = $('#fit-width'), auto = $('#auto-fit'), comparison = $('#fit-comparison');
  const comparisonRows = ['normal', 'laplace', 'family'].map(() => {
    const row = document.createElement('div'); row.className = 'fit-result';
    const name = document.createElement('span'), number = document.createElement('strong');
    row.append(name, number); comparison.append(row);
    return { name, number };
  });
  bindHorizontalControl($('#fit-plot'), widthControl);
  function cancelSearch(message) {
    if (auto.disabled) { task++; auto.disabled = false; $('#fit-status').textContent = message; }
  }
  const moment = () => observations.reduce((sum, x) => sum + x * x, 0) / observations.length;
  function candidate(kind, factor = 10 ** Number(widthControl.value)) {
    const evaluation = evaluator.evaluate(kind, fittedFamily || familyState, factor);
    const scaleDescription = Math.abs(factor - 1) < 1e-8 ? 'variance-matched baseline' : `baseline width ×${factor.toFixed(2)}`;
    if (kind === 'normal') return { ...evaluation, name: 'One normal', description: scaleDescription };
    if (kind === 'laplace') return { ...evaluation, name: 'Laplace', description: scaleDescription };
    return { ...evaluation, name: fittedFamily ? 'Searched family' : 'Explorer model', description: fittedFamily ? '24 shape pairs' : 'current slider settings' };
  }
  function render() {
    if ($('#five').hidden) { dirty = true; return; }
    dirty = false;
    const candidates = Object.fromEntries(['normal', 'laplace', 'family'].map(kind => [kind, candidate(kind)]));
    const selected = candidates[mode];
    const gap = selected.gap;
    const range = evaluator.range;
    const plot = chart($('#fit-plot'), { xMin: -range, xMax: range, yMax: 1, xTicks: [-range, 0, range], yTicks: [0, .25, .5, .75, 1], yLabel: 'Share at or below x', xLabel: 'Coefficient value x' });
    line(plot, selected.curve, { color: palette.copper, width: 2.5 });
    line(plot, evaluator.empirical, { color: palette.forest, width: 2.1 });
    plotSegment(plot, { x1: plot.x(gap.x), x2: plot.x(gap.x), y1: plot.y(gap.empirical), y2: plot.y(gap.theoretical), stroke: '#954f35', 'stroke-width': 3, 'stroke-dasharray': '4 4' });
    [gap.empirical, gap.theoretical].forEach(value => plotCircle(plot, { cx: plot.x(gap.x), cy: plot.y(value), r: 4, fill: '#a9623e' }));
    plotLabel(plot, { x: clamp(plot.x(gap.x) + 12, plot.box.left, plot.box.right - 100), y: Math.max(plot.box.top + 15, plot.y(Math.max(gap.empirical, gap.theoretical)) - 12), style: 'fill:#9b5435;font-size:12px' }, `D = ${gap.d.toFixed(3)}`);
    $('#ks-value').textContent = gap.d.toFixed(3);
    $('#ks-sentence').textContent = `At x = ${fmt(gap.x)}, the largest difference is ${(gap.d * 100).toFixed(1)} percentage points of cumulative probability.`;
    $('#fit-width-value').textContent = `${(10 ** Number(widthControl.value)).toFixed(2)}×`;
    widthControl.setAttribute('aria-valuetext', `Candidate width ${(10 ** Number(widthControl.value)).toFixed(2)} times the baseline`);
    $('[data-fit="family"]').textContent = fittedFamily ? 'Search winner' : 'My explorer model';
    describe($('#fit-plot'), `${selected.name} CDF versus 240 synthetic observations. Largest step-aware KS gap ${gap.d.toFixed(4)} at x ${gap.x.toFixed(3)}.`);
    ['normal', 'laplace', 'family'].forEach((kind, index) => {
      const model = candidates[kind];
      setText(comparisonRows[index].name, `${model.name} · ${model.description}`);
      setText(comparisonRows[index].number, model.gap.d.toFixed(3));
    });
  }
  function newSample() {
    task++; auto.disabled = false;
    observations = mixture(.65, -.4, .45).samples(240, createRng(seed++));
    evaluator = createFitEvaluator(observations);
    fittedFamily = null; mode = 'normal'; widthControl.value = 0;
    $$('[data-fit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fit === mode)));
    $('#fit-status').textContent = 'New reproducible sample. The reference normal and Laplace widths match its second moment about zero.';
    render();
  }
  $$('[data-fit]').forEach(button => button.addEventListener('click', () => {
    cancelSearch('Search canceled: you chose a candidate.');
    mode = button.dataset.fit; pressed('[data-fit]', button); render();
  }));
  const renderWidth = coalesced(render);
  widthControl.addEventListener('input', () => { cancelSearch('Search canceled: you adjusted the width.'); renderWidth(); });
  $('#new-sample').addEventListener('click', newSample);
  onFamilyChange = () => {
    cancelSearch('Search canceled: the explorer model changed.');
    if (fittedFamily) $('#fit-status').textContent = 'The explorer changed. Its new model replaces the previous search winner in the comparison.';
    fittedFamily = null; render();
  };
  document.addEventListener('research:layout', () => {
    if ($('#five').hidden) cancelSearch('Search paused when you left this experiment. Run it again here.');
    else if (dirty) render();
  });
  auto.addEventListener('click', async () => {
    const thisTask = ++task; auto.disabled = true;
    const rGrid = [.35, .5, .7, 1, 1.5, 2.2], etaGrid = [-.65, -.25, .3, 1];
    let best = null, tested = 0;
    try {
      for (const r of rGrid) for (const eta of etaGrid) {
        if (thisTask !== task) return;
        const beta = (eta + 1.5) / r;
        const vartheta = moment() * Math.exp(logGamma(beta) - logGamma(beta + 1 / r));
        const model = mixture(r, eta, vartheta, { steps: 384 });
        const gap = ksGap(observations, model.cdf);
        if (!best || gap.d < best.d) best = { r, eta, vartheta, d: gap.d };
        $('#fit-status').textContent = `Testing actual candidates: ${++tested} / 24 shape pairs. Best gap so far ${best.d.toFixed(3)}.`;
        await new Promise(requestAnimationFrame);
      }
      if (thisTask !== task) return;
      fittedFamily = best; mode = 'family'; widthControl.value = 0;
      $$('[data-fit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.fit === mode)));
      $('#fit-status').textContent = `24 pairs tested. Best r=${fmt(best.r)}, η=${fmt(best.eta)}, ϑ=${best.vartheta.toPrecision(3)}. A coarse search, not a guaranteed global optimum.`;
      render();
    } finally { if (thisTask === task) auto.disabled = false; }
  });
  const sizeUpdate = () => {
    const n = Math.round(10 ** Number($('#sample-size').value));
    const cutoff = 1.358 / Math.sqrt(n);
    $('#sample-size-value').textContent = n.toLocaleString('en-US');
    $('#sample-size').setAttribute('aria-valuetext', `${n.toLocaleString('en-US')} independent observations`);
    $('#ks-cutoff').textContent = cutoff.toFixed(cutoff < .001 ? 5 : 3);
    $('#cutoff-outcome').textContent = .02 > cutoff ? 'Would reject this fixed model' : 'Would not reject this fixed model';
  };
  $('#sample-size').addEventListener('input', sizeUpdate); sizeUpdate(); newSample();
  watchChart('#fit-plot', render);
}

function failureLab() {
  let selected = 'skew';
  const descriptions = {
    skew: 'Unequal sides are the clue. The mixture family is symmetric about zero. A change of width cannot make one tail longer than the other.',
    bimodal: 'Two separated peaks are the clue. Every component peaks at zero; mixing their variances cannot create two modes at different locations.',
    spike: 'This example puts 55% of all probability exactly at zero. A continuous variance mixture cannot create an actual point mass. A very tall but continuous peak is different.'
  };
  function render() {
    const pdf = selected === 'skew' ? x => x >= -1 ? Math.exp(-x - 1) : 0 : selected === 'bimodal' ? x => .5 * normalPdf(x, -1.8, .5) + .5 * normalPdf(x, 1.8, .5) : x => .45 * normalPdf(x);
    const plot = chart($('#failure-plot'), { xMin: -4, xMax: 4, yMax: 1.1, xTicks: [-4, -2, 0, 2, 4], yLabel: selected === 'spike' ? 'Continuous-part density; atom shown separately' : 'Schematic probability density' });
    line(plot, sampleCurve(x => normalPdf(x), -4, 4), { color: palette.sage, width: 1.5, dash: '5 5' });
    line(plot, sampleCurve(pdf, -4, 4, 240), { color: palette.copper, width: 2.6, fill: true });
    if (selected === 'spike') {
      plotSegment(plot, { x1: plot.x(0), x2: plot.x(0), y1: plot.y(.05), y2: plot.y(.92), stroke: palette.copper, 'stroke-width': 3 });
      plotShape(plot, { d: `M${(plot.x(0) - 5).toFixed(1)},${(plot.y(.92) + 8).toFixed(1)}L${plot.x(0).toFixed(1)},${plot.y(.92).toFixed(1)}L${(plot.x(0) + 5).toFixed(1)},${(plot.y(.92) + 8).toFixed(1)}`, fill: 'none', stroke: palette.copper, 'stroke-width': 2 });
      plotLabel(plot, { x: plot.x(0) + 12, y: plot.y(.88), style: 'fill:#a05a38;font-size:10px' }, '55% probability atom at 0');
    }
    plotLabel(plot, { x: plot.box.left + 8, y: plot.box.top + 15, style: 'fill:#85936f;font-size:9px' }, 'Dashed: normal reference, not a fitted result');
    describe($('#failure-plot'), `${selected === 'skew' ? 'Asymmetric shifted exponential' : selected === 'bimodal' ? 'Two separated normal modes' : 'A 55 percent point mass at zero plus a continuous normal part'}. Constructed teaching example.`);
    $('#failure-answer').textContent = descriptions[selected];
  }
  $$('[data-failure]').forEach(button => button.addEventListener('click', () => { selected = button.dataset.failure; pressed('[data-failure]', button); render(); }));
  watchChart('#failure-plot', render);
  render();
}

function dependenceLab() {
  const rng = createRng(55903), xs = [], originalYs = [];
  for (let i = 0; i < 45; i++) {
    const x = sampleNormal(rng);
    xs.push(x, x, -x, -x); originalYs.push(x, -x, x, -x);
  }
  let shuffled = false, ys = [...originalYs], sliceX = null, currentPlot = null;
  const depSvg = $('#dependence-plot');
  const sliceRect = svgNode('rect', { fill: '#b8764f', opacity: '.12', display: 'none', 'pointer-events': 'none' });

  const correlation = () => {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let xy = 0, xx = 0, yy = 0;
    xs.forEach((x, i) => { const a = x - mx, b = ys[i] - my; xy += a * b; xx += a * a; yy += b * b; });
    return xy / Math.sqrt(xx * yy);
  };
  function render() {
    const range = Math.max(...xs.map(Math.abs)) * 1.13;
    const plot = currentPlot = chart(depSvg, { xMin: -range, xMax: range, yMin: -range, yMax: range, xTicks: [-range, 0, range], yTicks: [-range, 0, range], yLabel: 'Y', xLabel: 'X' });
    if (!sliceRect.parentNode) plot.layer.prepend(sliceRect);
    const band = 0.28;
    if (sliceX !== null) {
      const leftPx = plot.x(clamp(sliceX - band, -range, range)), rightPx = plot.x(clamp(sliceX + band, -range, range));
      setAttr(sliceRect, 'display', '');
      setAttr(sliceRect, 'x', leftPx); setAttr(sliceRect, 'y', plot.box.top);
      setAttr(sliceRect, 'width', Math.max(2, rightPx - leftPx)); setAttr(sliceRect, 'height', plot.box.bottom - plot.box.top);
    } else setAttr(sliceRect, 'display', 'none');

    let inSlice = 0;
    xs.forEach((x, i) => {
      const hit = sliceX !== null && Math.abs(x - sliceX) <= band;
      if (hit) inSlice++;
      plotCircle(plot, {
        cx: plot.x(x), cy: plot.y(ys[i]),
        r: sliceX === null ? 3 : hit ? 4.4 : 2.3,
        fill: hit ? '#a84726' : i % 2 ? palette.copper : palette.forest,
        'fill-opacity': sliceX === null ? .65 : hit ? .95 : .18
      });
    });
    $('#correlation').textContent = fmt(correlation(), 3);
    describe(depSvg, shuffled ? 'Same marginal samples with Y values shuffled. The diagonal magnitude relation is broken.' : 'Paired values obey absolute Y = absolute X, despite zero sample correlation. They are dependent.');
    if (sliceX !== null) {
      $('#dependence-answer').textContent = shuffled
        ? `Slice near X ≈ ${fmt(sliceX, 1)} (${inSlice} points): Y now spreads across values independently of |X|.`
        : `Slice near X ≈ ${fmt(sliceX, 1)} (${inSlice} points): every Y clusters tightly at ±${Math.abs(sliceX).toFixed(1)}—knowing X pins down |Y|.`;
    } else {
      $('#dependence-answer').textContent = shuffled
        ? 'The marginal samples are unchanged, while their matching magnitudes are gone. Zero correlation alone never told the whole story.'
        : 'The points lie on two diagonals. They are dependent even though their sample correlation is zero.';
    }
    $('#shuffle-pairs').firstChild.textContent = shuffled ? 'Restore hidden connections ' : 'Shuffle the connections ';
    $('#shuffle-pairs').setAttribute('aria-pressed', String(shuffled));
  }
  const scheduleSlice = coalesced(render);
  depSvg.addEventListener('pointermove', event => {
    if (!currentPlot || (event.pointerType === 'touch' && !event.buttons)) return;
    const bounds = depSvg.getBoundingClientRect();
    const vx = (event.clientX - bounds.left) / Math.max(1, bounds.width) * currentPlot.w;
    if (vx < currentPlot.box.left || vx > currentPlot.box.right) { if (sliceX !== null) { sliceX = null; scheduleSlice(); } return; }
    sliceX = currentPlot.xMin + (vx - currentPlot.box.left) / (currentPlot.box.right - currentPlot.box.left) * (currentPlot.xMax - currentPlot.xMin);
    scheduleSlice();
  }, { passive: true });
  depSvg.addEventListener('pointerleave', () => { if (document.activeElement !== depSvg && sliceX !== null) { sliceX = null; scheduleSlice(); } });
  depSvg.addEventListener('keydown', event => {
    if (!currentPlot || !['ArrowLeft', 'ArrowRight', 'Escape'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Escape') sliceX = null;
    else sliceX = clamp((sliceX ?? 1.0) + (event.key === 'ArrowLeft' ? -.2 : .2), currentPlot.xMin, currentPlot.xMax);
    scheduleSlice();
  });
  depSvg.addEventListener('blur', () => { if (sliceX !== null) { sliceX = null; scheduleSlice(); } });
  $('#shuffle-pairs').addEventListener('click', () => {
    shuffled = !shuffled; ys = [...originalYs];
    if (shuffled) for (let i = ys.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ys[i], ys[j]] = [ys[j], ys[i]]; }
    render();
  });
  watchChart('#dependence-plot', render);
  render();
}

initializeMotion();
const sublessons = new Set();
async function startSublesson(id) {
  if (sublessons.has(id)) return;
  sublessons.add(id);
  if (id === 'probability-intro') {
    const { initProbabilityLab } = await import('./probability-lab.mjs');
    initProbabilityLab();
  } else if (id === 'probability-mixture') mixtureLab();
}
document.addEventListener('research:sublesson', event => startSublesson(event.detail.id));
const chapterInitializers = {
  one: inverseLab,
  two: initImageLab,
  three: () => startSublesson('probability-intro'),
  four: familyLab,
  five: fitLab,
  six: initEvidence,
  seven: () => { failureLab(); dependenceLab(); },
  eight: async () => { const { initInferenceLab } = await import('./inference-lab.mjs'); initInferenceLab(); }
};
initJourney({
  initializeChapter: id => chapterInitializers[id]?.(),
  initializeSource: initEvidence,
  initializeIntro: () => initHeroArt({ motionEnabled: () => motion && document.body.dataset.view === 'intro' && !document.hidden }),
  motionEnabled: () => motion
});
