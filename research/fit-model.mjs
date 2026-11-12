import {mixture,normalCdf,ksGap} from './math.mjs';

/** Cache exact numerical evaluations for one fixed teaching sample. */
export function createFitEvaluator(samples,{steps=512,capacity=24}={}) {
  const values=Float64Array.from(samples);
  if(!values.length || values.some(x=>!Number.isFinite(x)))throw new RangeError('A finite sample is required.');
  const moment=values.reduce((total,x)=>total+x*x,0)/values.length;
  const range=Math.max(3,...values.map(Math.abs))*1.08;
  const sorted=Array.from(values).sort((a,b)=>a-b);
  const empirical=[[-range,0]];
  sorted.forEach((x,index)=>empirical.push([x,index/values.length],[x,(index+1)/values.length]));
  empirical.push([range,1]);
  const cache=new Map();
  function evaluate(kind,parameters={r:1,eta:-.5,vartheta:2},factor=1) {
    if(!(factor>0)||!Number.isFinite(factor))throw new RangeError('Width must be positive and finite.');
    if(!['normal','laplace','family'].includes(kind))throw new RangeError('Unknown candidate.');
    const key=JSON.stringify(kind==='family'?[kind,factor,parameters.r,parameters.eta,parameters.vartheta]:[kind,factor]);
    if(cache.has(key))return cache.get(key);
    const sd=Math.sqrt(moment)*factor;
    const cdf=kind==='normal'?x=>normalCdf(x,0,sd):kind==='laplace'
      ? x=>x<0?.5*Math.exp(x/(sd/Math.SQRT2)):1-.5*Math.exp(-x/(sd/Math.SQRT2))
      : mixture(parameters.r,parameters.eta,parameters.vartheta*factor*factor,{steps}).cdf;
    const result={cdf,gap:ksGap(values,cdf),curve:Array.from({length:241},(_,i)=>{const x=-range+2*range*i/240;return [x,cdf(x)];})};
    cache.set(key,result);
    if(cache.size>capacity)cache.delete(cache.keys().next().value);
    return result;
  }
  return {evaluate,range,empirical,moment};
}
