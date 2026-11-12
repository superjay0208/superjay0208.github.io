import { makeSignal, standardNoise, recoverSignal, priorPenalty, posteriorObjective, coefficientSupport, strengthToQuartile, SIGNAL_LENGTH } from './inference-math.mjs';

const names={normal:'Normal',laplace:'Laplace',cauchy:'Cauchy'};
const colors={ink:'#263d31',copper:'#b85a3a',sage:'#8b9e74',grey:'#8b9186',gold:'#ab895b',grid:'#d9ddce'};
const number=(value,digits=3)=>value.toFixed(digits).replace('-','−');
const svgNode=(tag,attrs={},text)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([key,value])=>node.setAttribute(key,value));if(text!==undefined)node.textContent=text;return node;};

export function initInferenceLab() {
  const mount=document.querySelector('#inference-lab-mount');
  if(!mount || mount.dataset.ready) return;
  mount.dataset.ready='true';
  mount.innerHTML=`<div class="inference-lab">
    <div class="inference-heading"><h3>Recovery studio.</h3><span class="inference-demo">GENERATED TEACHING EXPERIMENT</span></div>
    <div class="inference-scene-row"><div class="inference-choices" role="group" aria-label="Signal shape"><button type="button" data-signal="steps" aria-pressed="true"><span aria-hidden="true">▁▁▆▆▃▃</span><span>Steps</span></button><button type="button" data-signal="needle" aria-pressed="false"><span aria-hidden="true">▂▂▂▇▂▂</span><span>Needle</span></button><button type="button" data-signal="smooth" aria-pressed="false"><span aria-hidden="true">▂▄▆▅▃▂</span><span>Waves</span></button></div><button type="button" id="recovery-truth" class="inference-quiet" aria-pressed="false">Reveal the original</button></div>
    <div class="inference-signal-wrap"><svg id="recovery-signal" viewBox="0 0 900 310" role="img" aria-label="The noisy measurements and recovered signal"></svg></div>
    <div class="inference-plot-footer"><div class="inference-legend"><span><i class="inference-line noisy"></i> Noisy measurement</span><span><i class="inference-line recovered"></i> Recovered signal</span><span id="recovery-truth-key" hidden><i class="inference-line truth"></i> Original</span></div><div class="inference-error"><span>Error <small>RMSE ↓</small></span><output id="recovery-error-before">—</output><span aria-hidden="true">→</span><output id="recovery-error-after">—</output></div></div>
    <div class="inference-dials"><div><label for="recovery-noise">01 <span>Add noise</span><output id="recovery-noise-value">0.18</output></label><input id="recovery-noise" type="range" min="0.02" max="0.4" step="0.01" value="0.18"><div class="inference-range-ends"><span>A little</span><button type="button" id="recovery-new-noise">New noise ↻</button><span>A lot</span></div></div><div><label for="recovery-strength">02 <span>Prior strength</span><output id="recovery-strength-value">50 / 100</output></label><input id="recovery-strength" type="range" min="0" max="100" step="1" value="50"><div class="inference-range-ends"><span>Let details through</span><span>Pull toward zero</span></div></div></div>
    <div class="inference-prior-label"><span class="inference-kicker">03 / PICK AN ASSUMPTION</span><span>Same central 50% · different tails</span></div>
    <div class="inference-priors" role="group" aria-label="Recovery prior"><button type="button" data-recovery-prior="normal" aria-pressed="false"><svg viewBox="0 0 100 38" aria-hidden="true"><path d="M4 34C25 34 32 31 40 15S48 3 50 3 53 3 60 15 75 34 96 34"/></svg><span><strong>Normal</strong><small>Shrink every detail</small></span><output data-recovery-error="normal">—</output></button><button type="button" data-recovery-prior="laplace" aria-pressed="true"><svg viewBox="0 0 100 38" aria-hidden="true"><path d="M4 34Q31 32 50 3Q69 32 96 34"/></svg><span><strong>Laplace</strong><small>Zero the smallest</small></span><output data-recovery-error="laplace">—</output></button><button type="button" data-recovery-prior="cauchy" aria-pressed="false"><svg viewBox="0 0 100 38" aria-hidden="true"><path d="M4 31C26 29 35 26 41 13S46 3 50 3 54 3 59 13 74 29 96 31"/></svg><span><strong>Cauchy</strong><small>Allow large exceptions</small></span><output data-recovery-error="cauchy">—</output></button></div>
    <p class="inference-feedback" id="recovery-feedback" role="status"></p>
    <details class="inference-inspector" id="recovery-inspector"><summary><span><strong>Zoom into one decision</strong><small>How measurement × prior becomes a posterior</small></span><span class="inference-plus" aria-hidden="true">+</span></summary><div class="inference-inspector-body"><div class="inference-detail-controls"><div><label for="recovery-coefficient">Haar detail <output id="recovery-coefficient-value">1</output></label><input id="recovery-coefficient" type="range" min="1" max="127" step="1" value="1"><div class="inference-detail-picks"><button type="button" data-inspect="small">Near the noise level</button><button type="button" data-inspect="large">A strong detail</button></div><p id="recovery-support" class="inference-small"></p></div><div class="inference-decision"><span>The measurement suggests<strong id="recovery-observed">—</strong></span><span aria-hidden="true">→</span><span>The posterior mode chooses<strong id="recovery-estimated">—</strong></span></div></div><svg id="recovery-posterior" viewBox="0 0 900 290" role="img" aria-label="Relative likelihood, prior, and posterior for one Haar coefficient"></svg><div class="inference-legend"><span><i class="inference-line likelihood"></i> Measurement: likelihood</span><span><i class="inference-line prior"></i> Assumption: prior</span><span><i class="inference-line recovered"></i> Together: posterior</span></div><p class="inference-small">Each curve is scaled to its own peak of 1, so these heights are not probabilities. The solid marker is the posterior’s highest point: our estimate, not a guarantee.</p><p class="inference-detail-explanation" id="recovery-detail-explanation"></p></div></details>
    <details class="inference-method"><summary>The mathematics & what this example cannot prove</summary><div><p>We generate 128 known signal values, add independent N(0, σ²) noise, and apply the same orthonormal Haar transform as the image lesson. In this basis, the noise still has variance σ². Each detail coefficient is estimated separately; the overall average (DC) is preserved.</p><p>For a noisy detail y, the posterior is proportional to exp[−(y − x)² / (2σ²)] × prior(x). We choose its <strong>mode (MAP)</strong>. A Gaussian prior with standard deviation τ gives x̂ = yτ²/(τ² + σ²). A Laplace prior with scale b gives x̂ = sign(y) max(|y| − σ²/b, 0). A Cauchy prior with scale γ uses the global minimum of (y − x)²/(2σ²) + log(1 + x²/γ²); all stationary candidates are compared.</p><p>All three priors place half their mass in [−q, q]. The strength control narrows q from 0.8 to 0.025. The scales are τ = q/0.67449, b = q/ln 2, and γ = q. Equal quartiles do not mean equal variance: the Cauchy variance does not exist. Laplace corresponds to (r, η, ϑ) = (1, −½, 2b²), and Cauchy to (−1, −2, γ²/2). The Gaussian is a comparison prior, not an exact finite-parameter preset of the paper’s family.</p><p><strong>This is an application illustration, not a result reported in the paper.</strong> Noise is known here, priors are chosen by you, and coefficient independence is an explicit teaching assumption. The hidden original is used only to score error, not to fit the estimates. This single synthetic signal cannot establish a best prior, clinical performance, or calibrated uncertainty. A small RMSE does not imply a valid posterior.</p><p><a href="https://mathematical-tours.github.io/book/interactive/denoising/" target="_blank" rel="noopener noreferrer">Orthonormal wavelets & denoising · Gabriel Peyré ↗</a><a href="https://arxiv.org/html/2512.17038v3#S3.SS2" target="_blank" rel="noopener noreferrer">The paper’s prior definitions ↗</a></p></div></details>
    <p class="inference-scope">Teaching simulation. The paper tests how well priors fit coefficient distributions; it does not report this recovery experiment.</p>
  </div>`;

  const $=selector=>mount.querySelector(selector), $$=selector=>[...mount.querySelectorAll(selector)];
  const state={signal:'steps',prior:'laplace',sigma:.18,strength:50,seed:17038,coefficient:1,reveal:false};
  let noise=standardNoise(SIGNAL_LENGTH,state.seed), results={}, truth, pending=0,recoveryKey;
  const signalSvg=$('#recovery-signal'),posteriorSvg=$('#recovery-posterior');
  const inspector=$('#recovery-inspector');

  function setupPlot(svg,{xmin,xmax,ymin,ymax,xlabel,ylabel}) {
    const renderedWidth=svg.getBoundingClientRect().width;
    const compact=renderedWidth>0 && renderedWidth<500;
    svg.setAttribute('viewBox',compact
      ? `0 0 600 ${svg===signalSvg?360:340}`
      : `0 0 900 ${svg===signalSvg?310:290}`);
    const [,,width,height]=svg.getAttribute('viewBox').split(' ').map(Number);
    // Preserve axis legibility when the panel becomes a narrow phone screen.
    const scale=Math.min(2.4,Math.max(1,width/Math.max(renderedWidth,280)));
    const box={left:40+12*scale,right:width-20,top:24+8*scale,bottom:height-33-14*scale};
    const x=value=>box.left+(value-xmin)/(xmax-xmin)*(box.right-box.left);
    const y=value=>box.bottom-(value-ymin)/(ymax-ymin)*(box.bottom-box.top);
    svg.replaceChildren(svgNode('title',{},svg.getAttribute('aria-label')));
    [ymin,(ymin+ymax)/2,ymax].forEach(value=>{
      svg.append(svgNode('line',{x1:box.left,x2:box.right,y1:y(value),y2:y(value),stroke:colors.grid,'stroke-width':1}));
      svg.append(svgNode('text',{x:box.left-10,y:y(value)+4,'text-anchor':'end',style:`font-size:${11*scale}px;fill:${colors.grey}`},number(value,1)));
    });
    [xmin,(xmin+xmax)/2,xmax].forEach(value=>svg.append(svgNode('text',{x:x(value),y:box.bottom+20*scale,'text-anchor':'middle',style:`font-size:${11*scale}px;fill:${colors.grey}`},Number.isInteger(value)?String(value):number(value,1))));
    svg.append(svgNode('text',{x:box.left,y:15*scale,style:`font-size:${10*scale}px;fill:${colors.grey}`},ylabel));
    svg.append(svgNode('text',{x:box.right,y:15*scale,'text-anchor':'end',style:`font-size:${10*scale}px;fill:${colors.grey}`},xlabel));
    return {x,y,box};
  }
  function path(svg,plot,values,color,width=2,dash,opacity=1) {
    const d=values.map(([x,y],i)=>`${i?'L':'M'}${plot.x(x).toFixed(2)},${plot.y(y).toFixed(2)}`).join(' ');
    svg.append(svgNode('path',{d,fill:'none',stroke:color,'stroke-width':width,'stroke-linecap':'round','stroke-linejoin':'round',opacity,...(dash?{'stroke-dasharray':dash}:{})}));
  }
  function drawSignal() {
    const result=results[state.prior];
    const minimum=Math.min(...result.observed,...result.recovered,...truth),maximum=Math.max(...result.observed,...result.recovered,...truth);
    const ymin=Math.floor((minimum-.12)*5)/5,ymax=Math.ceil((maximum+.12)*5)/5;
    const plot=setupPlot(signalSvg,{xmin:1,xmax:SIGNAL_LENGTH,ymin,ymax,xlabel:'Position in the signal →',ylabel:'Signal value'});
    signalSvg._plotBox=plot.box;
    if(inspector.open) {
      const support=coefficientSupport(state.coefficient);
      signalSvg.append(svgNode('rect',{x:plot.x(support.start+1),y:plot.box.top,width:Math.max(2,plot.x(Math.min(SIGNAL_LENGTH,support.end+1))-plot.x(support.start+1)),height:plot.box.bottom-plot.box.top,fill:colors.gold,opacity:.13}));
    }
    path(signalSvg,plot,Array.from(result.observed,(value,i)=>[i+1,value]),colors.grey,1.6,undefined,.6);
    if(state.reveal)path(signalSvg,plot,Array.from(truth,(value,i)=>[i+1,value]),colors.copper,2.3,'6 5');
    path(signalSvg,plot,Array.from(result.recovered,(value,i)=>[i+1,value]),colors.ink,3.2);
    signalSvg.setAttribute('aria-label',`128 noisy measurements and the ${names[state.prior]} recovered signal${state.reveal?', with the original shown as a dashed line':''}. RMSE changes from ${number(result.noisyError)} to ${number(result.recoveredError)}.`);
  }
  function drawInspector() {
    const result=results[state.prior], q=strengthToQuartile(state.strength),i=state.coefficient;
    const observed=result.coefficients[i],estimate=result.estimates[i],support=coefficientSupport(i);
    $('#recovery-coefficient-value').textContent=`${i} / 127`;
    $('#recovery-coefficient').setAttribute('aria-valuetext',`Detail ${i} of 127, comparing positions ${support.start+1} to ${support.mid} with ${support.mid+1} to ${support.end}`);
    $('#recovery-support').textContent=`This detail compares positions ${support.start+1}–${support.mid} with ${support.mid+1}–${support.end}. Its support is highlighted above.`;
    $('#recovery-observed').textContent=number(observed);
    $('#recovery-estimated').textContent=number(estimate);
    const explanation=state.prior==='normal'?'The normal prior pulls every nonzero detail toward zero by the same proportion.':state.prior==='laplace'?'The Laplace prior subtracts a fixed amount from each magnitude. Small details land exactly at zero.':'The Cauchy prior pulls small details toward zero while allowing larger exceptions. Its posterior can have more than one peak; we choose the highest.';
    $('#recovery-detail-explanation').textContent=explanation;
    if(!inspector.open)return;
    const extent=Math.max(.45,Math.abs(observed)+2.8*state.sigma,4*q);
    const plot=setupPlot(posteriorSvg,{xmin:-extent,xmax:extent,ymin:0,ymax:1.08,xlabel:'Candidate true detail value →',ylabel:'Relative height'});
    const points=Array.from({length:501},(_,j)=>-extent+2*extent*j/500);
    points.push(0,observed,estimate);points.sort((a,b)=>a-b);
    const posteriorMinimum=posteriorObjective(estimate,observed,state.sigma,state.prior,q);
    path(posteriorSvg,plot,points.map(x=>[x,Math.exp(-.5*((x-observed)/state.sigma)**2)]),colors.gold,2.2,'7 4');
    path(posteriorSvg,plot,points.map(x=>[x,Math.exp(-priorPenalty(x,state.prior,q))]),colors.copper,2.2,'2 5');
    path(posteriorSvg,plot,points.map(x=>[x,Math.exp(-posteriorObjective(x,observed,state.sigma,state.prior,q)+posteriorMinimum)]),colors.ink,3.2);
    posteriorSvg.append(svgNode('line',{x1:plot.x(observed),x2:plot.x(observed),y1:plot.y(0),y2:plot.y(1),stroke:colors.gold,'stroke-width':1,'stroke-dasharray':'4 4'}));
    posteriorSvg.append(svgNode('circle',{cx:plot.x(estimate),cy:plot.y(1),r:5,fill:colors.ink,stroke:'#f5f2e9','stroke-width':2}));
    posteriorSvg.setAttribute('aria-label',`Relative likelihood, ${names[state.prior]} prior, and posterior for detail ${i}. Observed ${number(observed)}; estimated posterior mode ${number(estimate)}. Each curve has its own maximum height of one.`);
  }
  function render() {
    pending=0;
    const key=`${state.signal}/${state.seed}/${state.sigma}/${state.strength}`;
    if(recoveryKey!==key){
      truth=makeSignal(state.signal);
      const q=strengthToQuartile(state.strength);
      for(const kind of Object.keys(names))results[kind]=recoverSignal(truth,noise,state.sigma,kind,q);
      recoveryKey=key;
    }
    const current=results[state.prior];
    $('#recovery-noise-value').textContent=number(state.sigma,2);
    $('#recovery-noise').setAttribute('aria-valuetext',`Noise standard deviation ${number(state.sigma,2)}`);
    $('#recovery-strength-value').textContent=`${state.strength} / 100`;
    $('#recovery-strength').setAttribute('aria-valuetext',`Prior strength ${state.strength} out of 100; half its mass lies between minus ${number(strengthToQuartile(state.strength))} and plus ${number(strengthToQuartile(state.strength))}`);
    $('#recovery-error-before').textContent=number(current.noisyError);
    $('#recovery-error-after').textContent=number(current.recoveredError);
    $$('[data-recovery-error]').forEach(output=>{const kind=output.dataset.recoveryError;output.textContent=number(results[kind].recoveredError);output.setAttribute('aria-label',`${names[kind]} recovered error ${number(results[kind].recoveredError)}`);});
    const change=100*(1-current.recoveredError/current.noisyError);
    const method=state.prior==='normal'?'Every detail is softened.':state.prior==='laplace'?`${Array.from(current.estimates).slice(1).filter(value=>value===0).length} of 127 details become exactly zero.`:'Large details can resist shrinking.';
    $('#recovery-feedback').textContent=`${method} ${change>=0?`${Math.round(change)}% less error`:`${Math.round(-change)}% more error`} on this one signal.`;
    drawSignal();drawInspector();
  }
  const schedule=()=>{if(!pending)pending=requestAnimationFrame(render);};
  signalSvg.classList.add('signal-inspector-surface');
  signalSvg.addEventListener('click',event=>{
    const bounds=signalSvg.getBoundingClientRect(),view=signalSvg.getAttribute('viewBox').split(' ').map(Number);
    const x=(event.clientX-bounds.left)/bounds.width*view[2],y=(event.clientY-bounds.top)/bounds.height*view[3],box=signalSvg._plotBox;
    if(event.button!==0||!box||x<box.left||x>box.right||y<box.top||y>box.bottom)return;
    const position=Math.round((x-box.left)/(box.right-box.left)*(SIGNAL_LENGTH-1));
    state.coefficient=64+Math.floor(position/2);$('#recovery-coefficient').value=state.coefficient;
    inspector.open=true;drawSignal();drawInspector();
  });
  $$('[data-signal]').forEach(button=>button.addEventListener('click',()=>{state.signal=button.dataset.signal;$$('[data-signal]').forEach(other=>other.setAttribute('aria-pressed',other===button));schedule();}));
  $$('[data-recovery-prior]').forEach(button=>button.addEventListener('click',()=>{state.prior=button.dataset.recoveryPrior;$$('[data-recovery-prior]').forEach(other=>other.setAttribute('aria-pressed',other===button));schedule();}));
  $('#recovery-noise').addEventListener('input',event=>{state.sigma=Number(event.target.value);schedule();});
  $('#recovery-strength').addEventListener('input',event=>{state.strength=Number(event.target.value);schedule();});
  $('#recovery-new-noise').addEventListener('click',()=>{state.seed+=7919;noise=standardNoise(SIGNAL_LENGTH,state.seed);schedule();});
  $('#recovery-truth').addEventListener('click',event=>{state.reveal=!state.reveal;event.currentTarget.setAttribute('aria-pressed',state.reveal);event.currentTarget.textContent=state.reveal?'Hide the original':'Reveal the original';$('#recovery-truth-key').hidden=!state.reveal;drawSignal();});
  $('#recovery-coefficient').addEventListener('input',event=>{state.coefficient=Number(event.target.value);drawSignal();drawInspector();});
  $$('[data-inspect]').forEach(button=>button.addEventListener('click',()=>{
    const values=results[state.prior].coefficients;let chosen=1,score=Infinity;
    for(let i=1;i<values.length;i++){const candidate=button.dataset.inspect==='large'?-Math.abs(values[i]):Math.abs(Math.abs(values[i])-1.5*state.sigma);if(candidate<score){score=candidate;chosen=i;}}
    state.coefficient=chosen;$('#recovery-coefficient').value=chosen;drawSignal();drawInspector();
  }));
  inspector.addEventListener('toggle',()=>{drawSignal();drawInspector();});
  let previousWidth=0;
  const resizeObserver=new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0 && width!==previousWidth){previousWidth=width;schedule();}});
  resizeObserver.observe(mount);
  render();
}
