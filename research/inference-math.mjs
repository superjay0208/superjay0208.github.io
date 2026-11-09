/**
 * A separate teaching denoiser, not a reconstruction experiment from the paper.
 * Observed signal Y = f + sigma Z, with independent standard-normal Z.
 * Orthonormal Haar transforms preserve this noise covariance. Each non-DC
 * coefficient gets an independent prior and its marginal posterior mode.
 */
import { haar2D, inverseHaar2D, createRng, sampleNormal } from './math.mjs';

export const NORMAL_QUARTILE = 0.6744897501960817;
export const SIGNAL_LENGTH = 128;

export function makeSignal(kind = 'steps', n = SIGNAL_LENGTH) {
  if (!['steps', 'needle', 'smooth'].includes(kind)) throw new RangeError('Unknown signal.');
  return Float64Array.from({ length:n }, (_,i) => {
    const t = i / n;
    if (kind === 'steps') return t < .25 ? .22 : t < .5 ? .8 : t < .75 ? .4 : .65;
    if (kind === 'needle') return .25 + .12 * Math.sin(2*Math.PI*t) + (i === Math.floor(n*.625) ? 1.05 : 0);
    return .5 + .27*Math.sin(2*Math.PI*t) + .12*Math.sin(6*Math.PI*t + .6);
  });
}

export function standardNoise(n = SIGNAL_LENGTH, seed = 17038) {
  const random = createRng(seed);
  return Float64Array.from({ length:n }, () => sampleNormal(random));
}

/** q is the positive quartile: all priors put half their mass in [-q, q]. */
export function priorScale(kind, q) {
  if (!(q > 0) || !Number.isFinite(q)) throw new RangeError('Prior quartile must be finite and positive.');
  if (kind === 'normal') return q / NORMAL_QUARTILE;
  if (kind === 'laplace') return q / Math.LN2;
  if (kind === 'cauchy') return q;
  throw new RangeError('Unknown prior.');
}

/** Negative log prior, with constants independent of x omitted. */
export function priorPenalty(x, kind, q) {
  const scale = priorScale(kind, q);
  if (kind === 'normal') return .5*(x/scale)**2;
  if (kind === 'laplace') return Math.abs(x)/scale;
  return Math.log1p((x/scale)**2);
}

export function posteriorObjective(x, y, sigma, kind, q) {
  return .5*((x-y)/sigma)**2 + priorPenalty(x,kind,q);
}

/**
 * All stationary points of the Cauchy posterior lie between 0 and y (or its
 * reflected interval). Solve the cubic on each monotone interval separated by
 * its derivative's real roots, then compare their objectives. Unlike one Newton
 * solve, this handles bimodal posteriors and selects the global mode.
 */
export function cauchyMap(y, sigma, gamma) {
  if (!Number.isFinite(y) || !(sigma >= 0) || !Number.isFinite(sigma) || !(gamma > 0) || !Number.isFinite(gamma)) throw new RangeError('Invalid Cauchy MAP parameters.');
  if (!sigma || !y) return y;
  const magnitude = Math.abs(y), sign = Math.sign(y);
  const a = gamma*gamma + 2*sigma*sigma;
  const p = x => ((x-magnitude)*x+a)*x-magnitude*gamma*gamma;
  const split = [0,magnitude];
  const discriminant = magnitude*magnitude-3*a;
  if (discriminant > 0) {
    const root = Math.sqrt(discriminant);
    for (const point of [(magnitude-root)/3,(magnitude+root)/3]) {
      if (point > 0 && point < magnitude) split.push(point);
    }
  }
  split.sort((a,b)=>a-b);
  const candidates = [...split];
  for (let i=0; i<split.length-1; i++) {
    let left=split[i], right=split[i+1];
    let fLeft=p(left), fRight=p(right);
    if (fLeft*fRight > 0) continue;
    if (fLeft === 0) { candidates.push(left); continue; }
    if (fRight === 0) { candidates.push(right); continue; }
    for (let j=0; j<70; j++) {
      const midpoint = (left+right)/2, fMid=p(midpoint);
      if (fMid === 0) { left=right=midpoint; break; }
      if (fLeft*fMid <= 0) { right=midpoint; fRight=fMid; }
      else { left=midpoint; fLeft=fMid; }
    }
    candidates.push((left+right)/2);
  }
  let best=0, bestValue=Infinity;
  for (const value of candidates) {
    const score = .5*((value-magnitude)/sigma)**2 + Math.log1p((value/gamma)**2);
    if (score < bestValue) { best=value; bestValue=score; }
  }
  return sign*best;
}

export function coefficientMap(y, sigma, kind, q) {
  if (!Number.isFinite(y) || !(sigma >= 0) || !Number.isFinite(sigma)) throw new RangeError('Invalid observation or noise.');
  const scale=priorScale(kind,q);
  if (!sigma) return y;
  if (kind === 'normal') return y*scale*scale/(scale*scale+sigma*sigma);
  if (kind === 'laplace') return Math.sign(y)*Math.max(0,Math.abs(y)-sigma*sigma/scale);
  return cauchyMap(y,sigma,scale);
}

export function rmse(a,b) {
  if (a.length !== b.length || !a.length) throw new RangeError('RMSE arrays must be nonempty and equal length.');
  return Math.sqrt(a.reduce((total,value,i)=>total+(value-b[i])**2,0)/a.length);
}

export function recoverSignal(truth, noise, sigma, kind, q) {
  if (truth.length !== noise.length) throw new RangeError('Signal and noise lengths differ.');
  const observed=Float64Array.from(truth,(value,i)=>value+sigma*noise[i]);
  const transform=haar2D(observed,truth.length,1);
  const estimates=transform.coefficients.map((value,index)=>index===0?value:coefficientMap(value,sigma,kind,q));
  const recovered=inverseHaar2D({...transform,coefficients:estimates});
  return { observed,recovered,coefficients:transform.coefficients,estimates,noisyError:rmse(observed,truth),recoveredError:rmse(recovered,truth) };
}

export function coefficientSupport(index,n=SIGNAL_LENGTH) {
  if (!Number.isInteger(index) || index < 1 || index >= n) throw new RangeError('Choose a non-DC coefficient.');
  const first=2**Math.floor(Math.log2(index));
  const span=n/first;
  const start=(index-first)*span;
  return { start,mid:start+span/2,end:start+span,span };
}

/** Fixed, honest control mapping; no access to the truth or optimal RMSE. */
export function strengthToQuartile(strength) {
  return .8*Math.pow(.025/.8,strength/100);
}
