import { matchInput } from './matcher.js?v=5';
const DAY = 86_400_000;
export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export function dailyTopic(manifest, day = utcDay()) {
  if (manifest.version !== 4 || !Array.isArray(manifest.topics) || !manifest.topics.length || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid daily schedule.');
  const offset = Math.round((Date.parse(day + 'T00:00:00Z') - Date.parse(manifest.epoch + 'T00:00:00Z')) / DAY);
  if (!Number.isFinite(offset)) throw new Error('Invalid daily schedule.');
  return manifest.topics[((offset % manifest.topics.length) + manifest.topics.length) % manifest.topics.length];
}
export function assertDebate(debate) {
  if (!debate || debate.schemaVersion !== 4 || typeof debate.id !== 'string' || typeof debate.question !== 'string' || !Number.isInteger(debate.version) ||
      debate.rules?.turns !== 6 || debate.rules.secondsPerTurn !== 45 || debate.rules.basePoints !== 100 || debate.rules.maxWords !== 6 || debate.rules.maxCharacters !== 60 ||
      !Array.isArray(debate.turns) || debate.turns.length !== 6 || !Array.isArray(debate.examples) || !debate.examples.length) throw new Error('Unsupported debate bank.');
  const claims = new Map(), turnIds = new Set(), examples = new Map();
  for (const [index, turn] of debate.turns.entries()) {
    if (!turn.id || turnIds.has(turn.id) || turn.side !== (index % 2 ? 'against' : 'for') || typeof turn.text !== 'string' || !Array.isArray(turn.claims) || !turn.claims.length) throw new Error('Invalid prepared argument.');
    turnIds.add(turn.id); const ranges = [];
    for (const claim of turn.claims) {
      const start = turn.text.indexOf(claim.text);
      if (!claim.id || claims.has(claim.id) || !claim.text || start < 0 || turn.text.indexOf(claim.text, start + 1) !== -1 ||
          ranges.some(([a,b]) => start < b && start + claim.text.length > a) || typeof claim.hint !== 'string') throw new Error('Invalid clickable claim.');
      ranges.push([start,start + claim.text.length]); claims.set(claim.id,{...claim,index});
    }
  }
  for (const example of debate.examples) {
    if (!example.id || examples.has(example.id) || typeof example.answer !== 'string' || !Array.isArray(example.aliases) ||
        !example.aliases.every(name => typeof name === 'string') || !Array.isArray(example.counters) || !example.counters.length || !Array.isArray(example.selfCounters)) throw new Error('Invalid counterexample.');
    const targets = new Set();
    for (const counter of example.counters) {
      if (!claims.has(counter.claimId) || targets.has(counter.claimId) || typeof counter.explanation !== 'string') throw new Error('Invalid counterexample target.');
      targets.add(counter.claimId);
    }
    examples.set(example.id,example);
  }
  for (const example of examples.values()) for (const edge of example.selfCounters) {
    const target = examples.get(edge.targetId);
    if (!target || target.id === example.id || !example.counters.some(link => link.claimId === edge.claimId) ||
        !target.counters.some(link => link.claimId === edge.targetClaimId) || claims.get(edge.targetClaimId).index >= claims.get(edge.claimId).index || typeof edge.explanation !== 'string') throw new Error('Invalid self-counter link.');
  }
  for (const claim of claims.values()) if (![...examples.values()].some(example => example.counters.some(link => link.claimId === claim.id))) throw new Error('Claim has no examples.');
  return debate;
}
export function playableDebate(debate) {
  assertDebate(debate);
  return structuredClone({ schemaVersion:4,id:debate.id,version:debate.version,question:debate.question,shortTitle:debate.shortTitle,scope:debate.scope,rules:debate.rules,
    turns:debate.turns.map(({id,side,text,claims})=>({id,side,text,claims:claims.map(({id,text,hint,rejected})=>({id,text,hint,...(rejected?{rejected}:{})}))})),
    examples:debate.examples.map(({id,answer,aliases,counters,selfCounters})=>({id,answer,aliases,counters,selfCounters})) });
}
export function createRun(debate, day = utcDay(), now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Invalid day.');
  return {storageVersion:4,debate:playableDebate(debate),day,phase:'turn',history:[],selectedClaimId:null,draft:'',startedAt:now,deadline:now+debate.rules.secondsPerTurn*1000,completedAt:null};
}
export const totalScore = run => run.history.reduce((sum,record)=>sum+record.total,0);
export const currentArgument = run => run.debate.turns[run.phase === 'reveal' ? run.history.length-1 : Math.min(run.history.length,5)];
export const usedIds = run => run.history.filter(record=>record.entryId).map(record=>record.entryId);
export function selectClaim(run,claimId) {
  if (run.phase !== 'turn' || !currentArgument(run).claims.some(claim=>claim.id === claimId)) throw new Error('Choose a phrase in this argument.');
  return {...run,selectedClaimId:claimId};
}
const pools = new WeakMap();
const identityPools = new WeakMap();
// Recognize a repeated name before checking its new target. A repeat must not
// look like an unexplained content rejection when it was accepted earlier.
export function matchCounterInput(run, raw, claimId = run.selectedClaimId) {
  if (!identityPools.has(run.debate)) identityPools.set(run.debate, {entries:run.debate.examples,rejected:[]});
  const identity = matchInput(identityPools.get(run.debate), raw, usedIds(run));
  if (identity.kind === 'already-used' && identity.matchType !== 'typo') return identity;
  return matchInput(matchingPool(run.debate, claimId), raw, usedIds(run));
}
export function matchingPool(debate,claimId) {
  if (!pools.has(debate)) pools.set(debate,new Map());
  const cache=pools.get(debate); if(cache.has(claimId))return cache.get(claimId);
  const claim=debate.turns.flatMap(turn=>turn.claims).find(claim=>claim.id===claimId);
  if (!claim) throw new Error('Unknown claim.');
  const eligible=debate.examples.filter(example=>example.counters.some(link=>link.claimId===claimId));
  const rejected=[...(claim.rejected??[]),...debate.examples.filter(example=>!eligible.includes(example)).map(example=>({answer:example.answer,aliases:example.aliases,reason:'No match for this phrase. Try another example, or a different part of the argument.'}))];
  const pool={entries:eligible.map(example=>({...example,points:100,explanation:example.counters.find(link=>link.claimId===claimId).explanation})),rejected};
  cache.set(claimId,pool);return pool;
}
export function scoreExample(run,example,claimId) {
  for(let index=run.history.length-1;index>=0;index--){
    const earlier=run.history[index];
    const edge=example.selfCounters.find(edge=>edge.claimId===claimId&&edge.targetId===earlier.entryId&&edge.targetClaimId===earlier.claimId);
    if(edge)return {basePoints:100,multiplier:earlier.multiplier*2,total:100*earlier.multiplier*2,chainTargetIndex:index,chainExplanation:edge.explanation};
  }
  return {basePoints:100,multiplier:1,total:100,chainTargetIndex:null,chainExplanation:null};
}
export function possibleChain(run,claimId) {
  return run.debate.examples.filter(example=>!usedIds(run).includes(example.id)&&example.counters.some(link=>link.claimId===claimId))
    .map(example=>({example,...scoreExample(run,example,claimId)})).filter(result=>result.multiplier>1).sort((a,b)=>b.multiplier-a.multiplier)[0]??null;
}
export function commitTurn(run,move,now=Date.now()) {
  if(run.phase!=='turn'||run.history.length>=6)return run;
  if(now>=run.deadline)move={kind:'timeout'};
  if(!['answer','skip','timeout'].includes(move.kind))throw new Error('Unknown move.');
  const argument=currentArgument(run),claimId=move.claimId??run.selectedClaimId;
  const example=move.kind==='answer'?run.debate.examples.find(example=>example.id===move.entryId):null;
  if(move.kind==='answer'&&(!example||!argument.claims.some(claim=>claim.id===claimId)||usedIds(run).includes(example.id)||!example.counters.some(link=>link.claimId===claimId)))throw new Error('That example cannot counter this phrase.');
  const score=example?scoreExample(run,example,claimId):{basePoints:0,multiplier:1,total:0,chainTargetIndex:null,chainExplanation:null};
  return {...run,phase:'reveal',deadline:null,draft:'',selectedClaimId:null,history:[...run.history,{turnId:argument.id,side:argument.side,kind:move.kind,entryId:example?.id??null,claimId:example?claimId:null,input:example?String(move.input??example.answer).slice(0,60):'',explanation:example?.counters.find(link=>link.claimId===claimId).explanation??null,...score}]};
}
export function advanceRun(run,now=Date.now()) {
  if(run.phase!=='reveal')return run;
  if(run.history.length===6)return {...run,phase:'complete',completedAt:now,deadline:null};
  return {...run,phase:'turn',selectedClaimId:null,draft:'',deadline:now+run.debate.rules.secondsPerTurn*1000};
}
export function restoreRun(raw,now=Date.now()) {
  try {
    const saved=typeof raw==='string'?JSON.parse(raw):raw;
    if(!saved||saved.storageVersion!==4||!Array.isArray(saved.history)||!Number.isFinite(saved.startedAt)||!['turn','reveal','complete'].includes(saved.phase))return null;
    let run=createRun(saved.debate,saved.day,saved.startedAt);
    for(const [index,record]of saved.history.entries()){
      if(run.phase!=='turn'||record.turnId!==currentArgument(run).id||record.side!==currentArgument(run).side)return null;
      run=commitTurn({...run,deadline:Number.MAX_SAFE_INTEGER},{kind:record.kind,entryId:record.entryId,claimId:record.claimId,input:record.input},0);
      if(index<saved.history.length-1||saved.phase!=='reveal')run=advanceRun(run,saved.completedAt??saved.startedAt);
    }
    if(run.phase!==saved.phase)return null;
    if(run.phase==='turn'){
      if(!Number.isFinite(saved.deadline))return null;
      run={...run,deadline:saved.deadline,draft:typeof saved.draft==='string'?saved.draft.slice(0,60):''};
      if(saved.selectedClaimId!==null)run=selectClaim(run,saved.selectedClaimId);
      if(now>=run.deadline)run=commitTurn(run,{kind:'timeout'},now);
    }
    return run;
  }catch{return null;}
}
export function shareText(run) {
  const chain=Math.max(1,...run.history.map(record=>record.multiplier));
  return `Cross Examination · ${run.day}\n${run.debate.question}\n${run.history.map(record=>record.multiplier>1?'✳':record.kind==='answer'?'●':'○').join(' ')}\n${totalScore(run)} points · ×${chain} best chain\n6 arguments · 45 seconds each · Counter yourself.`;
}
