import { mixture, normalPdf, normalCdf, createRng, sampleNormal, logGamma, ksGap } from './math.mjs';
import { initImageLab, initHeroArt } from './image-lab.mjs';
import { initEvidence } from './evidence-ui.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));
const fmt = (value, places = 2) => Number(value).toFixed(places).replace('-', '−');
const ns = 'http://www.w3.org/2000/svg';
const palette = { forest:'#3e6042', copper:'#b96d49', cream:'#e6edcc', grid:'#99a878', sage:'#8d9c73' };
let plotSerial = 0;
let motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
try { const preference = localStorage.getItem('zw-motion'); if (preference) motion = preference === 'on'; } catch { /* Optional storage only. */ }

function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function describe(svg, text) {
  svg.setAttribute('aria-label',text);
  const title=svg.querySelector('title');
  if(title)title.textContent=text;
}

function chart(svg, { xMin=-4, xMax=4, yMin=0, yMax=1, xTicks, yTicks, xLabel='Coefficient value', yLabel='Density', dark=false } = {}) {
  const [,,w,h] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
  const textScale = Math.min(2.2, Math.max(1, w / Math.max(1,svg.getBoundingClientRect().width)));
  const box = { left:49+Math.max(0,textScale-1)*9, right:w-18, top:24+Math.max(0,textScale-1)*7, bottom:h-43-Math.max(0,textScale-1)*8 };
  const x = value => box.left + (value-xMin)/(xMax-xMin)*(box.right-box.left);
  const y = value => box.bottom - (value-yMin)/(yMax-yMin)*(box.bottom-box.top);
  svg.replaceChildren();
  svg.append(svgNode('title', {}, svg.getAttribute('aria-label')));
  const clipId = `plot-clip-${++plotSerial}`;
  const defs = svgNode('defs');
  const clip = svgNode('clipPath', {id:clipId});
  clip.append(svgNode('rect', {x:box.left,y:box.top,width:box.right-box.left,height:box.bottom-box.top}));
  defs.append(clip); svg.append(defs);
  const grid = dark ? '#9eaf7938' : '#9eaf7940';
  const labelColor = dark ? '#9db78a' : '#788b62';
  const yt = yTicks || [yMin,(yMin+yMax)/2,yMax];
  yt.forEach(value => {
    svg.append(svgNode('line',{x1:box.left,y1:y(value),x2:box.right,y2:y(value),stroke:grid,'stroke-width':1}));
    svg.append(svgNode('text',{x:box.left-9,y:y(value)+4,'text-anchor':'end',style:`fill:${labelColor};font-size:${10*textScale}px`},Math.abs(value)<0.00001?'0':Math.abs(value)>=10?fmt(value,0):fmt(value,1)));
  });
  const xt = xTicks || [xMin,(xMin+xMax)/2,xMax];
  xt.forEach(value => {
    svg.append(svgNode('line',{x1:x(value),y1:box.bottom,x2:x(value),y2:box.bottom+4,stroke:grid}));
    svg.append(svgNode('text',{x:x(value),y:box.bottom+20+Math.max(0,textScale-1)*3,'text-anchor':'middle',style:`fill:${labelColor};font-size:${10*textScale}px`},Math.abs(value)<1e-8?'0':fmt(value,1)));
  });
  if (xMin<0 && xMax>0) svg.append(svgNode('line',{x1:x(0),y1:box.top,x2:x(0),y2:box.bottom,stroke:grid,'stroke-dasharray':'3 5'}));
  svg.append(svgNode('text',{x:box.left,y:14+Math.max(0,textScale-1)*3,style:`fill:${labelColor};font-size:${9*textScale}px`},yLabel));
  svg.append(svgNode('text',{x:(box.left+box.right)/2,y:h-5,'text-anchor':'middle',style:`fill:${labelColor};font-size:${9*textScale}px`},xLabel));
  const layer = svgNode('g',{'clip-path':`url(#${clipId})`}); svg.append(layer);
  return {svg,layer,x,y,box,w,h,xMin,xMax,yMin,yMax};
}

function line(plot, points, {color=palette.forest,width=2.4,dash,opacity=1,fill=false} = {}) {
  const valid = points.filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
  if (!valid.length) return;
  let path = valid.map(([x,y],index) => `${index?'L':'M'}${plot.x(x).toFixed(2)},${plot.y(y).toFixed(2)}`).join(' ');
  if (fill) path += ` L${plot.x(valid.at(-1)[0])},${plot.y(plot.yMin)} L${plot.x(valid[0][0])},${plot.y(plot.yMin)}Z`;
  plot.layer.append(svgNode('path',{d:path,fill:fill?color:'none','fill-opacity':fill?.09:1,stroke:color,'stroke-width':width,'stroke-linejoin':'round','stroke-linecap':'round',opacity,...(dash?{'stroke-dasharray':dash}:{})}));
}
function sampleCurve(fn,min,max,n=220) { return Array.from({length:n+1},(_,i)=>{const x=min+(max-min)*i/n;return [x,fn(x)];}); }
function pressed(selector, selected) { $$(selector).forEach(button=>button.setAttribute('aria-pressed', String(button===selected))); }
function coalesced(fn) { let pending=false;return ()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;fn();});}}; }

function initializeMotion() {
  const button = $('#motion');
  const update = () => {
    document.documentElement.classList.toggle('motion-paused',!motion);
    button.setAttribute('aria-pressed',String(!motion));
    button.textContent = motion ? 'Pause motion' : 'Enable motion';
    button.hidden = false;
  };
  button.addEventListener('click',()=>{
    motion=!motion;
    try {localStorage.setItem('zw-motion',motion?'on':'off');} catch { /* Optional preference. */ }
    update();
  });
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{
    let hasPreference=false;
    try {hasPreference=!!localStorage.getItem('zw-motion');} catch { /* Use OS setting. */ }
    if(!hasPreference){motion=!event.matches;update();}
  });
  update();
}

function inverseLab() {
  const control = $('#detail');
  const update = () => {
    const d=Number(control.value), left=.5+d, right=.5-d;
    $('#pixel-left').style.backgroundColor=`rgb(${Math.round(left*255)} ${Math.round(left*255)} ${Math.round(left*255)})`;
    $('#pixel-right').style.backgroundColor=`rgb(${Math.round(right*255)} ${Math.round(right*255)} ${Math.round(right*255)})`;
    $('#pixel-left-value').textContent=fmt(left);
    $('#pixel-right-value').textContent=fmt(right);
    $('#measurement').textContent=fmt((left+right)/2);
    $('#detail-value').textContent=fmt(d);
    $('#haar-detail').textContent=fmt((left-right)/Math.SQRT2,3);
    $('.two-pixels').setAttribute('aria-label',`Pixel brightnesses ${left.toFixed(2)} and ${right.toFixed(2)}. Their average stays 0.50.`);
    $$('[data-detail]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.detail)===d)));
  };
  control.addEventListener('input',update);
  $$('[data-detail]').forEach(button=>button.addEventListener('click',()=>{control.value=button.dataset.detail;update();}));
  update();
}

function mixtureLab() {
  const rng=createRng(38768);
  let variances=[];
  let rainFrame=0;
  let draws=[];
  const rain=$('#sample-rain'), ctx=rain.getContext('2d');
  function drawRain(progress=1) {
    if(!ctx)return;
    const {width:w,height:h}=rain;
    ctx.clearRect(0,0,w,h);
    ctx.strokeStyle='#a3b17a25';
    ctx.beginPath();ctx.moveTo(w/2,0);ctx.lineTo(w/2,h-18);ctx.stroke();
    const bins=Array(50).fill(0);
    draws.forEach((value,index)=>{
      const bounded=clamp(value,-4,4);
      const bin=clamp(Math.floor((bounded+4)/8*50),0,49);
      const row=bins[bin]++;
      const x=38+(bounded+4)/8*(w-56);
      const targetY=h-25-row*6;
      const local=clamp((progress-index/draws.length*.22)/.78,0,1);
      const ease=1-Math.pow(1-local,3);
      const y=-15-index%9*9+(targetY+15+index%9*9)*ease;
      ctx.fillStyle=value < -4 || value > 4?'#d3aa78':'#becd9f';
      ctx.beginPath();ctx.arc(x,y,2.0,0,Math.PI*2);ctx.fill();
    });
    ctx.fillStyle='#93aa7f';ctx.font='9px Arial';
    ctx.fillText('−4',35,h-4);ctx.fillText('0',w/2-4,h-4);ctx.fillText('4',w-22,h-4);
    if(!draws.length)ctx.fillText('Release draws to see where individual values land.',40,70);
  }
  const update=()=>{
    cancelAnimationFrame(rainFrame);
    draws=[];drawRain();
    const count=Number($('#bells').value),variety=Number($('#width-variety').value);
    $('#bells-value').textContent=count;
    $('#width-variety-value').textContent=fmt(variety,1);
    variances=Array.from({length:count},(_,i)=>Math.exp(variety*Math.log(-Math.log(1-(i+.5)/count)*1.3)));
    const pdf=x=>variances.reduce((sum,v)=>sum+normalPdf(x,0,Math.sqrt(v))/count,0);
    const maxPeak=Math.min(4.7,Math.max(...variances.map(v=>normalPdf(0,0,Math.sqrt(v))))*1.1);
    const plot=chart($('#mixture-plot'),{xMin:-4,xMax:4,yMax:maxPeak,xTicks:[-4,-2,0,2,4],yLabel:'Probability density',dark:true});
    variances.forEach((v,index)=>line(plot,sampleCurve(x=>normalPdf(x,0,Math.sqrt(v)),-4,4,160),{color:palette.copper,width:1,opacity:.22+index/count*.25}));
    line(plot,sampleCurve(pdf,-4,4,300),{color:palette.cream,width:3.2});
    describe($('#mixture-plot'),`${count} zero-centered normal bells. Width variety ${variety.toFixed(2)}. The thick line is their equal-weight density mixture.`);
    $('#draw-summary').textContent=variety===0?'All variances are 1, so every component and the mixture are the same normal.':`${count} normal components, all centered at zero. At full variety the variance choices approximate exponential mixing.`;
  };
  $('#bells').addEventListener('input',coalesced(update));
  $('#width-variety').addEventListener('input',coalesced(update));
  $('#release-samples').addEventListener('click',()=>{
    cancelAnimationFrame(rainFrame);
    draws=Array.from({length:120},()=>sampleNormal(rng)*Math.sqrt(variances[Math.floor(rng()*variances.length)]));
    const outside=draws.filter(x=>Math.abs(x)>4).length;
    $('#draw-summary').textContent=`120 draws: each first chooses a variance, then a normal value. ${outside} outside the displayed [−4, 4] window are pinned to its edges.`;
    rain.setAttribute('aria-label',`120 values sampled from the finite normal mixture. ${outside} outside the visible range.`);
    const start=performance.now();
    const animate=time=>{
      const progress=motion?Math.min(1,(time-start)/1500):1;
      drawRain(progress);
      if(progress<1)rainFrame=requestAnimationFrame(animate);
    };
    rainFrame=requestAnimationFrame(animate);
  });
  $$('[data-bells-answer]').forEach(button=>button.addEventListener('click',()=>{
    pressed('[data-bells-answer]',button);
    $('#bells-answer').textContent=button.dataset.bellsAnswer==='no'?'Exactly. Every component is symmetric and decreases as you move away from zero. A positive weighted average keeps those properties. Mixing different means would be a different model.':'The shared center is the key. All these bells peak at zero and decline on either side; their weighted mixture does too. General mixtures with different means can have multiple peaks.';
  }));
  update();
}

const familyState={r:1,eta:-.5,vartheta:2};
let explorerModel;
let onFamilyChange=()=>{};
function familyLab() {
  const branch=$('#tail-branch'),r=$('#r-control'),eta=$('#eta-control'),scale=$('#scale-control');
  function branchRanges(negative) {
    r.min=negative?'-2':'0.35';r.max=negative?'-.4':'2.5';r.step='0.05';
    eta.min=negative?'-5':'-.75';eta.max=negative?'-1.7':'3';eta.step='0.05';
    $('#r-label').textContent=negative?'Mixing exponent r':'Tail character r';
    $('#eta-label').textContent=negative?'Power-tail shape η':'Peak character η';
  }
  function render() {
    familyState.r=Number(r.value);familyState.eta=Number(eta.value);familyState.vartheta=10**Number(scale.value);
    explorerModel=mixture(familyState.r,familyState.eta,familyState.vartheta);
    $('#r-value').textContent=fmt(familyState.r);
    $('#eta-value').textContent=fmt(familyState.eta);
    $('#scale-value').textContent=fmt(familyState.vartheta);
    scale.setAttribute('aria-valuetext',`Variance scale ${familyState.vartheta.toPrecision(4)}`);
    $('#beta-value').textContent=fmt(explorerModel.beta);
    const points=Array.from({length:401},(_,i)=>{
      const t=(i-200)/200;const x=Math.sign(t)*5*t*t;
      return [x,explorerModel.pdf(x)];
    });
    const peak=explorerModel.pdf(0);
    const yMax=Math.min(50,Math.max(.06,peak*1.13));
    const density=chart($('#family-density'),{xMin:-5,xMax:5,yMax,xTicks:[-5,-2.5,0,2.5,5],yLabel:'Density f(x)'});
    line(density,points,{color:palette.forest,width:2.7,fill:true});
    const logMax=Math.max(0,Math.ceil(Math.log10(peak)));
    const logarithmic=chart($('#family-log'),{xMin:-5,xMax:5,yMin:-7,yMax:logMax,xTicks:[-5,0,5],yTicks:[-7,-4,0,...(logMax>0?[logMax]:[])],yLabel:'log₁₀ f(x)'});
    line(logarithmic,points.map(([x,p])=>[x,Math.log10(Math.max(p,1e-100))]),{color:palette.copper,width:2.5});
    const tails=Math.max(0,2*(1-explorerModel.cdf(3)));
    $('#tail-probability').textContent=`${(tails*100).toFixed(tails<.001?3:2)}%`;
    $('#peak-value').textContent=Number.isFinite(peak)?peak>999?peak.toExponential(2):fmt(peak,3):'unbounded';
    $('#variance-value').textContent=explorerModel.finiteVariance?explorerModel.variance>999?explorerModel.variance.toExponential(2):fmt(explorerModel.variance,3):'not finite';
    let description;
    if(familyState.r<0)description=`Power-law density tails decay like |x|^(${fmt(2*familyState.eta+2,1)}). η controls this exponent. ${explorerModel.finiteMean?'The mean exists.':'The mean does not exist.'} ${explorerModel.finiteVariance?'The variance is finite.':'There is no finite variance.'}`;
    else description=`${familyState.r<.99?'Slower-than-exponential tails':familyState.r>1.01?'Faster-than-exponential tails':'Exponential-type tails'}. η adjusts the central shape; ϑ stretches all standard deviations by its square root. ${familyState.eta<0?'This example has a sharp central shape.':'This example has a more rounded center.'}`;
    if(Math.abs(familyState.r-1)<1e-8&&Math.abs(familyState.eta+.5)<1e-8)description=`Laplace: an exact special case. Its scale is √(ϑ/2) = ${fmt(Math.sqrt(familyState.vartheta/2))}. It puts more mass near zero and in its far tails than a variance-matched normal.`;
    if(peak>50)description+=' The top of the density is clipped at 50 in this view.';
    $('#family-explanation').textContent=description;
    describe($('#family-density'),`Numerical mixture density for r=${familyState.r}, eta=${familyState.eta}, variance scale=${familyState.vartheta.toFixed(3)}. Probability beyond magnitude 3 is ${(tails*100).toFixed(2)} percent.`);
    onFamilyChange();
  }
  const schedule=coalesced(()=>{ $$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));render(); });
  [r,eta,scale].forEach(control=>control.addEventListener('input',schedule));
  branch.addEventListener('change',()=>{
    const negative=branch.value==='negative';branchRanges(negative);
    r.value=negative?-1:1;eta.value=negative?-2:-.5;scale.value=Math.log10(negative?.5:2);
    $$('[data-preset]').forEach(b=>b.setAttribute('aria-pressed','false'));render();
  });
  const presets={laplace:[1,-.5,2],rounded:[1,1,1],sharp:[.55,-.65,.2],cauchy:[-1,-2,.5]};
  $$('[data-preset]').forEach(button=>button.addEventListener('click',()=>{
    const [rp,ep,vp]=presets[button.dataset.preset];branch.value=rp<0?'negative':'positive';branchRanges(rp<0);
    r.value=rp;eta.value=ep;scale.value=Math.log10(vp);pressed('[data-preset]',button);render();
  }));
  render();
}

function fitLab() {
  let seed=91021;
  let observations=[];
  let mode='normal';
  let fittedFamily=null;
  let task=0;
  const widthControl=$('#fit-width'),auto=$('#auto-fit');
  function cancelSearch(message) {
    if(auto.disabled){task++;auto.disabled=false;$('#fit-status').textContent=message;}
  }
  const moment=()=>observations.reduce((sum,x)=>sum+x*x,0)/observations.length;
  function candidate(kind, factor=10**Number(widthControl.value)) {
    const sd=Math.sqrt(moment())*factor;
    const scaleDescription=Math.abs(factor-1)<1e-8?'variance-matched baseline':`baseline width ×${factor.toFixed(2)}`;
    if(kind==='normal')return {cdf:x=>normalCdf(x,0,sd),name:'One normal',description:scaleDescription};
    if(kind==='laplace'){
      const b=sd/Math.SQRT2;
      return {cdf:x=>x<0?.5*Math.exp(x/b):1-.5*Math.exp(-x/b),name:'Laplace',description:scaleDescription};
    }
    const params=fittedFamily||familyState;
    const distribution=mixture(params.r,params.eta,params.vartheta*factor*factor,{steps:512});
    return {cdf:distribution.cdf,name:fittedFamily?'Searched family':'Explorer model',description:fittedFamily?'24 shape pairs':'current slider settings'};
  }
  function render() {
    const candidates=Object.fromEntries(['normal','laplace','family'].map(kind=>[kind,candidate(kind)]));
    const selected=candidates[mode];
    const gap=ksGap(observations,selected.cdf);
    const range=Math.max(3,...observations.map(x=>Math.abs(x)))*1.08;
    const plot=chart($('#fit-plot'),{xMin:-range,xMax:range,yMax:1,xTicks:[-range,0,range],yTicks:[0,.25,.5,.75,1],yLabel:'Share at or below x',xLabel:'Coefficient value x'});
    line(plot,sampleCurve(selected.cdf,-range,range,240),{color:palette.copper,width:2.5});
    const sorted=[...observations].sort((a,b)=>a-b);
    const steps=[[-range,0]];
    sorted.forEach((x,index)=>{steps.push([x,index/sorted.length],[x,(index+1)/sorted.length]);});steps.push([range,1]);
    line(plot,steps,{color:palette.forest,width:2.1});
    plot.layer.append(svgNode('line',{x1:plot.x(gap.x),x2:plot.x(gap.x),y1:plot.y(gap.empirical),y2:plot.y(gap.theoretical),stroke:'#954f35','stroke-width':3,'stroke-dasharray':'4 4'}));
    [gap.empirical,gap.theoretical].forEach(value=>plot.layer.append(svgNode('circle',{cx:plot.x(gap.x),cy:plot.y(value),r:4,fill:'#a9623e'})));
    plot.svg.append(svgNode('text',{x:clamp(plot.x(gap.x)+12,plot.box.left,plot.box.right-100),y:Math.max(plot.box.top+15,plot.y(Math.max(gap.empirical,gap.theoretical))-12),style:'fill:#9b5435;font-size:12px'},`D = ${gap.d.toFixed(3)}`));
    $('#ks-value').textContent=gap.d.toFixed(3);
    $('#ks-sentence').textContent=`At x = ${fmt(gap.x)}, the largest difference is ${(gap.d*100).toFixed(1)} percentage points of cumulative probability.`;
    $('#fit-width-value').textContent=`${(10**Number(widthControl.value)).toFixed(2)}×`;
    widthControl.setAttribute('aria-valuetext',`Candidate width ${(10**Number(widthControl.value)).toFixed(2)} times the baseline`);
    $('[data-fit="family"]').textContent=fittedFamily?'Search winner':'My explorer model';
    describe($('#fit-plot'),`${selected.name} CDF versus 240 synthetic observations. Largest step-aware KS gap ${gap.d.toFixed(4)} at x ${gap.x.toFixed(3)}.`);
    const comparison=$('#fit-comparison');comparison.replaceChildren();
    ['normal','laplace','family'].forEach(kind=>{
      const model=candidates[kind], result=kind===mode?gap:ksGap(observations,model.cdf);
      const row=document.createElement('div');row.className='fit-result';
      const name=document.createElement('span');name.textContent=`${model.name} · ${model.description}`;
      const number=document.createElement('strong');number.textContent=result.d.toFixed(3);row.append(name,number);comparison.append(row);
    });
  }
  function newSample() {
    task++;auto.disabled=false;
    observations=mixture(.65,-.4,.45).samples(240,createRng(seed++));
    fittedFamily=null;mode='normal';widthControl.value=0;
    $$('[data-fit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fit===mode)));
    $('#fit-status').textContent='New reproducible sample. The reference normal and Laplace widths match its second moment about zero.';
    render();
  }
  $$('[data-fit]').forEach(button=>button.addEventListener('click',()=>{
    cancelSearch('Search canceled: you chose a candidate.');
    mode=button.dataset.fit;pressed('[data-fit]',button);render();
  }));
  widthControl.addEventListener('input',()=>{cancelSearch('Search canceled: you adjusted the width.');renderWidth();});
  const renderWidth=coalesced(render);
  $('#new-sample').addEventListener('click',newSample);
  onFamilyChange=()=>{
    cancelSearch('Search canceled: the explorer model changed.');
    if(fittedFamily)$('#fit-status').textContent='The explorer changed. Its new model replaces the previous search winner in the comparison.';
    fittedFamily=null;render();
  };
  auto.addEventListener('click',async()=>{
    const thisTask=++task;auto.disabled=true;
    const rGrid=[.35,.5,.7,1,1.5,2.2],etaGrid=[-.65,-.25,.3,1];
    let best=null, tested=0;
    try {
      for(const r of rGrid)for(const eta of etaGrid){
        if(thisTask!==task)return;
        const beta=(eta+1.5)/r;
        const vartheta=moment()*Math.exp(logGamma(beta)-logGamma(beta+1/r));
        const model=mixture(r,eta,vartheta,{steps:384});
        const gap=ksGap(observations,model.cdf);
        if(!best||gap.d<best.d)best={r,eta,vartheta,d:gap.d};
        $('#fit-status').textContent=`Testing actual candidates: ${++tested} / 24 shape pairs. Best gap so far ${best.d.toFixed(3)}.`;
        await new Promise(requestAnimationFrame);
      }
      if(thisTask!==task)return;
      fittedFamily=best;mode='family';widthControl.value=0;
      $$('[data-fit]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.fit===mode)));
      $('#fit-status').textContent=`24 pairs tested. Best r=${fmt(best.r)}, η=${fmt(best.eta)}, ϑ=${best.vartheta.toPrecision(3)}. A coarse search, not a guaranteed global optimum. Its candidate is shown here; the explorer above remains yours.`;
      render();
    } finally { if(thisTask===task)auto.disabled=false; }
  });
  const sizeUpdate=()=>{
    const n=Math.round(10**Number($('#sample-size').value));
    const cutoff=1.358/Math.sqrt(n);
    $('#sample-size-value').textContent=n.toLocaleString('en-US');
    $('#sample-size').setAttribute('aria-valuetext',`${n.toLocaleString('en-US')} independent observations`);
    $('#ks-cutoff').textContent=cutoff.toFixed(cutoff<.001?5:3);
    $('#cutoff-outcome').textContent=.02>cutoff?'Would reject this fixed model':'Would not reject this fixed model';
  };
  $('#sample-size').addEventListener('input',sizeUpdate);sizeUpdate();newSample();
}

function failureLab() {
  let selected='skew';
  const descriptions={
    skew:'Unequal sides are the clue. The mixture family is symmetric about zero. A change of width cannot make one tail longer than the other.',
    bimodal:'Two separated peaks are the clue. Every component peaks at zero; mixing their variances cannot create two modes at different locations.',
    spike:'This example puts 55% of all probability exactly at zero. A continuous variance mixture cannot create an actual point mass. A very tall but continuous peak is different.'
  };
  function render() {
    const pdf=selected==='skew'?x=>x>=-1?Math.exp(-x-1):0:selected==='bimodal'?x=>.5*normalPdf(x,-1.8,.5)+.5*normalPdf(x,1.8,.5):x=>.45*normalPdf(x);
    const plot=chart($('#failure-plot'),{xMin:-4,xMax:4,yMax:1.1,xTicks:[-4,-2,0,2,4],yLabel:selected==='spike'?'Continuous-part density; atom shown separately':'Schematic probability density'});
    line(plot,sampleCurve(x=>normalPdf(x),-4,4),{color:palette.sage,width:1.5,dash:'5 5'});
    const points=sampleCurve(pdf,-4,4,320);
    line(plot,points,{color:palette.copper,width:2.6,fill:true});
    if(selected==='spike'){
      plot.layer.append(svgNode('line',{x1:plot.x(0),x2:plot.x(0),y1:plot.y(.05),y2:plot.y(.92),stroke:palette.copper,'stroke-width':3}));
      plot.layer.append(svgNode('path',{d:`M${plot.x(0)-5},${plot.y(.92)+8}L${plot.x(0)},${plot.y(.92)}L${plot.x(0)+5},${plot.y(.92)+8}`,fill:'none',stroke:palette.copper,'stroke-width':2}));
      plot.svg.append(svgNode('text',{x:plot.x(0)+12,y:plot.y(.88),style:'fill:#a05a38;font-size:10px'},'55% probability atom at 0'));
    }
    plot.svg.append(svgNode('text',{x:plot.box.left+8,y:plot.box.top+15,style:'fill:#85936f;font-size:9px'},'Dashed: normal reference, not a fitted result'));
    describe($('#failure-plot'),`${selected==='skew'?'Asymmetric shifted exponential':selected==='bimodal'?'Two separated normal modes':'A 55 percent point mass at zero plus a continuous normal part'}. Constructed teaching example. Dashed normal is only a reference.`);
    $('#failure-answer').textContent='Choose the feature that changing the variance distribution cannot fix.';
    $$('[data-failure-answer]').forEach(button=>button.setAttribute('aria-pressed','false'));
  }
  $$('[data-failure]').forEach(button=>button.addEventListener('click',()=>{selected=button.dataset.failure;pressed('[data-failure]',button);render();}));
  $$('[data-failure-answer]').forEach(button=>button.addEventListener('click',()=>{
    pressed('[data-failure-answer]',button);
    $('#failure-answer').textContent=button.dataset.failureAnswer===selected?descriptions[selected]:`Look again at ${selected==='skew'?'the difference between the left and right sides':selected==='bimodal'?'where the two largest peaks are':"the probability assigned to exactly zero"}. ${selected==='spike'?'A continuous narrow peak and an exact point mass are not the same thing.':'Which shape property survives every zero-centered normal mixture?'}`;
  }));
  render();
}

function dependenceLab() {
  const rng=createRng(55903),xs=[],originalYs=[];
  for(let i=0;i<45;i++){
    const x=sampleNormal(rng);
    xs.push(x,x,-x,-x);originalYs.push(x,-x,x,-x);
  }
  let shuffled=false, ys=[...originalYs];
  const correlation=()=>{
    const mx=xs.reduce((a,b)=>a+b,0)/xs.length,my=ys.reduce((a,b)=>a+b,0)/ys.length;
    let xy=0,xx=0,yy=0;
    xs.forEach((x,i)=>{const a=x-mx,b=ys[i]-my;xy+=a*b;xx+=a*a;yy+=b*b;});
    return xy/Math.sqrt(xx*yy);
  };
  function render() {
    const range=Math.max(...xs.map(Math.abs))*1.13;
    const plot=chart($('#dependence-plot'),{xMin:-range,xMax:range,yMin:-range,yMax:range,xTicks:[-range,0,range],yTicks:[-range,0,range],yLabel:'Y',xLabel:'X'});
    xs.forEach((x,i)=>plot.layer.append(svgNode('circle',{cx:plot.x(x),cy:plot.y(ys[i]),r:3,fill:i%2?palette.copper:palette.forest,'fill-opacity':.65})));
    $('#correlation').textContent=fmt(correlation(),3);
    describe($('#dependence-plot'),shuffled?'Same marginal samples with Y values shuffled. The diagonal magnitude relation is broken.':`Paired values obey absolute Y = absolute X, despite zero sample correlation. They are dependent.`);
    $('#dependence-answer').textContent=shuffled?'The marginal samples are exactly unchanged. Their matching magnitudes are gone. The sample correlation can now drift away from zero; zero correlation alone never told us the whole story.':'The points lie on two diagonals. They are dependent even though their sample correlation is zero.';
    $('#shuffle-pairs').firstChild.textContent=shuffled?'Restore hidden connections ':'Shuffle the connections ';
    $('#shuffle-pairs').setAttribute('aria-pressed',String(shuffled));
  }
  $('#shuffle-pairs').addEventListener('click',()=>{
    shuffled=!shuffled;ys=[...originalYs];
    if(shuffled)for(let i=ys.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[ys[i],ys[j]]=[ys[j],ys[i]];}
    render();
  });
  render();
}

function navigation() {
  const sections=$$('main > section[id]');
  const links=$$('.chapter-nav a');
  let pending=false;
  let lastCurrent;
  function update() {
    pending=false;
    const position=innerHeight*.28;
    let current=sections[0]?.id;
    sections.forEach(section=>{if(section.getBoundingClientRect().top<=position)current=section.id;});
    links.forEach(link=>{if(link.hash===`#${current}`)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
    if(current!==lastCurrent){
      const active=links.find(link=>link.hash===`#${current}`);
      const nav=$('.chapter-nav');
      if(active && nav.scrollWidth>nav.clientWidth){
        nav.scrollTo({left:active.offsetLeft-nav.clientWidth/2+active.offsetWidth/2,behavior:motion?'smooth':'auto'});
      }
      lastCurrent=current;
    }
    const total=document.documentElement.scrollHeight-innerHeight;
    document.documentElement.style.setProperty('--chapter-progress',String(total>0?scrollY/total:0));
  }
  addEventListener('scroll',()=>{if(!pending){pending=true;requestAnimationFrame(update);}},{passive:true});
  addEventListener('resize',coalesced(update));update();
}

initializeMotion();
const initializers=[inverseLab,initImageLab,()=>initHeroArt({motionEnabled:()=>motion}),mixtureLab,familyLab,fitLab,initEvidence,failureLab,dependenceLab,navigation];
for(const initialize of initializers){
  try {initialize();}
  catch(error){console.error(`Research companion: ${initialize.name||'visual lesson'} could not initialize.`,error);}
}
