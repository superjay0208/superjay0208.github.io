import assert from 'node:assert/strict';
import {createFitEvaluator} from '../fit-model.mjs';
import {mixture,createRng,ksGap,normalCdf} from '../math.mjs';
const samples=mixture(.65,-.4,.45).samples(240,createRng(91021));
const evaluator=createFitEvaluator(samples);
for(const parameters of [{r:1,eta:-.5,vartheta:2},{r:-1,eta:-2,vartheta:.5},{r:.35,eta:-.25,vartheta:.0185}]){
  for(const factor of [.5,1,2]){
    const actual=evaluator.evaluate('family',parameters,factor);
    const independent=mixture(parameters.r,parameters.eta,parameters.vartheta*factor*factor,{steps:512});
    assert.deepEqual(actual.gap,ksGap(samples,independent.cdf));
    actual.curve.forEach(([x,value])=>assert(Math.abs(value-independent.cdf(x))<1e-14));
    assert.equal(evaluator.evaluate('family',parameters,factor),actual,'Unchanged candidates reuse their complete numerical evaluation.');
  }
}
const normal=evaluator.evaluate('normal'),sd=Math.sqrt(samples.reduce((a,b)=>a+b*b,0)/samples.length);
assert.deepEqual(normal.gap,ksGap(samples,x=>normalCdf(x,0,sd)));
assert.equal(evaluator.empirical.length,2*samples.length+2);
assert(evaluator.empirical.every((point,i,all)=>i===0||point[1]>=all[i-1][1]));
const next=createFitEvaluator(mixture(.65,-.4,.45).samples(240,createRng(91022)));
assert.notDeepEqual(next.evaluate('family').gap,evaluator.evaluate('family').gap,'New samples do not reuse an old fitted comparison.');
assert.throws(()=>evaluator.evaluate('unknown'));assert.throws(()=>evaluator.evaluate('normal',undefined,0));
console.log('PASS: cached KS gaps and all plotted CDF values match independent numerical models, including scale changes, Cauchy, and new samples.');
