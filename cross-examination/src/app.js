import { normalizeInput } from './matcher.js?v=6';
import {dailyTopic,utcDay,playableDebate,createRun,currentArgument,selectClaim,matchCounterInput,scoreExample,possibleChain,commitTurn,advanceRun,totalScore,restoreRun,shareText} from './game.js?v=6';

const main=document.querySelector('#main'),effects=document.querySelector('#effects');
const h=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=value=>value.toLocaleString('en-US');
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let manifest,debate,day,run=null,sound=true,audio,attempted=false,composing=false,storageAvailable=true,transitioning=false,hiddenSuggestions=false,lastTickSecond=null,animationGeneration=0;
const runKey=()=>`cross-examination:daily:v5:${day}`;
const bestKey=()=>`cross-examination:daily:best:v5:${day}:${debate.id}:${debate.version}`;
function read(key){try{return localStorage.getItem(key);}catch{storageAvailable=false;return null;}}
function write(key,value){try{localStorage.setItem(key,value);}catch{storageAvailable=false;}}
function persist(){write(runKey(),JSON.stringify(run));}
function announce(text){document.querySelector('#announcer').textContent=text;}
const dateLabel=()=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(day+'T00:00:00Z'));
const exampleById=id=>debate.examples.find(example=>example.id===id);
const bestChain=()=>Math.max(1,...(run?.history??[]).map(record=>record.multiplier));
function storageNote(){return storageAvailable?'':'<p class="storage-note">Progress cannot be saved here. Keep this tab open to finish.</p>';}
function start(){armAudio();run=createRun(debate,day);attempted=false;persist();render();document.querySelector('.daily-topic').scrollIntoView({block:'start'});inputFocus();announce('45 seconds. Name something that breaks the highlighted rule.');}
function renderHome(){
 main.className='home';
 main.innerHTML=`<div class="game-shell home-shell"><p class="eyebrow daily-label"><span class="live-dot"></span> TODAY’S SMALL HILL · ${h(dateLabel())}</p><h1 class="home-question">${h(debate.question)}</h1><p class="home-description">They make a rule.<br><em>You break it.</em></p><div class="home-rules"><span><strong>6</strong> comebacks</span><span><strong>45s</strong> each</span><span><strong>×2</strong> for turning an earlier example around</span></div><button class="primary-button play-button" id="play-button">What about… <span>↗</span></button><p class="home-instruction">Type an example. Watch the argument change.</p><div class="home-demo"><span>“${h(debate.demo?.claim??"Sandwiches are cold.")}”</span><span aria-hidden="true">↘</span><strong>What about ${h(debate.demo?.example??"grilled cheese")}?</strong><b>+100</b></div><span class="home-cross" aria-hidden="true">×</span>${storageNote()}</div>`;
 document.querySelector('#play-button').addEventListener('click',start);
}
function header(){
 const hits=run.history.filter(record=>record.kind==='answer').length,index=run.phase==='reveal'?run.history.length:Math.min(run.history.length+1,6);
 return `<div class="daily-topic"><span>${h(dateLabel())} · THE DAILY DEBATE</span><h1>${h(debate.question)}</h1></div><div class="game-hud"><div class="round-progress"><span>${run.phase==='complete'?'DEBATE COMPLETE':`COMEBACK ${index} / 6`}</span>${bestChain()>1?`<b class="current-chain">×${bestChain()} BEST CHAIN</b>`:''}</div>${run.phase==='turn'?`<div class="clock" role="timer" aria-label="45 seconds remaining"><svg viewBox="0 0 60 60" aria-hidden="true"><circle class="clock-track" cx="30" cy="30" r="25"/><circle id="clock-ring" cx="30" cy="30" r="25"/></svg><strong id="clock-value">45</strong><span>SEC</span></div>`:`<span class="clock-paused">${run.phase==='complete'?'STILL DEBATABLE.':'TAKE A BREATH.'}</span>`}<div class="score-total"><span>POINTS</span><strong id="score-number">${fmt(totalScore(run))}</strong></div></div><div class="counter-progress"><div class="counter-progress-label"><span>COUNTERS LANDED</span><strong>${hits}<small> / 6</small></strong></div><div class="counter-track" role="progressbar" aria-label="Counters landed" aria-valuemin="0" aria-valuemax="6" aria-valuenow="${hits}"><span id="counter-fill" style="transform:scaleX(${hits/6})"></span><i></i><i></i><i></i><i></i><i></i><b id="meter-tip" style="left:${hits/6*100}%">✳</b></div></div>`;
}
function quoteHTML(argument,selected=null,struck=false){
 const claims=argument.claims.map(claim=>({...claim,start:argument.text.indexOf(claim.text)})).sort((a,b)=>a.start-b.start);
 let text='',cursor=0;
 for(const claim of claims){text+=h(argument.text.slice(cursor,claim.start));const active=selected===claim.id,opportunity=run.phase==='turn'&&possibleChain(run,claim.id);
  text+=run.phase==='turn'?`<button type="button" class="claim ${active?'selected':''}" data-claim="${h(claim.id)}" aria-pressed="${active}" aria-label="Challenge: ${h(claim.text)}">${h(claim.text)}${opportunity?`<small class="claim-bonus" aria-hidden="true">×${opportunity.multiplier}</small>`:''}</button>`:active&&struck?`<span class="struck-phrase">${h(claim.text)}</span>`:h(claim.text);
  cursor=claim.start+claim.text.length;
 }
 return text+h(argument.text.slice(cursor));
}
function bonusTarget(){
 const opportunity=possibleChain(run,run.selectedClaimId);if(!opportunity)return '';
 const earlier=exampleById(run.history[opportunity.chainTargetIndex].entryId);
 return `<aside class="reversal-target" aria-label="Chain opportunity"><div><b>×${opportunity.multiplier}</b><span>TURN YOUR EXAMPLE AROUND</span></div><p>${h(opportunity.chainChallenge??`Can your new example challenge ${earlier.answer} too?`)}</p><span class="target-example">↶ ${h(earlier.answer)} <small>→ your next example</small></span></aside>`;
}
function turnView(){
 const argument=currentArgument(run),claim=argument.claims.find(claim=>claim.id===run.selectedClaimId);
 return `<section class="exchange"><p class="reply-line"><span aria-hidden="true">↳</span> ${h(argument.reply??'Let’s start with this rule.')}</p><section class="argument-stage ${argument.side}" aria-label="Prepared argument"><div class="argument-top"><span class="side-tag">${argument.side==='for'?'YES, IT COUNTS':'NO, IT DOESN’T'}</span><span class="argument-number">0${run.history.length+1}</span></div><blockquote id="argument-text">${quoteHTML(argument,claim.id)}</blockquote><p class="claim-hint" id="claim-hint"><b class="base-points">+100</b> ${h(claim.hint)}</p>${bonusTarget()}<section class="composer active" aria-label="Your counterexample"><form id="answer-form" novalidate><label class="sr-only" for="answer-input">Your counterexample</label><div class="input-row"><span class="what-about" aria-hidden="true">What about</span><input id="answer-input" aria-label="Your counterexample" aria-describedby="match-preview claim-hint" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="name an example…" value="${h(run.draft)}" aria-autocomplete="list" aria-controls="suggestions"><button class="send-button" type="submit" aria-label="Submit counterexample">↗</button></div><div class="input-under"><p id="match-preview" role="status"></p></div><div id="suggestions" role="listbox" aria-label="Spelling suggestions" hidden></div></form><div class="composer-footer"><span>Just a name. Typos welcome.</span><button class="skip-button" id="skip-button">Pass ↗</button></div></section><div class="time-track" aria-hidden="true"><span id="time-fill"></span></div></section></section>`;
}
function trail(){
 if(!run.history.some(record=>record.entryId)||run.phase==='complete')return '';
 return `<div class="prior-trail"><span>YOUR TRAIL</span>${run.history.filter(record=>record.entryId).map(record=>`<span class="trail-chip ${record.multiplier>1?'linked':''}">${h(exampleById(record.entryId).answer)}${record.multiplier>1?` <b>×${record.multiplier}</b>`:''}</span>`).join('')}</div>`;
}
function reveal(){
 const record=run.history.at(-1),argument=currentArgument(run),example=exampleById(record.entryId),earlier=record.chainTargetIndex===null?null:exampleById(run.history[record.chainTargetIndex].entryId);
 const next=run.history.length<6?currentArgument(advanceRun(run)):null;
 const nextButton=`<button class="primary-button next-button" id="next-button">${next?'Their reply':'See your score'} <span>↗</span></button><span class="keyboard-note">or press Enter</span>`;
 if(!example)return `<section class="miss-view"><p class="eyebrow">${record.kind==='timeout'?'THE CLOCK GOT THERE FIRST.':'NEXT RULE.'}</p><h2>${record.kind==='timeout'?'Time’s up.':'Keep going.'}</h2><p>Another rule. Another 45 seconds.</p>${nextButton}</section>`;
 return `<section class="reveal-view"><div class="challenged-argument"><span class="side-tag small">THEIR RULE</span><p>${quoteHTML(argument,record.claimId,true)}</p></div><div class="answer-stage ${record.multiplier>1?'is-chain':''}"><div class="answer-kicker"><span>WHAT ABOUT</span><b class="hit-stamp">${earlier?'COUNTERPUNCH!':'COUNTER!'}</b></div><div class="receipt-head"><h2 id="answer-title">${h(example.answer)}<span>.</span></h2><div class="answer-score"><strong class="points-earned">+${fmt(record.total)}</strong>${earlier?`<span>×${record.multiplier} CHAIN</span>`:''}</div></div><p class="explanation">${h(record.explanation)}</p>${earlier?`<div class="chain-proof"><div class="chain-proof-top"><span>YOUR EARLIER EXAMPLE, REVERSED</span><strong class="chain-multiplier">×${record.multiplier}</strong></div><div class="chain-link"><s>${h(earlier.answer)}</s><span aria-hidden="true">↯</span><b>${h(example.answer)}</b></div><details><summary>See the connection</summary><p>${h(record.chainExplanation)}</p></details></div>`:''}</div>${normalizeInput(record.input)!==normalizeInput(example.answer)?`<p class="correction-receipt">Matched “${h(record.input)}” to ${h(example.answer)}.</p>`:''}${next?`<p class="next-reply"><span>THEIR NEXT RULE</span>${h(next.reply??'Let’s try another rule.')}</p>`:''}${nextButton}</section>`;
}
function results(){
 const score=totalScore(run),best=Number(read(bestKey())??0);if(score>best)write(bestKey(),String(score));
 const strongest=run.history.filter(record=>record.multiplier>1).sort((a,b)=>b.multiplier-a.multiplier)[0];
 return `<section class="results"><p class="eyebrow">SIX RULES LATER…</p><h2>Still<br><em>debatable.</em></h2><div class="final-score">${fmt(score)}<span>POINTS</span></div><p>${run.history.filter(record=>record.entryId).length} / 6 counters <span>·</span> ${run.history.filter(record=>record.multiplier>1).length} reversals${score>0&&score>=best?' <span>·</span> Personal best':''}</p>${strongest?`<div class="best-reversal"><span>YOUR BEST COMEBACK</span><p>${h(exampleById(run.history[strongest.chainTargetIndex].entryId).answer)} <b>↯</b> ${h(exampleById(strongest.entryId).answer)}</p><strong>×${strongest.multiplier} · +${fmt(strongest.total)}</strong></div>`:''}<div class="result-actions"><button class="primary-button" id="again-button">Try another route ↗</button><button class="quiet-link" id="share-button">Copy result</button></div></section><details class="recap-details"><summary>Your six comebacks</summary><ol class="round-recap">${run.history.map((record,index)=>`<li><span class="recap-number">0${index+1}</span><div><p>${h(record.argumentText)}</p><strong>${record.entryId?h(exampleById(record.entryId).answer):record.kind==='timeout'?'Time’s up':'Passed'}${record.multiplier>1?` <b>×${record.multiplier}</b>`:''}</strong>${record.entryId?`<span>${h(record.chainExplanation??record.explanation)}</span>`:''}</div><b>+${fmt(record.total)}</b></li>`).join('')}</ol></details><p class="tomorrow-note">A new small hill tomorrow.</p>`;
}
function render(){
 animationGeneration++;main.className=run.phase;
 main.innerHTML=`<div class="game-shell">${header()}${run.phase==='turn'?turnView()+trail():run.phase==='reveal'?reveal()+trail():results()}${storageNote()}</div>`;
 bind();if(run.phase==='turn'){lastTickSecond=null;preview();updateClock(false);}
}
function inputFocus(){document.querySelector('#answer-input')?.focus({preventScroll:true});}
function choose(id){if(transitioning||run.phase!=='turn')return;run=selectClaim(run,id);attempted=false;hiddenSuggestions=false;persist();render();document.querySelector(".argument-stage").style.animation="none";inputFocus();}
function bind(){
 document.querySelectorAll('[data-claim]').forEach(button=>button.addEventListener('click',()=>choose(button.dataset.claim)));
 const input=document.querySelector('#answer-input');
 input?.addEventListener('compositionstart',()=>{composing=true;});input?.addEventListener('compositionend',()=>{composing=false;run.draft=input.value;persist();preview();});
 input?.addEventListener('input',()=>{run.draft=input.value;attempted=false;hiddenSuggestions=false;persist();if(!composing)preview();});
 input?.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){const first=document.querySelector('[data-suggestion]');if(first){event.preventDefault();first.focus();}}else if(event.key==='Escape'){hiddenSuggestions=true;preview();}});
 document.querySelector('#answer-form')?.addEventListener('submit',event=>{event.preventDefault();if(composing||transitioning)return;attempted=true;const match=matchCounterInput(run,run.draft);if(match.kind==='match')finish({kind:'answer',entryId:match.entryId,claimId:match.claimId,input:run.draft});else{preview();announce(document.querySelector('#match-preview').textContent);}});
 document.querySelector('#skip-button')?.addEventListener('click',()=>finish({kind:'skip'}));
 document.querySelector('#next-button')?.addEventListener('click',()=>{if(transitioning)return;run=advanceRun(run);attempted=false;hiddenSuggestions=false;persist();render();document.querySelector('.daily-topic').scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});if(run.phase==='turn'){inputFocus();announce(`${currentArgument(run).reply??''} 45 seconds.`);}else{document.querySelector('#again-button').focus({preventScroll:true});playSound('hit',bestChain());}});
 document.querySelector('#again-button')?.addEventListener('click',start);
 document.querySelector('#share-button')?.addEventListener('click',async event=>{const text=shareText(run);try{await navigator.clipboard.writeText(text);event.target.textContent='Copied ✓';}catch{document.querySelector('#share-output').value=text;document.querySelector('#share-dialog').showModal();document.querySelector('#share-output').select();}});
}
function preview(){
 const output=document.querySelector('#match-preview'),box=document.querySelector('#suggestions');if(!output||composing)return;
 output.className='';box.hidden=true;box.innerHTML='';document.querySelector('.input-row').classList.remove('ready-to-hit');
 if(!run.draft.trim()){output.textContent=attempted?'Name one example first.':'Type an example. Switch an underlined phrase any time.';return;}
 const match=matchCounterInput(run,run.draft);
 if(match.kind==='match'){
  const score=scoreExample(run,match.entry,match.claimId),claim=currentArgument(run).claims.find(claim=>claim.id===match.claimId);
  output.className='recognized';document.querySelector('.input-row').classList.add('ready-to-hit');
  output.innerHTML=`${match.matchType==='typo'?'Corrected to ':''}<strong>${h(match.entry.answer)}</strong><span class="preview-points">+${fmt(score.total)}${score.multiplier>1?` · ×${score.multiplier}`:''}</span> ✓${match.redirected?`<small class="redirect-note">This hits “${h(claim.text)}”.</small>`:''}`;
 }else if(['suggestion','ambiguous'].includes(match.kind)&&match.suggestions?.length&&!hiddenSuggestions){
  output.textContent='Did you mean…';box.hidden=false;
  box.innerHTML=match.suggestions.map((suggestion,index)=>`<button type="button" role="option" aria-selected="false" data-suggestion="${index}">${h(suggestion.entry.answer)}<span>↖</span></button>`).join('');
  box.querySelectorAll('[data-suggestion]').forEach(button=>{button.addEventListener('click',()=>{run.draft=match.suggestions[Number(button.dataset.suggestion)].entry.answer;attempted=false;hiddenSuggestions=true;document.querySelector('#answer-input').value=run.draft;persist();preview();inputFocus();});button.addEventListener('keydown',event=>{const buttons=[...box.querySelectorAll('[data-suggestion]')],index=buttons.indexOf(button);if(event.key==='ArrowDown'){event.preventDefault();(buttons[index+1]??buttons[0]).focus();}else if(event.key==='ArrowUp'){event.preventDefault();index?buttons[index-1].focus():inputFocus();}else if(event.key==='Escape'){event.preventDefault();hiddenSuggestions=true;preview();inputFocus();}});});
 }else{
  const messages={'already-used':'You used that name already. Try a new example.','invalid':match.reason,'rejected':match.reason,'no-match':'Not in this answer bank yet. Try another example.','suggestion':'Try a more specific name.','ambiguous':'Try a more specific name.'};
  output.className=attempted?'needs-work':'';output.textContent=attempted||['already-used','invalid','rejected'].includes(match.kind)?messages[match.kind]:'Keep typing. We’ll help with the spelling.';
 }
}
function updateClock(audible=true){
 if(!run||run.phase!=='turn'||transitioning)return;
 const left=Math.max(0,run.deadline-Date.now()),second=Math.ceil(left/1000),ratio=Math.min(1,left/(debate.rules.secondsPerTurn*1000));
 if(left===0){finish({kind:'timeout'});return;}
 document.querySelector('#clock-value').textContent=second;document.querySelector('#clock-ring').style.strokeDashoffset=String(157.08*(1-ratio));document.querySelector('#time-fill').style.transform=`scaleX(${ratio})`;document.querySelector('.clock').setAttribute('aria-label',`${second} seconds remaining`);main.classList.toggle('urgent',second<=5);
 if(second<=5&&second!==lastTickSecond){if(audible&&!document.hidden)playSound('tick',1);if(second===5)announce('Five seconds left.');}lastTickSecond=second;
}
function finish(move){
 if(!run||run.phase!=='turn'||transitioning)return;transitioning=true;
 const before=totalScore(run),target=move.claimId??run.selectedClaimId;
 run=commitTurn(run,move);persist();document.querySelector(`[data-claim="${target}"]`)?.classList.add('landed');document.querySelector('#answer-input')?.setAttribute('readonly','');document.querySelector('.send-button')?.setAttribute('disabled','');
 window.setTimeout(()=>{render();transitioning=false;main.classList.remove('urgent');document.querySelector('#next-button')?.focus({preventScroll:true});document.querySelector('.game-shell').scrollIntoView({block:'start',behavior:reduced()?'instant':'smooth'});impact(run.history.at(-1),before);const record=run.history.at(-1);announce(record.entryId?`${exampleById(record.entryId).answer}. ${record.total} points.${record.multiplier>1?` You countered yourself. Times ${record.multiplier}.`:''} Clock paused.`:'Clock paused. Another rule awaits.');},reduced()?0:130);
}

function armAudio(){if(!sound||(navigator.userActivation&&!navigator.userActivation.hasBeenActive))return;try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function tone(frequency,time,duration,volume=.08,type='sine'){
  if(!audio)return;const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type=type;oscillator.frequency.setValueAtTime(frequency,time);gain.gain.setValueAtTime(.001,time);gain.gain.linearRampToValueAtTime(volume,time+.009);gain.gain.exponentialRampToValueAtTime(.001,time+duration);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(time);oscillator.stop(time+duration+.01);
}
function playSound(kind,multiplier){
  if(!sound)return;armAudio();if(!audio)return;try{const t=audio.currentTime;if(kind==='tick'){tone(900,t,.045,.025,'triangle');return;}if(kind==='timeout'){tone(190,t,.18,.09,'triangle');tone(130,t+.12,.3,.07,'triangle');return;}const pitch=240+Math.log2(multiplier)*55;tone(70,t,.2,.12);[1,1.25,1.5,2].forEach((ratio,i)=>tone(pitch*ratio,t+i*.055,.28,.085,'triangle'));if(multiplier>1){tone(pitch*3,t+.22,.45,.07);tone(pitch*4,t+.28,.38,.045);}}catch{}
}
function impact(record,before){
  playSound(record.kind==='answer'?'hit':'timeout',record.multiplier);
  if(reduced())return;
  const generation=animationGeneration,answer=document.querySelector('.answer-stage'),clockMiss=document.querySelector('.miss-view');
  (answer??clockMiss)?.animate([{opacity:.1,transform:'translateY(36px) scale(.94) rotate(-1deg)'},{opacity:1,transform:'translateY(-5px) scale(1.015) rotate(.3deg)'},{opacity:1,transform:'none'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
  if(record.kind!=='answer')return;
  document.querySelector('.hit-stamp')?.animate([{transform:'scale(3) rotate(16deg)',opacity:0},{transform:'scale(.85) rotate(-12deg)',opacity:1},{transform:'rotate(-7deg)',opacity:1}],{duration:650,delay:80,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
  document.querySelector('.chain-multiplier')?.animate([{transform:'scale(.1) rotate(-25deg)',opacity:0},{transform:'scale(1.28) rotate(8deg)',opacity:1},{transform:'scale(1) rotate(-6deg)',opacity:1}],{duration:850,delay:150,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'});
  document.querySelector('.points-earned')?.animate([{transform:'translateY(18px) scale(.5)',opacity:0},{transform:'translateY(-5px) scale(1.12)',opacity:1},{transform:'none',opacity:1}],{duration:700,delay:100,fill:'backwards'});
  // Give each hit weight without putting a temporary panel over the answer.
  document.querySelector('.game-shell')?.animate([
    {transform:'translate(0,0)'},{transform:'translate(-6px,3px)'},
    {transform:'translate(5px,-2px)'},{transform:'translate(-3px,1px)'},
    {transform:'translate(2px,0)'},{transform:'none'}
  ],{duration:record.multiplier>1?360:230,easing:'ease-out'});
  const hits=run.history.filter(turn=>turn.kind==='answer').length;
  document.querySelector('#counter-fill')?.animate([
    {transform:`scaleX(${(hits-1)/6})`},{transform:`scaleX(${hits/6})`}
  ],{duration:900,easing:'cubic-bezier(.16,1,.3,1)'});
  document.querySelector('#meter-tip')?.animate([
    {left:`${(hits-1)/6*100}%`,transform:'translate(-50%,-50%) scale(.4) rotate(-90deg)'},
    {left:`${hits/6*100}%`,transform:'translate(-50%,-50%) scale(1.5) rotate(20deg)',offset:.7},
    {left:`${hits/6*100}%`,transform:'translate(-50%,-50%) scale(1) rotate(0deg)'}
  ],{duration:900,easing:'cubic-bezier(.16,1,.3,1)'});
  document.querySelector('.score-total')?.animate([
    {transform:'scale(1)'},{transform:'scale(1.2) rotate(-4deg)'},{transform:'scale(1)'}
  ],{duration:500,delay:550,easing:'ease-out'});
  document.querySelector('.counter-track')?.animate([
    {boxShadow:'0 0 0 0 #e56f3566'},{boxShadow:'0 0 0 12px #e56f3500'}
  ],{duration:750,delay:250});
  const start=performance.now(),score=document.querySelector('#score-number');const count=time=>{if(generation!==animationGeneration||!score.isConnected)return;const p=Math.min(1,(time-start)/850);score.textContent=fmt(Math.round(before+record.total*(1-(1-p)**3)));if(p<1)requestAnimationFrame(count);};requestAnimationFrame(count);
  const flash=document.createElement('i');flash.className='impact-flash';effects.append(flash);flash.animate([{opacity:.5},{opacity:0}],{duration:450}).onfinish=()=>flash.remove();
  const rect=answer.getBoundingClientRect(),cx=rect.left+rect.width*.6,cy=rect.top+rect.height*.55;
  const ring=document.createElement('i');ring.className='shock-ring';ring.style.cssText=`left:${cx}px;top:${cy}px`;effects.append(ring);ring.animate([{transform:'translate(-50%,-50%) scale(.1)',opacity:1},{transform:'translate(-50%,-50%) scale(3)',opacity:0}],{duration:850,easing:'ease-out'}).onfinish=()=>ring.remove();
  for(let i=0;i<(record.multiplier>1?54:30);i++){const particle=document.createElement('i');particle.className=i%5===0?'spark-star':'particle';particle.textContent=i%5===0?'✳':'';particle.style.cssText=`left:${cx}px;top:${cy}px;--particle:${['#e96f36','#c0e47a','#203d31','#edbb3d'][i%4]}`;effects.append(particle);const angle=Math.PI*2*i/30,d=100+Math.random()*280;particle.animate([{transform:'translate(0,0) rotate(0deg) scale(1)',opacity:1},{transform:`translate(${Math.cos(angle)*d}px,${Math.sin(angle)*d-70}px) rotate(${i*53}deg) scale(.3)`,opacity:0}],{duration:700+Math.random()*550,easing:'cubic-bezier(.1,.7,.3,1)'}).onfinish=()=>particle.remove();}
  const flying=document.createElement('b');flying.className='flying-points';flying.textContent=`+${fmt(record.total)}`;flying.style.cssText=`left:${rect.left+rect.width*.6}px;top:${rect.bottom-60}px`;effects.append(flying);const target=score.getBoundingClientRect();flying.animate([{transform:'translate(-50%,0) scale(1.4)',opacity:1},{transform:`translate(${target.left-cx}px,${target.top-(rect.bottom-60)}px) scale(.4)`,opacity:0}],{duration:1000,delay:300,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'}).onfinish=()=>flying.remove();
}
document.querySelector('#help-button').addEventListener('click',()=>document.querySelector('#help-dialog').showModal());document.querySelectorAll('[data-close-dialog]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelector('#sound-button').addEventListener('click',event=>{sound=!sound;write('cross-examination:sound',String(sound));event.currentTarget.textContent=`Sound ${sound?'on':'off'}`;event.currentTarget.setAttribute('aria-pressed',String(sound));if(sound){armAudio();playSound('hit',1);}});
async function load(){
  try{const response=await fetch(new URL('../content/manifest.json?v=6',import.meta.url));if(!response.ok)throw new Error('The daily schedule could not load.');manifest=await response.json();day=utcDay();const item=dailyTopic(manifest,day);const bank=await fetch(new URL(`../content/${item.file}?v=6`,import.meta.url));if(!bank.ok)throw new Error('Today’s debate could not load.');debate=playableDebate(await bank.json());if(debate.id!==item.id)throw new Error('The debate has the wrong bank.');sound=read('cross-examination:sound')!=='false';document.querySelector('#sound-button').textContent=`Sound ${sound?'on':'off'}`;document.querySelector('#sound-button').setAttribute('aria-pressed',String(sound));const saved=restoreRun(read(runKey()));run=saved&&saved.day===day&&saved.debate.id===debate.id&&saved.debate.version===debate.version?saved:null;if(run){debate=run.debate;render();}else renderHome();setInterval(()=>updateClock(),120);document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateClock(false);});}catch(error){main.innerHTML=`<div class="load-error"><h1>We lost the argument.</h1><p>${h(error.message)}</p><a href="./">Try again ↗</a></div>`;}
}
load();
