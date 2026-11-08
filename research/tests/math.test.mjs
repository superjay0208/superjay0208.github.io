import assert from 'node:assert/strict';
import {logGamma,normalPdf,normalCdf,createRng,sampleGamma,mixture,sampleMixture,ksGap,haar2D,inverseHaar2D} from '../math.mjs';

const near=(actual,expected,tolerance=1e-6,label='')=>assert.ok(Math.abs(actual-expected)<=tolerance,`${label}: expected ${expected}, received ${actual}`);
const checks=[];
function check(name,run){run();checks.push(name);}
const integrate=(fn,a,b,steps=6000)=>{
  let sum=fn(a)+fn(b);
  for(let i=1;i<steps;i++)sum+=(i%2?4:2)*fn(a+(b-a)*i/steps);
  return sum*(b-a)/steps/3;
};

check('Gamma identities and Gaussian benchmarks',()=>{
  near(logGamma(1),0,2e-14);
  near(logGamma(0.5),Math.log(Math.sqrt(Math.PI)),2e-14);
  near(logGamma(6),Math.log(120),2e-14);
  near(normalPdf(0),1/Math.sqrt(2*Math.PI),1e-15);
  near(normalCdf(0),0.5,0);
  near(normalCdf(1),0.8413447460685429,8e-8);
  near(normalCdf(-3),0.0013498980316301,8e-8);
});

check('Exact Laplace mixture: r=1, eta=-0.5, vartheta=2 gives b=1',()=>{
  const model=mixture(1,-0.5,2);
  near(model.variance,2,1e-12);
  for(const x of [-10,-5,-2,-.5,-.001,0,.001,.5,2,5,10]){
    const density=Math.exp(-Math.abs(x))/2;
    const distribution=x<0?Math.exp(x)/2:1-Math.exp(-x)/2;
    near(model.pdf(x),density,2e-7,`Laplace PDF ${x}`);
    near(model.cdf(x),distribution,2e-7,`Laplace CDF ${x}`);
  }
  near(integrate(model.pdf,-18,18),1,2e-7,'Laplace normalization');
});

check('Exact Cauchy mixture and non-existing mean/variance',()=>{
  const model=mixture(-1,-2,.5);
  assert.equal(model.finiteVariance,false);
  assert.equal(model.variance,Infinity);
  assert.equal(model.finiteMean,false);
  assert.ok(Number.isNaN(model.mean));
  for(const x of [-25,-5,-1,-.01,0,.01,1,5,25]){
    near(model.pdf(x),1/(Math.PI*(1+x*x)),2e-7,`Cauchy PDF ${x}`);
    near(model.cdf(x),.5+Math.atan(x)/Math.PI,2e-7,`Cauchy CDF ${x}`);
  }
  // Finite-interval Cauchy mass has an exact value; do not treat truncated tails as missing normalization.
  near(integrate(model.pdf,-20,20),2*Math.atan(20)/Math.PI,2e-7,'Cauchy finite interval mass');
});

check('Symmetry, monotone CDFs, valid weights, and resolution convergence',()=>{
  const settings=[[.35,-.75,.03],[.35,3,8],[2.5,-.75,.03],[2.5,3,8],[-2,-1.7,.03],[-.4,-1.7,8],[-2,-5,8],[-.4,-5,.03]];
  for(const parameters of settings){
    const model=mixture(...parameters);
    const finer=mixture(...parameters,{steps:4096});
    assert.ok(model.components.every(c=>c.weight>0&&c.variance>0));
    near(model.components.reduce((sum,c)=>sum+c.weight,0),1,3e-14);
    near(model.quadratureMass,1,2e-8,'quadrature mass');
    let previous=0;
    for(const x of [-100,-10,-2,-.25,0,.25,2,10,100]){
      const cdf=model.cdf(x);
      assert.ok(cdf>=previous&&cdf>=0&&cdf<=1);
      previous=cdf;
      near(model.cdf(-x),1-cdf,3e-14);
      near(model.pdf(-x),model.pdf(x),3e-14);
      near(cdf,finer.cdf(x),1e-5,`CDF convergence ${parameters},x=${x}`);
      near(model.pdf(x),finer.pdf(x),1e-5*Math.max(1,model.pdf(x)),`PDF convergence ${parameters},x=${x}`);
    }
  }
  assert.equal(mixture(1,-1,1).pdf(0),Infinity);
  assert.throws(()=>mixture(0,1,1),RangeError);
  assert.throws(()=>mixture(1,-2,1),RangeError);
});

check('Analytical moments agree with actual hierarchical sampling',()=>{
  const rng=createRng(20261107);
  const gamma=Array.from({length:60000},()=>sampleGamma(.5,rng));
  near(gamma.reduce((sum,g)=>sum+g,0)/gamma.length,.5,.012,'Gamma shape .5 mean');
  const model=mixture(1,-.5,2);
  const sample=sampleMixture(90000,1,-.5,2,createRng(251217038));
  const mean=sample.reduce((sum,x)=>sum+x,0)/sample.length;
  const variance=sample.reduce((sum,x)=>sum+x*x,0)/sample.length-mean*mean;
  near(mean,0,.025,'Laplace sample mean');
  near(variance,model.variance,.06,'Laplace sample variance');
  assert.ok(ksGap(sample,model.cdf).d<.012,'Actual samples follow the numerical mixture CDF');
  near(mixture(-1,-4,2).variance,2/(2.5-1),1e-12,'inverse gamma variance moment');
  const one=createRng(7),two=createRng(7);
  for(let i=0;i<10;i++)near(one(),two(),0,'seed reproducibility');
});

check('KS checks left/right jumps and duplicates, without inventing a p-value',()=>{
  const left=ksGap([.9],x=>x);
  near(left.d,.9,0);assert.equal(left.side,'left');near(left.empirical,0,0);
  const right=ksGap([.1],x=>x);
  near(right.d,.9,0);assert.equal(right.side,'right');near(right.empirical,1,0);
  near(ksGap([.2,.2,.8],x=>x).d,2/3-.2,1e-15);
  assert.throws(()=>ksGap([],normalCdf),RangeError);
  assert.throws(()=>ksGap([Infinity],normalCdf),RangeError);
});

check('Haar transform preserves energy and reconstructs square/rectangular images',()=>{
  for(const [width,height] of [[8,8],[16,8],[4,16],[1,8],[8,1]]){
    const values=Float64Array.from({length:width*height},(_,i)=>Math.sin(i*.37)+Math.cos(i*.73));
    const transformed=haar2D(values,width,height);
    const recovered=inverseHaar2D(transformed);
    const energy=data=>data.reduce((sum,x)=>sum+x*x,0);
    near(energy(values),energy(transformed.coefficients),1e-10,'Haar energy');
    values.forEach((value,i)=>near(recovered[i],value,3e-14,'Haar reconstruction'));
  }
  const flat=haar2D(new Float64Array(64).fill(3),8);
  near(flat.coefficients[0],24,1e-12,'Haar DC coefficient');
  flat.coefficients.slice(1).forEach(value=>near(value,0,1e-14,'Flat image detail'));
});

console.log(JSON.stringify({passed:checks.length,checks},null,2));
