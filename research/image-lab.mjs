import { createRng, haar2D, inverseHaar2D } from './math.mjs';

const SIZE = 64;
const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS = {
  ivory: [233, 234, 211],
  forest: [40, 65, 47],
  copper: [179, 100, 66],
  dark: [32, 53, 44],
  ink: '#425b37',
  muted: '#7e8e6d',
  line: '#abb999'
};
const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const blend = (a, b, amount) => a.map((channel, index) => Math.round(channel + (b[index] - channel) * amount));
const cssColor = channels => `rgb(${channels.join(',')})`;
const smooth = amount => { const t = clamp(amount); return t * t * (3 - 2 * t); };
const sceneNames = { fields:'field patterns', buildings:'rooftops', texture:'busy texture' };

/** Deterministic normalized-intensity teaching images, not empirical study data. */
export function generateTeachingImage(scene = 'fields', size = SIZE) {
  if (!sceneNames[scene] || !Number.isInteger(size) || size < 2) throw new RangeError('Unknown teaching image or invalid size.');
  const rng = createRng({fields:7381,buildings:2917,texture:15038}[scene]);
  const image = new Float64Array(size * size);
  const fieldLevels = [0.37,0.69,0.49,0.79,0.57,0.31,0.64,0.43,0.73,0.53,0.82,0.46,0.62,0.4,0.76,0.55];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const xx = x * SIZE / size;
      const yy = y * SIZE / size;
      let value;
      if (scene === 'fields') {
        const fieldX = Math.floor(xx / 16);
        const fieldY = Math.floor(yy / 16);
        value = fieldLevels[fieldY * 4 + fieldX] + 0.014 * Math.sin((xx + yy * 0.16) * Math.PI);
        const river = 37 + 4 * Math.sin(yy / 14);
        if (Math.abs(xx - river) < 2.3) value = 0.21;
        if (Math.abs(xx - 0.52 * yy - 5) < 1.3) value = 0.91;
        if (Math.abs(yy - 47) < 1.1 && xx < 35) value = 0.86;
      } else if (scene === 'buildings') {
        const blockX = Math.floor(xx / 16);
        const blockY = Math.floor(yy / 16);
        const localX = xx % 16;
        const localY = yy % 16;
        value = 0.36;
        if (localX < 2 || localY < 2) value = 0.2;
        if (localX >= 5 && localX <= 14 && localY >= 5 && localY <= 14) value = 0.28;
        if (localX >= 3 && localX <= 12 && localY >= 3 && localY <= 12) {
          value = 0.63 + 0.1 * ((blockX + 2 * blockY) % 3);
          if (localX > 7) value -= 0.1;
          if (localY > 7) value -= 0.035;
        }
        if (localX >= 6 && localX <= 8 && localY >= 5 && localY <= 7) value = 0.4;
      } else {
        value = 0.5 + 0.14 * Math.sin(xx * 1.8 + yy * 0.7) + 0.12 * Math.cos(yy * 1.65 - xx * 0.6) + 0.38 * (rng() - 0.5);
      }
      image[y * size + x] = clamp(value);
    }
  }
  return image;
}

/** Retain DC plus the strongest requested fraction of all original details. */
export function retainHaarDetails(transform, percent) {
  const count = transform.coefficients.length - 1;
  const keep = Math.max(0,Math.min(count,Math.round(count * clamp(percent,0,100) / 100)));
  const ordered = Array.from({length:count},(_,index)=>index+1)
    .sort((a,b)=>Math.abs(transform.coefficients[b])-Math.abs(transform.coefficients[a]) || a-b);
  const coefficients = new Float64Array(transform.coefficients.length);
  coefficients[0] = transform.coefficients[0];
  for (let i = 0; i < keep; i++) coefficients[ordered[i]] = transform.coefficients[ordered[i]];
  return { ...transform, coefficients, retained:keep };
}

function intensityColor(value) {
  return blend(COLORS.forest,COLORS.ivory,clamp(value));
}

function coefficientColor(value, maximum) {
  const strength = Math.log1p(Math.abs(value) * 18) / Math.log1p(Math.max(maximum,1e-12) * 18);
  return blend(COLORS.ivory,value < 0 ? COLORS.copper : COLORS.forest,clamp(strength));
}

function renderGrid(canvas, values, colorFor) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const temporary = document.createElement('canvas');
  temporary.width = SIZE;
  temporary.height = SIZE;
  const temporaryContext = temporary.getContext('2d');
  if (!temporaryContext) return;
  const pixels = temporaryContext.createImageData(SIZE,SIZE);
  values.forEach((value,index)=>{
    const rgb = colorFor(value);
    pixels.data[index*4] = rgb[0];
    pixels.data[index*4+1] = rgb[1];
    pixels.data[index*4+2] = rgb[2];
    pixels.data[index*4+3] = 255;
  });
  temporaryContext.putImageData(pixels,0,0);
  context.imageSmoothingEnabled = false;
  context.clearRect(0,0,canvas.width,canvas.height);
  context.drawImage(temporary,0,0,canvas.width,canvas.height);
}

function histogram(values, { bins = 36, minimum, maximum } = {}) {
  if (minimum === undefined || maximum === undefined) {
    const magnitude = Math.max(1e-8,...Array.from(values,Math.abs));
    minimum = -magnitude * 1.001;
    maximum = magnitude * 1.001;
  }
  const counts = new Uint32Array(bins);
  const assignments = new Uint16Array(values.length);
  values.forEach((value,index)=>{
    const bin = Math.max(0,Math.min(bins-1,Math.floor((value-minimum)/(maximum-minimum)*bins)));
    assignments[index] = bin;
    counts[bin]++;
  });
  return { counts, assignments, minimum, maximum, bins, length:values.length };
}

function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NS,tag);
  Object.entries(attributes).forEach(([key,value])=>element.setAttribute(key,String(value)));
  if (text !== null) element.textContent = text;
  return element;
}

function drawHistogram(svg, values, mode, scene) {
  const data = histogram(values,mode === 'pixels' ? { minimum:0,maximum:1 } : {});
  const width = 520;
  const height = 230;
  const bounds = { left:54,right:501,top:29,bottom:189 };
  const plotWidth = bounds.right-bounds.left;
  const plotHeight = bounds.bottom-bounds.top;
  const maximumShare = Math.max(...data.counts)/values.length;
  const step = maximumShare > .45 ? .2 : maximumShare > .2 ? .1 : maximumShare > .08 ? .05 : .025;
  const maximumY = Math.max(step,Math.ceil(maximumShare/step)*step);
  const xPosition = value=>bounds.left+(value-data.minimum)/(data.maximum-data.minimum)*plotWidth;
  const yPosition = value=>bounds.bottom-value/maximumY*plotHeight;
  svg.replaceChildren();
  const representation = mode === 'pixels' ? 'normalized pixel intensities' : 'original, unthresholded Haar detail coefficients';
  svg.setAttribute('aria-label',`Histogram of ${values.length.toLocaleString('en-US')} ${representation} for generated ${sceneNames[scene]}. Horizontal axis: ${mode === 'pixels' ? 'intensity from zero to one' : 'signed Haar coefficient value'}. Vertical axis: percentage of values per bin. The retention slider does not change this histogram.`);
  svg.append(svgElement('title',{},`${sceneNames[scene]}: ${representation}`));
  svg.append(svgElement('desc',{},`All values are counted in ${data.bins} equal-width bins. ${mode === 'haar' ? 'The single DC average coefficient is excluded; all 4,095 original details are included, across all scales.' : 'All 4,096 generated normalized image intensities are included.'} These are teaching data, not observations from the paper.`));
  svg.append(svgElement('text',{x:bounds.left,y:14,fill:COLORS.muted,'font-family':'Inter, Arial, sans-serif','font-size':11},'SHARE OF VALUES (%)'));
  const tickCount = Math.round(maximumY/step);
  for (let index = 0; index <= tickCount; index++) {
    const value = index*step;
    const y = yPosition(value);
    svg.append(svgElement('line',{x1:bounds.left,x2:bounds.right,y1:y,y2:y,stroke:COLORS.line,'stroke-width':.6,'stroke-opacity':.45}));
    svg.append(svgElement('text',{x:bounds.left-9,y:y+4,fill:COLORS.muted,'font-family':'Inter, Arial, sans-serif','font-size':11,'text-anchor':'end'},`${Math.round(value*100)}%`));
  }
  const barWidth = plotWidth/data.bins;
  data.counts.forEach((count,index)=>{
    const share = count/values.length;
    const center = data.minimum+(index+.5)/data.bins*(data.maximum-data.minimum);
    const rect = svgElement('rect',{x:bounds.left+index*barWidth+.5,y:yPosition(share),width:Math.max(.5,barWidth-1),height:bounds.bottom-yPosition(share),fill:mode === 'haar' && center < 0 ? '#b67a57' : '#4e6c44',opacity:.85,rx:1});
    rect.append(svgElement('title',{},`${count.toLocaleString('en-US')} values (${(share*100).toFixed(2)}%) in bin ${index+1}`));
    svg.append(rect);
  });
  svg.append(svgElement('line',{x1:bounds.left,x2:bounds.right,y1:bounds.bottom,y2:bounds.bottom,stroke:COLORS.line,'stroke-width':1}));
  for (let index = 0; index <= 4; index++) {
    const value = data.minimum+index/4*(data.maximum-data.minimum);
    const x = xPosition(value);
    const shown = Math.abs(value)<1e-8 ? '0' : mode === 'pixels' ? value.toFixed(2) : value.toFixed(Math.abs(value)<1 ? 2 : 1);
    svg.append(svgElement('line',{x1:x,x2:x,y1:bounds.bottom,y2:bounds.bottom+4,stroke:COLORS.line,'stroke-width':1}));
    svg.append(svgElement('text',{x,y:bounds.bottom+20,fill:COLORS.muted,'font-family':'Inter, Arial, sans-serif','font-size':11,'text-anchor':'middle'},shown.replace('-','−')));
  }
  if (mode === 'haar') svg.append(svgElement('line',{x1:xPosition(0),x2:xPosition(0),y1:bounds.top,y2:bounds.bottom,stroke:'#bf9673','stroke-width':.8,'stroke-dasharray':'3 4'}));
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
}

/** Initialize chapter 02. Returns a function removing its event listeners. */
export function initImageLab() {
  const originalCanvas = document.getElementById('original-image');
  const coefficientCanvas = document.getElementById('coeff-image');
  const reconstructedCanvas = document.getElementById('reconstructed-image');
  const keepInput = document.getElementById('keep');
  const histogramSvg = document.getElementById('image-hist');
  if (!originalCanvas || !coefficientCanvas || !reconstructedCanvas || !keepInput || !histogramSvg) return () => {};
  const lab = originalCanvas.closest('.image-lab');
  const sceneButtons = [...lab.querySelectorAll('[data-scene]')];
  const histogramButtons = [...lab.querySelectorAll('[data-hist]')];
  const listeners = [];
  const bind = (element,event,listener) => { element.addEventListener(event,listener); listeners.push(()=>element.removeEventListener(event,listener)); };
  let scene = sceneButtons.find(button=>button.getAttribute('aria-pressed')==='true')?.dataset.scene || 'fields';
  let mode = histogramButtons.find(button=>button.getAttribute('aria-pressed')==='true')?.dataset.hist || 'haar';
  let original;
  let transform;

  function renderReconstruction() {
    const percent = clamp(Number(keepInput.value),1,100);
    const retained = retainHaarDetails(transform,percent);
    const reconstructed = inverseHaar2D(retained);
    const error = Math.sqrt(original.reduce((sum,value,index)=>sum+(value-reconstructed[index])**2,0)/original.length);
    document.getElementById('keep-value').textContent = `${percent}%`;
    document.getElementById('retained-count').textContent = retained.retained.toLocaleString('en-US');
    document.getElementById('image-rmse').textContent = error < .00005 ? '0.0000' : error.toFixed(4);
    keepInput.setAttribute('aria-valuetext',`${percent} percent: ${retained.retained.toLocaleString('en-US')} of 4,095 detail coefficients, plus the DC average.`);
    renderGrid(reconstructedCanvas,reconstructed,intensityColor);
    reconstructedCanvas.setAttribute('aria-label',`Generated ${sceneNames[scene]} reconstructed from ${retained.retained.toLocaleString('en-US')} of 4,095 strongest Haar details plus the original DC average. Root mean squared error ${error.toFixed(4)} in normalized intensity units. Display colors are clipped to the zero-to-one range; the error uses unclipped values.`);
  }

  function renderHistogram() {
    const values = mode === 'pixels' ? original : transform.coefficients.slice(1);
    drawHistogram(histogramSvg,values,mode,scene);
    document.getElementById('hist-axis').textContent = mode === 'pixels' ? 'Normalized pixel intensity (0 dark → 1 light)' : 'Signed Haar detail value (original normalized-intensity units)';
    document.getElementById('hist-explanation').textContent = mode === 'pixels'
      ? 'These 4,096 values describe brightness, before changing the representation. The image is generated; its normalized intensities range from 0 to 1.'
      : 'These are all 4,095 original Haar details, before discarding any. Near zero means little contrast; larger signed values encode stronger changes. The single DC average is omitted.';
    histogramButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.hist===mode)));
  }

  function changeScene() {
    original = generateTeachingImage(scene);
    transform = haar2D(original,SIZE);
    const maximum = Math.max(...transform.coefficients.slice(1).map(Math.abs),1e-8);
    renderGrid(originalCanvas,original,intensityColor);
    renderGrid(coefficientCanvas,transform.coefficients,value=>coefficientColor(value,maximum));
    originalCanvas.setAttribute('aria-label',`Original 64 by 64 generated ${sceneNames[scene]} teaching image. Normalized intensities are displayed from dark forest to light ivory.`);
    coefficientCanvas.setAttribute('aria-label',`All 4,096 original orthonormal Haar coefficients of generated ${sceneNames[scene]}. Copper indicates negative, ivory near zero, and forest positive, with logarithmic color contrast. The upper-left DC coefficient records the average.`);
    coefficientCanvas.title = 'Original signed coefficients: copper negative · ivory zero · forest positive. Logarithmic color contrast; DC at top left.';
    sceneButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scene===scene)));
    renderReconstruction();
    renderHistogram();
  }
  bind(keepInput,'input',renderReconstruction);
  sceneButtons.forEach(button=>bind(button,'click',()=>{ scene=button.dataset.scene; changeScene(); }));
  histogramButtons.forEach(button=>bind(button,'click',()=>{ mode=button.dataset.hist; renderHistogram(); }));
  changeScene();
  return () => listeners.forEach(remove=>remove());
}

/**
 * Finite, user-started image → coefficient → histogram illustration.
 * The first transition crossfades representations, not a false one-to-one
 * pixel/coefficient correspondence. The second moves each actual Haar detail
 * into its true histogram bin; the single DC value is explicitly excluded.
 */
export function initHeroArt({ motionEnabled = () => !matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  const canvas = document.getElementById('hero-canvas');
  const slider = document.getElementById('hero-morph');
  const play = document.getElementById('hero-play');
  const state = document.getElementById('hero-state');
  if (!canvas || !slider || !play || !state) return () => {};
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const width = canvas.width;
  const height = canvas.height;
  const original = generateTeachingImage('fields');
  const transform = haar2D(original,SIZE);
  const details = transform.coefficients.slice(1);
  const detailMaximum = Math.max(...details.map(Math.abs),1e-8);
  const distribution = histogram(details,{bins:40});
  const gridSize = Math.min(width*.62,height*.76);
  const gridLeft = (width-gridSize)/2;
  const gridTop = 48;
  const cell = gridSize/SIZE;
  const baseline = height-75;
  const plotLeft = 54;
  const plotRight = width-40;
  const binWidth = (plotRight-plotLeft)/distribution.bins;
  const columns = Math.max(1,Math.floor((binWidth-2)/2));
  const largestBin = Math.max(...distribution.counts);
  const rows = Math.ceil(largestBin/columns);
  const rowHeight = Math.min(2,(baseline-75)/rows);
  const counters = new Uint32Array(distribution.bins);
  const targetList = Array.from(details,(_,index)=>{
    const bin = distribution.assignments[index];
    return {bin,index};
  });
  targetList.forEach(target=>{
    const position = counters[target.bin]++;
    target.x = plotLeft+target.bin*binWidth+2+(position%columns)*2;
    target.y = baseline-(Math.floor(position/columns)+1)*rowHeight;
  });
  let frame = 0;
  let run = 0;

  function draw(progress) {
    const amount = clamp(progress);
    const crossfade = smooth(amount*2);
    const moving = smooth((amount-.5)*2);
    context.clearRect(0,0,width,height);
    context.save();
    context.font = '12px Inter, Arial, sans-serif';
    context.letterSpacing = '1px';
    context.fillStyle = '#aab99a';
    const stateName = amount<.25 ? 'Pixels' : amount<.75 ? 'Coefficients' : 'Distribution';
    state.textContent = stateName;
    slider.setAttribute('aria-valuetext',`${stateName}: ${Math.round(amount*100)} percent through the representation transformation.`);
    context.textAlign = 'left';
    context.fillText('01 / PIXELS',36,25);
    context.textAlign = 'center';
    context.fillText('02 / COEFFICIENTS',width/2,25);
    context.textAlign = 'right';
    context.fillText('03 / DISTRIBUTION',width-36,25);
    context.fillStyle = '#c9a27c';
    const activeX = stateName==='Pixels' ? 36 : stateName==='Coefficients' ? width/2-73 : width-181;
    context.fillRect(activeX,32,Math.min(125,width*.17),1);

    if (moving>0) {
      context.globalAlpha = moving;
      context.strokeStyle = '#95a78577';
      context.lineWidth = 1;
      context.beginPath();context.moveTo(plotLeft,baseline+4);context.lineTo(plotRight,baseline+4);context.stroke();
      context.font = '12px Inter, Arial, sans-serif';
      context.fillStyle = '#b3c1a1';
      for (let tick=0;tick<=4;tick++) {
        const value = distribution.minimum+(distribution.maximum-distribution.minimum)*tick/4;
        const xx = plotLeft+(plotRight-plotLeft)*tick/4;
        context.textAlign = 'center';
        context.fillText((Math.abs(value)<1e-8?'0':value.toFixed(1)).replace('-','−'),xx,baseline+23);
      }
      context.fillStyle = '#a1b18f';
      context.font = '11px Inter, Arial, sans-serif';
      context.fillText('SIGNED HAAR DETAIL VALUE',(plotLeft+plotRight)/2,baseline+42);
    }
    context.globalAlpha = 1;
    for (let index=0;index<original.length;index++) {
      const value = transform.coefficients[index];
      const fromColor = intensityColor(original[index]);
      const toColor = coefficientColor(value,detailMaximum);
      const color = blend(fromColor,toColor,crossfade);
      if (index===0) context.globalAlpha = 1-moving;
      const startX = gridLeft+(index%SIZE)*cell;
      const startY = gridTop+Math.floor(index/SIZE)*cell;
      const target = index ? targetList[index-1] : {x:startX,y:startY};
      const xx = startX+(target.x-startX)*moving;
      const yy = startY+(target.y-startY)*moving;
      context.fillStyle = cssColor(color);
      const dotWidth = cell*.94+(1.7-cell*.94)*moving;
      const dotHeight = cell*.94+(Math.max(.6,rowHeight*.86)-cell*.94)*moving;
      context.fillRect(xx,yy,dotWidth,dotHeight);
      context.globalAlpha = 1;
    }
    context.textAlign = 'center';
    context.font = '12px Inter, Arial, sans-serif';
    context.fillStyle = '#adbd9c';
    const caption = amount<.25 ? '64 × 64 GENERATED INTENSITIES' : amount<.75 ? 'ORTHONORMAL HAAR · AVERAGES + DIFFERENCES' : '4,095 DETAILS · ONE POINT PER COEFFICIENT · DC OMITTED';
    context.fillText(caption,width/2,height-13);
    context.restore();
    canvas.setAttribute('aria-label',`${stateName} representation of a generated 64 by 64 field-pattern teaching image. ${amount<.5 ? 'The picture crossfades into its actual orthonormal Haar transform; this is a change of representation, not a one-to-one pixel-to-coefficient mapping.' : 'Each of the 4,095 actual original Haar detail coefficients moves into its equal-width histogram bin. The DC average coefficient is omitted.'}`);
  }

  function cancel() {
    run++;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    play.textContent = '▶';
    play.setAttribute('aria-label','Play the image-to-distribution transformation');
    play.setAttribute('aria-pressed','false');
  }
  function onSlider() { cancel(); draw(Number(slider.value)); }
  function onPlay() {
    if (frame) { cancel(); return; }
    if (!motionEnabled()) { cancel(); slider.value='1'; draw(1); return; }
    const from = Number(slider.value)>=.99 ? 0 : Number(slider.value);
    slider.value=String(from);
    const started = performance.now();
    const duration = 4300*(1-from);
    const activeRun = ++run;
    play.textContent = 'Ⅱ';
    play.setAttribute('aria-label','Pause the image-to-distribution transformation');
    play.setAttribute('aria-pressed','true');
    function tick(time) {
      if (activeRun!==run) return;
      if (!motionEnabled()) { cancel(); slider.value='1'; draw(1); return; }
      const fraction = clamp((time-started)/Math.max(duration,1));
      const progress = from+(1-from)*fraction;
      slider.value=progress.toFixed(2);
      draw(Number(slider.value));
      if (fraction<1) frame=requestAnimationFrame(tick);
      else cancel();
    }
    frame=requestAnimationFrame(tick);
  }
  slider.addEventListener('input',onSlider);
  play.addEventListener('click',onPlay);
  play.setAttribute('aria-pressed','false');
  draw(Number(slider.value));
  return () => { cancel(); slider.removeEventListener('input',onSlider); play.removeEventListener('click',onPlay); };
}
