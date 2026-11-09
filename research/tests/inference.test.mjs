import assert from 'node:assert/strict';
import { normalCdf, mixture, haar2D } from '../math.mjs';
import { makeSignal, standardNoise, priorScale, priorPenalty, posteriorObjective, coefficientMap, cauchyMap, recoverSignal, coefficientSupport, strengthToQuartile, rmse } from '../inference-math.mjs';

const near=(actual,expected,tolerance=1e-10)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} differs from ${expected}`);

// Same IQR, rather than undefined Cauchy variance, provides the comparison scale.
for(const q of [.025,.14,.8]) {
  near(2*normalCdf(q,0,priorScale('normal',q))-1,.5,2e-7);
  near(1-Math.exp(-q/priorScale('laplace',q)),.5);
  near(2*Math.atan(q/priorScale('cauchy',q))/Math.PI,.5);
  const laplace=mixture(1,-.5,2*priorScale('laplace',q)**2);
  const cauchy=mixture(-1,-2,q*q/2);
  for(const x of [-2*q,0,q,4*q]) {
    near(-Math.log(laplace.pdf(x)/laplace.pdf(0)),priorPenalty(x,'laplace',q),1e-6);
    near(-Math.log(cauchy.pdf(x)/cauchy.pdf(0)),priorPenalty(x,'cauchy',q),1e-6);
  }
}
console.log('PASS: equal quartiles and paper-consistent Laplace/Cauchy scales');

// Known analytic identities, including exact soft-threshold ties and symmetry.
for(const y of [-2,-.5,0,.1,.8,3])for(const sigma of [.02,.18,.4])for(const q of [.025,.15,.8]) {
  const tau=priorScale('normal',q),b=priorScale('laplace',q);
  near(coefficientMap(y,sigma,'normal',q),y*tau*tau/(tau*tau+sigma*sigma));
  near(coefficientMap(y,sigma,'laplace',q),Math.sign(y)*Math.max(Math.abs(y)-sigma*sigma/b,0));
  for(const kind of ['normal','laplace','cauchy']) {
    near(coefficientMap(-y,sigma,kind,q),-coefficientMap(y,sigma,kind,q));
    near(coefficientMap(y,0,kind,q),y);
  }
}
near(coefficientMap(.09,Math.sqrt(.09),'laplace',Math.LN2),0);
console.log('PASS: analytic Gaussian/Laplace MAP, zero noise, sign symmetry');

// A nonconvex Cauchy posterior can have two local minima. Verify the chosen mode
// beats a dense independent objective scan for easy and multimodal cases.
let nonconvexCases=0;
for(const y of [.005,.1,.4,.6,.8,1,1.4,2,3,5])for(const sigma of [.02,.08,.18,.4,.8])for(const gamma of [.025,.06,.15,.8]) {
  const estimate=cauchyMap(y,sigma,gamma);
  assert.ok(estimate>=0 && estimate<=y);
  const objective=x=>posteriorObjective(x,y,sigma,'cauchy',gamma);
  const chosen=objective(estimate);
  let scanned=Infinity, minima=0,previousSlope=null;
  for(let j=0;j<=10000;j++) {
    const x=y*j/10000;
    scanned=Math.min(scanned,objective(x));
    const slope=(x-y)/(sigma*sigma)+2*x/(gamma*gamma+x*x);
    if(previousSlope!==null && previousSlope<0 && slope>=0)minima++;
    previousSlope=slope;
  }
  if(minima>1)nonconvexCases++;
  assert.ok(chosen<=scanned+1e-10,`Missed global mode for y=${y}, sigma=${sigma}, gamma=${gamma}`);
  const derivative=(estimate-y)/(sigma*sigma)+2*estimate/(gamma*gamma+estimate*estimate);
  assert.ok(Math.abs(derivative)<1e-8,`Chosen mode is not stationary: ${derivative}`);
}
assert.ok(nonconvexCases>0,'Test set must contain multi-peak posterior cases');
console.log(`PASS: Cauchy global MAP against dense search, including ${nonconvexCases} nonconvex cases`);

const noise=standardNoise(128,17038);
assert.deepEqual(noise,standardNoise(128,17038));
assert.notDeepEqual(noise,standardNoise(128,17039));
for(const shape of ['steps','needle','smooth'])for(const kind of ['normal','laplace','cauchy']) {
  const truth=makeSignal(shape);
  const exact=recoverSignal(truth,noise,0,kind,.14);
  assert.ok(exact.recoveredError<1e-14);
  const result=recoverSignal(truth,noise,.18,kind,.14);
  near(result.estimates[0],result.coefficients[0]);
  const mean=values=>values.reduce((sum,x)=>sum+x,0)/values.length;
  near(mean(result.recovered),mean(result.observed),1e-14);
  const originalCoefficients=haar2D(truth,128,1).coefficients;
  near(rmse(result.estimates,originalCoefficients),result.recoveredError,1e-14);
  // Alter the hidden truth while leaving observed data unchanged: estimates must
  // not depend on ground truth used solely for the evaluation metric.
  const truth2=Float64Array.from(truth,x=>x+.2);
  const noise2=Float64Array.from(noise,x=>x-.2/.18);
  const sameObservation=recoverSignal(truth2,noise2,.18,kind,.14);
  result.recovered.forEach((value,i)=>near(value,sameObservation.recovered[i],1e-12));
}
console.log('PASS: reproducible noise, exact Haar recovery, preserved DC, error identity, no truth leakage');

for(let i=1;i<128;i++) {
  const support=coefficientSupport(i);
  assert.ok(support.start>=0 && support.end<=128 && support.span>=2);
  near(support.mid,(support.start+support.end)/2);
}
near(strengthToQuartile(0),.8);near(strengthToQuartile(100),.025);
assert.ok(strengthToQuartile(20)>strengthToQuartile(80));
assert.throws(()=>coefficientMap(1,.2,'unknown',.1),RangeError);
assert.throws(()=>cauchyMap(1,-1,.2),RangeError);
console.log('PASS: coefficient support, strength endpoints, invalid-input guards');
