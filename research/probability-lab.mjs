import { normalCdf, normalPdf, createRng, sampleNormal } from './math.mjs';

/** One fixed set of standard-normal draws is rescaled when the width changes. */
export function probabilityDraws(seed = 251217038, count = 100) {
  const rng = createRng(seed);
  return Float64Array.from({ length: count }, () => sampleNormal(rng));
}

/** All reported areas use the full normal CDF, including tails outside the plot. */
export function probabilitySnapshot(x, sd, draws = []) {
  if (!Number.isFinite(x) || !Number.isFinite(sd) || sd <= 0) throw new RangeError('A finite marker and positive finite width are required.');
  const share = normalCdf(x, 0, sd);
  return { x, sd, share, density: normalPdf(x, 0, sd), peak: normalPdf(0, 0, sd), expected: share * 100,
    actual: Array.from(draws).reduce((sum, z) => sum + (z * sd <= x ? 1 : 0), 0), count: draws.length };
}

const ns = 'http://www.w3.org/2000/svg';
const signed = value => (Math.abs(value) < .00001 ? '0.00' : value.toFixed(2)).replace('-', '−');
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
function node(tag, attrs = {}, content) {
  const el = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  if (content !== undefined) el.textContent = content;
  return el;
}

export function initProbabilityLab() {
  const mount = document.getElementById('probability-lab-mount');
  if (!mount || mount.dataset.initialized) return;
  mount.dataset.initialized = 'true';
  mount.innerHTML = `
    <section class="probability-lab" aria-labelledby="probability-title">
      <div class="probability-heading"><div><p class="probability-kicker">PROBABILITY DESK</p><h3 id="probability-title">Read the area.</h3></div></div>
      <div class="probability-presets" role="group" aria-label="Probability examples"><button type="button" data-probability-preset="half">Split it in half</button><button type="button" data-probability-preset="width" aria-pressed="true">One width to the right</button><button type="button" data-probability-preset="tall">Can a height exceed 1?</button></div>
      <div class="probability-grid">
        <div class="probability-charts"><div class="probability-chart-heading"><span>01 / AREA UNDER THE BELL</span><span>Drag the marker ↔</span></div><svg id="probability-density" viewBox="0 0 640 270" role="img" aria-label="Normal probability density with shaded area to the left of a movable marker"></svg><div class="probability-chart-heading probability-cdf-heading"><span>02 / THE SAME AREA, AS A RUNNING TOTAL</span><span>Cumulative distribution · CDF</span></div><svg id="probability-cdf" viewBox="0 0 640 172" role="img" aria-label="Cumulative probability up to the marker"></svg><p class="probability-axis-note">Value → · Curves extend beyond the frame. All percentages include the full tails.</p></div>
        <div class="probability-dashboard"><div class="probability-big-number"><span>AT OR BELOW YOUR MARKER</span><output id="probability-share">84.1<span>%</span></output><p id="probability-meaning">About 84 in every 100 draws, on average.</p></div><div id="probability-dots" class="probability-dots" role="img" aria-label="Expected share out of 100"></div><div class="probability-dot-key"><span><i></i> At or below the marker</span><span id="probability-dot-mode">MODEL EXPECTATION</span></div><div class="probability-sample-actions"><button type="button" id="probability-draw">Try 100 random draws ↗</button><button type="button" id="probability-expectation" hidden>Show the expectation</button></div><p class="probability-status" id="probability-sample-status" role="status">A model gives probabilities. A sample can vary.</p></div>
      </div>
      <div class="probability-controls"><div><label for="probability-marker">Marker x <output id="probability-marker-value">1.00</output></label><input id="probability-marker" type="range" min="-3" max="3" step="0.01" value="1"><div class="probability-range-ends"><span>More negative</span><span>More positive</span></div></div><div><label for="probability-width">Bell width σ <output id="probability-width-value">1.00</output></label><input id="probability-width" type="range" min="0.25" max="1.5" step="0.01" value="1"><div class="probability-range-ends"><span>Concentrated</span><span>Spread out</span></div></div></div>
      <div class="probability-insight"><span aria-hidden="true">↳</span><p id="probability-insight">The CDF turns the shaded area into a height between 0% and 100%.</p><div><span>DENSITY AT x</span><output id="probability-height">0.24</output></div><div><span>PEAK DENSITY</span><output id="probability-peak">0.40</output></div></div>
      <details class="probability-details"><summary>Why area, not height? <span aria-hidden="true">+</span></summary><div><p>A <strong>density</strong> describes how tightly probability is packed near a value. Its height has units of “per unit of x.” Probability is an <strong>area</strong>, so a narrow, tall curve can still have a total area of 1.</p><p>For a continuous model, the probability of one exact value is zero. An interval has width, and therefore can contain probability. The <strong>CDF</strong> adds all the area from the far left up to x: <span class="probability-equation">F(x) = P(X ≤ x) = ∫<sub>−∞</sub><sup>x</sup> f(t) dt.</span></p><p>Here the bell is a normal distribution centered at zero. Its standard deviation σ sets its width; its variance is σ². A marker one standard deviation right of zero always contains about 84.1% to its left, even if you squeeze the bell. The density plot rescales its vertical axis as the width changes; the CDF axis stays fixed.</p><p>Dots in “model expectation” show a proportion, not generated observations. “Random draws” uses 100 reproducible normal samples; changing σ rescales those same draws. This is a teaching model, not data from the paper.</p><a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm" target="_blank" rel="noopener noreferrer">Normal density and cumulative distribution · NIST ↗</a></div></details>
    </section>`;

  const $ = selector => mount.querySelector(selector);
  const density = $('#probability-density');
  const cumulative = $('#probability-cdf');
  const marker = $('#probability-marker');
  const width = $('#probability-width');
  const dots = $('#probability-dots');
  const controls = [...mount.querySelectorAll('[data-probability-preset]')];
  let seed = 251217038;
  let draws = probabilityDraws(seed);
  let sampleMode = false;
  let pending = false;
  let activePointer = null;
  const left = 54, right = 620, xmin = -4, xmax = 4;
  const toX = value => left + (value - xmin) / (xmax - xmin) * (right - left);

  function axes(svg, bottom, top, ymax, ticks, label) {
    const y = value => bottom - value / ymax * (bottom - top);
    svg.replaceChildren();
    svg.append(node('title', {}, svg.getAttribute('aria-label')));
    for (const tick of ticks) {
      svg.append(node('line', { x1: left, x2: right, y1: y(tick), y2: y(tick), class: 'probability-grid-line' }));
      svg.append(node('text', { x: left - 12, y: y(tick) + 4, 'text-anchor': 'end', class: 'probability-tick' }, label(tick)));
    }
    for (const tick of [-4,-2,0,2,4]) {
      svg.append(node('text', { x: toX(tick), y: bottom + 22, 'text-anchor': 'middle', class: 'probability-tick' }, `${tick}`.replace('-', '−')));
    }
    svg.append(node('line', { x1:toX(0), x2:toX(0), y1:top, y2:bottom, class:'probability-zero-line' }));
    return y;
  }

  function curvePath(fn, toY, from = xmin, until = xmax, steps = 240) {
    return Array.from({ length: steps + 1 }, (_, i) => {
      const x = from + (until - from) * i / steps;
      return `${i ? 'L' : 'M'}${toX(x).toFixed(2)},${toY(fn(x)).toFixed(2)}`;
    }).join(' ');
  }

  function render() {
    pending = false;
    const state = probabilitySnapshot(Number(marker.value), Number(width.value), draws);
    const share = state.share * 100;
    const yMax = Math.ceil(state.peak * 1.16 * 10) / 10;
    const densityY = axes(density, 231, 20, yMax, [0, yMax / 2, yMax], value => value.toFixed(2));
    const cdfY = axes(cumulative, 132, 12, 1, [0,.5,1], value => `${Math.round(value * 100)}%`);
    const pdf = x => normalPdf(x, 0, state.sd);
    const cdf = x => normalCdf(x, 0, state.sd);
    const shaded = curvePath(pdf, densityY, xmin, state.x) + ` L${toX(state.x)},231 L${left},231Z`;
    density.append(node('path', { d:shaded, class:'probability-area' }));
    density.append(node('path', { d:curvePath(pdf, densityY), class:'probability-density-line' }));
    density.append(node('text', { x:left, y:13, class:'probability-tick probability-axis-title' }, 'Density · vertical axis adapts'));
    cumulative.append(node('path', { d:curvePath(cdf,cdfY), class:'probability-cdf-line' }));
    cumulative.append(node('line', { x1:left,x2:toX(state.x),y1:cdfY(state.share),y2:cdfY(state.share),class:'probability-area-guide' }));
    for (const [svg, top, bottom, dotY] of [[density,20,231,densityY(state.density)],[cumulative,12,132,cdfY(state.share)]]) {
      svg.append(node('line', { x1:toX(state.x), x2:toX(state.x), y1:top,y2:bottom,class:'probability-marker-line' }));
      svg.append(node('circle', { cx:toX(state.x),cy:dotY,r:6,class:'probability-marker-dot' }));
    }
    if (sampleMode) {
      for (const z of draws) {
        const value = z * state.sd;
        if (value < xmin || value > xmax) continue;
        density.append(node('line',{x1:toX(value),x2:toX(value),y1:233,y2:239,class:value<=state.x?'probability-rug below':'probability-rug'}));
      }
    }
    density.setAttribute('aria-label', `Normal density with width ${signed(state.sd)}. The area up to ${signed(state.x)} is ${share.toFixed(1)} percent. Density height at the marker is ${state.density.toFixed(3)}.`);
    cumulative.setAttribute('aria-label', `Cumulative distribution: ${share.toFixed(1)} percent of the model is at or below ${signed(state.x)}.`);
    $('#probability-share').innerHTML = `${share.toFixed(1)}<span>%</span>`;
    $('#probability-meaning').textContent = `About ${Math.round(state.expected)} in every 100 draws, on average.`;
    $('#probability-marker-value').textContent = signed(state.x);
    $('#probability-width-value').textContent = signed(state.sd);
    marker.setAttribute('aria-valuetext', `${signed(state.x)}; ${share.toFixed(1)} percent at or below`);
    width.setAttribute('aria-valuetext', `Standard deviation ${signed(state.sd)}`);
    $('#probability-height').textContent = state.density.toFixed(3);
    $('#probability-peak').textContent = state.peak.toFixed(3);
    $('#probability-insight').textContent = state.peak > 1
      ? `The peak is ${state.peak.toFixed(2)}, above 1. That is a density height. The total probability is still 100%.`
      : Math.abs(state.x) < .015
        ? 'Half the area sits on each side of zero. Changing the width cannot move that halfway point.'
        : 'The CDF turns the shaded area into a height between 0% and 100%.';
    const fragment = document.createDocumentFragment();
    for (let i=0;i<100;i++) {
      const dot = document.createElement('i');
      const fraction = sampleMode ? (draws[i] * state.sd <= state.x ? 1 : 0) : clamp(state.expected-i,0,1);
      dot.style.setProperty('--dot-share', `${fraction * 100}%`);
      fragment.append(dot);
    }
    dots.replaceChildren(fragment);
    dots.setAttribute('aria-label', sampleMode
      ? `${state.actual} of these 100 random draws are at or below the marker. The model expects ${state.expected.toFixed(1)} on average.`
      : `${state.expected.toFixed(1)} of 100 expected dots are shaded. This is a probability illustration, not a sample.`);
    $('#probability-dot-mode').textContent = sampleMode ? 'ONE RANDOM SAMPLE' : 'MODEL EXPECTATION';
    const status = sampleMode
      ? `This draw: ${state.actual} of 100. Model expectation: ${state.expected.toFixed(1)}. Try another draw.`
      : 'A model gives probabilities. A sample can vary.';
    if ($('#probability-sample-status').textContent !== status) $('#probability-sample-status').textContent = status;
    $('#probability-expectation').hidden = !sampleMode;
    $('#probability-draw').textContent = sampleMode ? 'Draw 100 again ↻' : 'Try 100 random draws ↗';
    controls.forEach(button=>{
      const preset=button.dataset.probabilityPreset;
      const on=preset==='half'&&state.x===0&&state.sd===1 || preset==='width'&&state.x===1&&state.sd===1 || preset==='tall'&&state.x===.25&&state.sd===.25;
      button.setAttribute('aria-pressed',String(on));
    });
  }
  function schedule() {
    if (!pending) { pending = true; requestAnimationFrame(render); }
  }
  function interacted() {
    mount.dispatchEvent(new CustomEvent('research:interaction', { bubbles:true, detail:{lab:'probability'} }));
  }
  [marker,width].forEach(input => input.addEventListener('input',()=>{ schedule();interacted(); }));
  controls.forEach(button=>button.addEventListener('click',()=>{
    const preset=button.dataset.probabilityPreset;
    marker.value=preset==='half'?'0':preset==='tall'?'.25':'1';
    width.value=preset==='tall'?'.25':'1';
    render();interacted();
  }));
  $('#probability-draw').addEventListener('click',()=>{
    draws=probabilityDraws(++seed);sampleMode=true;render();interacted();
  });
  $('#probability-expectation').addEventListener('click',()=>{ sampleMode=false;render();interacted(); });
  function pointToMarker(event,svg) {
    const rect=svg.getBoundingClientRect();
    const plotted=(event.clientX-rect.left)/rect.width*640;
    marker.value=String(clamp(xmin+(plotted-left)/(right-left)*(xmax-xmin),-3,3));
    schedule();
  }
  for (const svg of [density,cumulative]) {
    svg.addEventListener('pointerdown',event=>{
      if (event.button!==0) return;
      activePointer=event.pointerId;svg.setPointerCapture(event.pointerId);pointToMarker(event,svg);interacted();
    });
    svg.addEventListener('pointermove',event=>{if(activePointer===event.pointerId)pointToMarker(event,svg);});
    svg.addEventListener('pointerup',event=>{if(activePointer===event.pointerId)activePointer=null;});
    svg.addEventListener('pointercancel',()=>{activePointer=null;});
  }
  render();
}
