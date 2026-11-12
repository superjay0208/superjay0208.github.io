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
    actual: draws.reduce((sum, z) => sum + (z * sd <= x ? 1 : 0), 0), count: draws.length };
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
      <div class="probability-heading"><div><p class="probability-kicker">PROBABILITY DESK</p><h3 id="probability-title">An area, a chance.</h3></div></div>
      <div class="probability-presets" role="group" aria-label="Probability examples"><button type="button" data-probability-preset="half">Half the area</button><button type="button" data-probability-preset="width" aria-pressed="true">One standard deviation</button><button type="button" data-probability-preset="tall">Density above 1</button></div>
      <div class="probability-grid">
        <div class="probability-charts"><div class="probability-chart-heading"><span>01 / AREA UNDER THE BELL</span><span>Probability density</span></div><svg id="probability-density" viewBox="0 0 640 270" role="img" aria-label="Normal probability density with shaded area to the left of a movable marker"></svg><div class="probability-chart-heading probability-cdf-heading"><span>02 / THE SAME AREA, AS A RUNNING TOTAL</span><span>Cumulative distribution · CDF</span></div><svg id="probability-cdf" viewBox="0 0 640 172" role="img" aria-label="Cumulative probability up to the marker"></svg><p class="probability-axis-note">Value → · Curves extend beyond the frame. All percentages include the full tails.</p></div>
        <div class="probability-dashboard"><div class="probability-big-number"><span>AT OR BELOW YOUR MARKER</span><output id="probability-share"><span id="probability-share-number">84.1</span><span>%</span></output><p id="probability-meaning">About 84 in every 100 draws, on average.</p></div><div id="probability-dots" class="probability-dots" role="img" aria-label="Expected share out of 100"></div><div class="probability-dot-key"><span><i></i> At or below the marker</span><span id="probability-dot-mode">MODEL EXPECTATION</span></div><div class="probability-sample-actions"><button type="button" id="probability-draw">100 random draws ↗</button><button type="button" id="probability-expectation" hidden>Model expectation</button></div><p class="probability-status" id="probability-sample-status" role="status">A model gives probabilities. A sample can vary.</p></div>
      </div>
      <div class="probability-controls"><div><label for="probability-marker">Marker x <output id="probability-marker-value">1.00</output></label><input id="probability-marker" type="range" min="-3" max="3" step="0.01" value="1"><div class="probability-range-ends"><span>More negative</span><span>More positive</span></div></div><div><label for="probability-width">Bell width σ <output id="probability-width-value">1.00</output></label><input id="probability-width" type="range" min="0.25" max="1.5" step="0.01" value="1"><div class="probability-range-ends"><span>Concentrated</span><span>Spread out</span></div></div></div>
      <div class="probability-insight"><span aria-hidden="true">↳</span><p id="probability-insight">The CDF turns the shaded area into a height between 0% and 100%.</p><div><span>DENSITY AT x</span><output id="probability-height">0.24</output></div><div><span>PEAK DENSITY</span><output id="probability-peak">0.40</output></div></div>
      <details class="probability-details"><summary>Why area, not height? <span aria-hidden="true">+</span></summary><div><p>A <strong>density</strong> describes how tightly probability is packed near a value. Its height has units of “per unit of x.” Probability is an <strong>area</strong>, so a narrow, tall curve can still have a total area of 1.</p><p>For a continuous model, the probability of one exact value is zero. An interval has width, and therefore can contain probability. The <strong>CDF</strong> adds all the area from the far left up to x: <span class="probability-equation">F(x) = P(X ≤ x) = ∫<sub>−∞</sub><sup>x</sup> f(t) dt.</span></p><p>Here the bell is a normal distribution centered at zero. Its standard deviation σ sets its width; its variance is σ². A marker one standard deviation right of zero always contains about 84.1% to its left, even if you squeeze the bell. The density plot rescales its vertical axis as the width changes; the CDF axis stays fixed.</p><p>Dots in “model expectation” show a proportion, not generated observations. “Random draws” uses 100 reproducible normal samples; changing σ rescales those same draws. This is a teaching model, not data from the paper.</p><a href="https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm" target="_blank" rel="noopener noreferrer">Normal density and cumulative distribution · NIST ↗</a></div></details>
    </section>`;

  const $ = selector => mount.querySelector(selector);
  const density=$('#probability-density'), cumulative=$('#probability-cdf');
  const marker=$('#probability-marker'), width=$('#probability-width'), dots=$('#probability-dots');
  const controls=[...mount.querySelectorAll('[data-probability-preset]')];
  const outputs=Object.fromEntries(['share-number','meaning','marker-value','width-value','height','peak','insight','dot-mode','sample-status','draw','expectation'].map(id=>[id,$(`#probability-${id}`)]));
  // Keep the number as a text node so the percent sign can retain its smaller size.
  const shareNumber=document.createTextNode('84.1');
  outputs['share-number'].replaceWith(shareNumber);
  let seed=251217038, draws=probabilityDraws(seed), sampleMode=false, pending=0;
  let activePointer=null, dragStart=null, lastSd=null, densityYmax=1;
  let revision=0, previousRevision=-1, previousX=null, announced=false;
  let densitySegments=[];
  const left=54,right=620,xmin=-4,xmax=4,steps=240;
  const toX=value=>left+(value-xmin)/(xmax-xmin)*(right-left);
  const densityY=value=>231-value/densityYmax*211;
  const cdfY=value=>132-value*120;
  const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  const attr=(element,name,value)=>{const string=String(value);if(element.getAttribute(name)!==string)element.setAttribute(name,string);};

  function axes(svg,bottom,top,format) {
    const title=node('title',{},svg.getAttribute('aria-label'));svg.append(title);
    const labels=[];
    [0,.5,1].forEach(fraction=>{
      const y=bottom-fraction*(bottom-top);
      svg.append(node('line',{x1:left,x2:right,y1:y,y2:y,class:'probability-grid-line'}));
      const label=node('text',{x:left-12,y:y+4,'text-anchor':'end',class:'probability-tick'},format(fraction));
      labels.push(label);svg.append(label);
    });
    for(const tick of [-4,-2,0,2,4])svg.append(node('text',{x:toX(tick),y:bottom+22,'text-anchor':'middle',class:'probability-tick'},`${tick}`.replace('-','−')));
    svg.append(node('line',{x1:toX(0),x2:toX(0),y1:top,y2:bottom,class:'probability-zero-line'}));
    return {labels,title};
  }
  const densityAxes=axes(density,231,20,x=>x.toFixed(2));
  const cumulativeAxes=axes(cumulative,132,12,x=>`${Math.round(x*100)}%`);
  const area=node('path',{class:'probability-area'}),pdfLine=node('path',{class:'probability-density-line'});
  const cdfLine=node('path',{class:'probability-cdf-line'}),areaGuide=node('line',{x1:left,class:'probability-area-guide'});
  density.append(area,pdfLine,node('text',{x:left,y:13,class:'probability-tick probability-axis-title'},'Density · vertical axis adapts'));
  cumulative.append(cdfLine,areaGuide);
  const markerNodes=[[density,20,231],[cumulative,12,132]].map(([svg,top,bottom])=>{
    const line=node('line',{y1:top,y2:bottom,class:'probability-marker-line'}),dot=node('circle',{r:6,class:'probability-marker-dot'});
    svg.append(line,dot);return {line,dot};
  });
  const rugNodes=Array.from({length:100},()=>{const line=node('line',{y1:233,y2:239,class:'probability-rug',visibility:'hidden'});density.append(line);return line;});
  const dotNodes=Array.from({length:100},()=>{const dot=document.createElement('i');dots.append(dot);return dot;});

  function rebuildCurves(sd,peak) {
    densityYmax=Math.ceil(peak*1.16*10)/10;
    densityAxes.labels.forEach((label,i)=>text(label,(i/2*densityYmax).toFixed(2)));
    densitySegments=[];const cdfSegments=[];
    for(let i=0;i<=steps;i++){
      const x=xmin+(xmax-xmin)*i/steps;
      densitySegments.push(`${i?'L':'M'}${toX(x).toFixed(2)},${densityY(normalPdf(x,0,sd)).toFixed(2)}`);
      cdfSegments.push(`${i?'L':'M'}${toX(x).toFixed(2)},${cdfY(normalCdf(x,0,sd)).toFixed(2)}`);
    }
    attr(pdfLine,'d',densitySegments.join(' '));attr(cdfLine,'d',cdfSegments.join(' '));
    lastSd=sd;
  }
  function render() {
    if(pending)cancelAnimationFrame(pending);pending=0;
    const x=Number(marker.value),sd=Number(width.value);
    if(x===previousX&&sd===lastSd&&revision===previousRevision)return;
    const state=probabilitySnapshot(x,sd,draws),share=state.share*100;
    if(sd!==lastSd)rebuildCurves(sd,state.peak);
    const px=toX(x),end=Math.floor((x-xmin)/(xmax-xmin)*steps);
    attr(area,'d',`${densitySegments.slice(0,end+1).join(' ')} L${px.toFixed(2)},${densityY(state.density).toFixed(2)} L${px.toFixed(2)},231 L${left},231Z`);
    markerNodes.forEach(({line,dot},i)=>{attr(line,'x1',px);attr(line,'x2',px);attr(dot,'cx',px);attr(dot,'cy',i?cdfY(state.share):densityY(state.density));});
    attr(areaGuide,'x2',px);attr(areaGuide,'y1',cdfY(state.share));attr(areaGuide,'y2',cdfY(state.share));
    const densityLabel=`Normal density with width ${signed(sd)}. The area up to ${signed(x)} is ${share.toFixed(1)} percent. Density height at the marker is ${state.density.toFixed(3)}.`;
    const cumulativeLabel=`Cumulative distribution: ${share.toFixed(1)} percent of the model is at or below ${signed(x)}.`;
    attr(density,'aria-label',densityLabel);attr(cumulative,'aria-label',cumulativeLabel);
    text(densityAxes.title,densityLabel);text(cumulativeAxes.title,cumulativeLabel);
    if(shareNumber.nodeValue!==share.toFixed(1))shareNumber.nodeValue=share.toFixed(1);
    text(outputs.meaning,`About ${Math.round(state.expected)} in every 100 draws, on average.`);
    text(outputs['marker-value'],signed(x));text(outputs['width-value'],signed(sd));
    attr(marker,'aria-valuetext',`${signed(x)}; ${share.toFixed(1)} percent at or below`);
    attr(width,'aria-valuetext',`Standard deviation ${signed(sd)}`);
    text(outputs.height,state.density.toFixed(3));text(outputs.peak,state.peak.toFixed(3));
    text(outputs.insight,state.peak>1?`The peak is ${state.peak.toFixed(2)}, above 1. That is a density height. The total probability is still 100%.`:Math.abs(x)<.015?'Half the area sits on each side of zero. Changing the width cannot move that halfway point.':'The CDF turns the shaded area into a height between 0% and 100%.');
    dotNodes.forEach((dot,i)=>{
      const value=draws[i]*sd, fraction=sampleMode?(value<=x?1:0):clamp(state.expected-i,0,1);
      const percent=`${fraction*100}%`;if(dot.style.getPropertyValue('--dot-share')!==percent)dot.style.setProperty('--dot-share',percent);
      const rug=rugNodes[i];attr(rug,'visibility',sampleMode&&value>=xmin&&value<=xmax?'visible':'hidden');
      if(sampleMode){attr(rug,'x1',toX(value));attr(rug,'x2',toX(value));attr(rug,'class',value<=x?'probability-rug below':'probability-rug');}
    });
    attr(dots,'aria-label',sampleMode?`${state.actual} of these 100 random draws are at or below the marker. The model expects ${state.expected.toFixed(1)} on average.`:`${state.expected.toFixed(1)} of 100 expected dots are shaded. This is a probability illustration, not a sample.`);
    text(outputs['dot-mode'],sampleMode?'ONE RANDOM SAMPLE':'MODEL EXPECTATION');
    text(outputs['sample-status'],sampleMode?`This draw: ${state.actual} of 100. Model expectation: ${state.expected.toFixed(1)}.`:'A model gives probabilities. A sample can vary.');
    outputs.expectation.hidden=!sampleMode;text(outputs.draw,sampleMode?'Another 100 ↻':'100 random draws ↗');
    controls.forEach(button=>{const preset=button.dataset.probabilityPreset;attr(button,'aria-pressed',preset==='half'&&x===0&&sd===1||preset==='width'&&x===1&&sd===1||preset==='tall'&&x===.25&&sd===.25);});
    previousX=x;previousRevision=revision;
  }
  function schedule(){if(!pending)pending=requestAnimationFrame(render);}
  function interacted(){if(!announced){announced=true;mount.dispatchEvent(new CustomEvent('research:interaction',{bubbles:true,detail:{lab:'probability'}}));}}
  [marker,width].forEach(input=>input.addEventListener('input',()=>{schedule();interacted();}));
  controls.forEach(button=>button.addEventListener('click',()=>{
    const preset=button.dataset.probabilityPreset;marker.value=preset==='half'?'0':preset==='tall'?'.25':'1';width.value=preset==='tall'?'.25':'1';render();interacted();
  }));
  outputs.draw.addEventListener('click',()=>{draws=probabilityDraws(++seed);sampleMode=true;revision++;render();interacted();});
  outputs.expectation.addEventListener('click',()=>{sampleMode=false;revision++;render();interacted();});
  function pointToMarker(event,svg){const rect=svg.getBoundingClientRect(),plotted=(event.clientX-rect.left)/rect.width*640;marker.value=String(clamp(xmin+(plotted-left)/(right-left)*(xmax-xmin),-3,3));schedule();}
  for(const svg of [density,cumulative]){
    svg.addEventListener('pointerdown',event=>{
      if(event.button!==0)return;
      dragStart={id:event.pointerId,x:event.clientX,y:event.clientY};
      if(event.pointerType!=='touch'){activePointer=event.pointerId;svg.setPointerCapture(event.pointerId);pointToMarker(event,svg);interacted();}
    });
    svg.addEventListener('pointermove',event=>{
      if(dragStart?.id===event.pointerId&&activePointer===null){
        const dx=Math.abs(event.clientX-dragStart.x),dy=Math.abs(event.clientY-dragStart.y);
        if(dx>8&&dx>dy*1.2){activePointer=event.pointerId;svg.setPointerCapture(event.pointerId);interacted();}
      }
      if(activePointer===event.pointerId)pointToMarker(event,svg);
      else if(event.pointerType==='mouse'&&!event.buttons&&document.activeElement!==marker&&document.activeElement!==width){pointToMarker(event,svg);interacted();}
    });
    svg.addEventListener('pointerup',event=>{
      if(dragStart?.id===event.pointerId&&activePointer===null&&Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)<8){pointToMarker(event,svg);interacted();}
      activePointer=null;dragStart=null;
    });
    svg.addEventListener('pointercancel',()=>{activePointer=null;dragStart=null;});
    svg.addEventListener('lostpointercapture',()=>{activePointer=null;dragStart=null;});
  }
  render();
}
