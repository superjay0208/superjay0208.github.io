/**
 * Numerical tools for the generalized-gamma normal-variance mixture in
 * arXiv:2512.17038v3, equations (2)-(4). No external dependencies.
 *
 * Exact generative definition: G~Gamma(beta, rate=1), theta=vartheta*G^(1/r),
 * X=sqrt(theta)*Z, Z~N(0,1), beta=(eta+1.5)/r>0.
 *
 * PDF/CDF evaluation uses deterministic trapezoidal quadrature in log G.
 * Positive component weights are normalized after truncating negligible gamma
 * mass. This is a numerical mixture approximation, not the paper's fitted data
 * or its Appendix H implementation. Sampling uses the generative definition.
 */

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);
const INV_SQRT_TWO = Math.SQRT1_2;
const LANCZOS = [676.5203681218851,-1259.1392167224028,771.32342877765313,-176.61502916214059,12.507343278686905,-0.13857109526572012,9.9843695780195716e-6,1.5056327351493116e-7];

/** Natural logarithm of Gamma(z), for positive real z. */
export function logGamma(z) {
  if (!(z > 0) || !Number.isFinite(z)) throw new RangeError('Gamma requires a finite positive argument.');
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  const shifted = z - 1;
  let series = 0.99999999999980993;
  for (let i = 0; i < LANCZOS.length; i++) series += LANCZOS[i] / (shifted + i + 1);
  const t = shifted + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(series);
}

export function normalPdf(x, mean = 0, sd = 1) {
  if (!(sd > 0)) throw new RangeError('Standard deviation must be positive.');
  const z = (x - mean) / sd;
  return Math.exp(-0.5 * z * z) / (SQRT_TWO_PI * sd);
}

/** Gaussian CDF; the rational approximation has absolute error <8e-8. */
export function normalCdf(x, mean = 0, sd = 1) {
  if (!(sd > 0)) throw new RangeError('Standard deviation must be positive.');
  const z = (x - mean) / sd;
  if (z === 0) return 0.5;
  if (z === Infinity) return 1;
  if (z === -Infinity) return 0;
  const a = Math.abs(z);
  const t = 1 / (1 + 0.2316419 * a);
  const tail = Math.exp(-a * a / 2) / SQRT_TWO_PI * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z < 0 ? tail : 1 - tail;
}

/** Seeded, reproducible U(0,1) generator. Endpoints 0 and 1 are excluded. */
export function createRng(seed = 251217038) {
  let state = Number(seed) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (((value ^ (value >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
}

export function sampleNormal(rng = Math.random) {
  let u = rng();
  while (u <= 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

/** Marsaglia-Tsang Gamma(shape, rate=1) rejection sampler. */
export function sampleGamma(shape, rng = Math.random) {
  if (!(shape > 0) || !Number.isFinite(shape)) throw new RangeError('Gamma shape must be finite and positive.');
  if (shape < 1) {
    let uniform = rng();
    while (uniform <= 0) uniform = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(uniform, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    const x = sampleNormal(rng);
    let v = 1 + c * x;
    if (v <= 0) continue;
    v = v * v * v;
    const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function validateParameters(r, eta, vartheta) {
  if (!Number.isFinite(r) || r === 0 || !Number.isFinite(eta) || !(vartheta > 0) || !Number.isFinite(vartheta)) {
    throw new RangeError('Require finite r≠0, finite eta, and finite vartheta>0.');
  }
  const beta = (eta + 1.5) / r;
  if (!(beta > 0) || !Number.isFinite(beta)) throw new RangeError('Require beta=(eta+1.5)/r>0.');
  return beta;
}

/** Generate samples from the actual continuous mixture, not its quadrature. */
export function sampleMixture(n, r, eta, vartheta = 1, rng = Math.random) {
  const beta = validateParameters(r, eta, vartheta);
  if (!Number.isInteger(n) || n < 0) throw new RangeError('Sample count must be a nonnegative integer.');
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const g = sampleGamma(beta, rng);
    const logSd = 0.5 * (Math.log(vartheta) + Math.log(g) / r);
    result[i] = Math.exp(logSd) * sampleNormal(rng);
  }
  return result;
}

/**
 * Construct a reusable PDF/CDF evaluator. Recommended teaching ranges:
 * r∈[.35,2.5], eta∈[-.75,3], or r∈[-2,-.4], eta∈[-5,-1.7].
 * The parameter constraint beta>0 is always enforced. A divergent density at
 * zero is explicitly Infinity; moments are Infinity/NaN when they do not exist.
 * The default 1024 steps is benchmarked against exact Laplace and Cauchy laws.
 */
export function mixture(r, eta, vartheta = 1, { steps = 1024 } = {}) {
  const beta = validateParameters(r, eta, vartheta);
  if (!Number.isInteger(steps) || steps < 32 || steps > 32768) throw new RangeError('Quadrature steps must be an integer from 32 to 32768.');
  if (steps % 2) steps++;
  const logGammaBeta = logGamma(beta);
  const logVartheta = Math.log(vartheta);
  const peakExponent = beta - 1 / (2 * r);
  const peakFinite = peakExponent > 0;
  let minimum = Math.min(Math.log(beta) - 12, (Math.log(1e-12) + logGamma(beta + 1)) / beta);
  // For a finite peak, resolve the inverse-square-root moment as well as mass.
  if (r > 0 && peakFinite) minimum = Math.min(minimum, -36 / peakExponent);
  const maximum = Math.log(beta + 25 * Math.sqrt(beta) + 100);
  const increment = (maximum - minimum) / steps;
  const components = [];
  let mass = 0;
  for (let i = 0; i <= steps; i++) {
    const t = minimum + i * increment;
    const gammaLogWeight = beta * t - Math.exp(t) - logGammaBeta;
    // The transformed integrand is smooth with vanishing endpoint derivatives;
    // trapezoidal quadrature is especially accurate on this near-infinite grid.
    const endpoint = i === 0 || i === steps ? 0.5 : 1;
    const weight = Math.exp(gammaLogWeight) * endpoint * increment;
    if (weight === 0) continue;
    const logVariance = logVartheta + t / r;
    const sd = Math.exp(logVariance / 2);
    components.push({ weight, variance: Math.exp(logVariance), logVariance, sd, invSd: 1 / sd });
    mass += weight;
  }
  if (!(mass > 0) || !Number.isFinite(mass)) throw new RangeError('Quadrature could not resolve this parameter combination.');
  components.forEach(component => { component.weight /= mass; });
  const finiteVariance = beta + 1 / r > 0;
  const finiteMean = beta + 1 / (2 * r) > 0;
  const variance = finiteVariance ? Math.exp(logVartheta + logGamma(beta + 1 / r) - logGammaBeta) : Infinity;
  const peak = peakFinite ? Math.exp(logGamma(peakExponent) - logGammaBeta - 0.5 * logVartheta) / SQRT_TWO_PI : Infinity;

  const pdf = x => {
    if (x === 0) return peak;
    if (x === Infinity || x === -Infinity) return 0;
    let total = 0;
    for (const component of components) {
      const z = x * component.invSd;
      total += component.weight * Math.exp(-0.5 * z * z) * component.invSd / SQRT_TWO_PI;
    }
    return total;
  };
  const cdf = x => {
    if (x === 0) return 0.5;
    if (x === Infinity) return 1;
    if (x === -Infinity) return 0;
    // Sum the smaller tail for stable symmetry and tiny tail probabilities.
    const absoluteX = Math.abs(x);
    let tail = 0;
    for (const component of components) tail += component.weight * normalCdf(-absoluteX * component.invSd);
    return x < 0 ? tail : 1 - tail;
  };
  return {
    r, eta, vartheta, beta, components, quadratureMass: mass,
    variance, finiteVariance, mean: finiteMean ? 0 : NaN, finiteMean,
    peakFinite, peak, pdf, cdf,
    sample: (rng = Math.random) => sampleMixture(1, r, eta, vartheta, rng)[0],
    samples: (n, rng = Math.random) => sampleMixture(n, r, eta, vartheta, rng)
  };
}

/**
 * Exact empirical one-sample KS distance against the supplied numerical CDF.
 * Both sides of every ECDF jump are checked. No fitted-model p-value is implied.
 */
export function ksGap(samples, cdf) {
  const ordered = Array.from(samples).sort((a,b) => a - b);
  if (!ordered.length || ordered.some(value => !Number.isFinite(value))) throw new RangeError('KS requires nonempty finite samples.');
  const n = ordered.length;
  let best = { d: -1, x: ordered[0], empirical: 0, theoretical: 0, side: 'left', n };
  for (let i = 0; i < n; i++) {
    const x = ordered[i];
    const theoretical = cdf(x);
    if (!(theoretical >= 0 && theoretical <= 1)) throw new RangeError('CDF must return a probability.');
    const left = theoretical - i / n;
    const right = (i + 1) / n - theoretical;
    if (left > best.d) best = { d:left, x, empirical:i/n, theoretical, side:'left', n };
    if (right > best.d) best = { d:right, x, empirical:(i+1)/n, theoretical, side:'right', n };
  }
  return best;
}

function checkHaarInput(values, width, height) {
  const powerOfTwo = n => Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
  if (!powerOfTwo(width) || !powerOfTwo(height) || values.length !== width * height) throw new RangeError('Haar input must match positive power-of-two width and height.');
}

/** Full separable, orthonormal Haar transform of a rectangular power-of-two grid. */
export function haar2D(values, width, height = width) {
  checkHaarInput(values, width, height);
  const coefficients = Float64Array.from(values);
  const temporary = new Float64Array(Math.max(width, height));
  const levels = [];
  let w = width;
  let h = height;
  while (w > 1 || h > 1) {
    levels.push({ width:w, height:h });
    if (w > 1) {
      for (let row = 0; row < h; row++) {
        for (let i = 0; i < w / 2; i++) {
          const a = coefficients[row * width + 2 * i];
          const b = coefficients[row * width + 2 * i + 1];
          temporary[i] = (a + b) * INV_SQRT_TWO;
          temporary[w/2+i] = (a - b) * INV_SQRT_TWO;
        }
        for (let col = 0; col < w; col++) coefficients[row * width + col] = temporary[col];
      }
    }
    if (h > 1) {
      for (let col = 0; col < w; col++) {
        for (let i = 0; i < h / 2; i++) {
          const a = coefficients[2 * i * width + col];
          const b = coefficients[(2 * i + 1) * width + col];
          temporary[i] = (a + b) * INV_SQRT_TWO;
          temporary[h/2+i] = (a - b) * INV_SQRT_TWO;
        }
        for (let row = 0; row < h; row++) coefficients[row * width + col] = temporary[row];
      }
    }
    w = Math.max(1,w/2);
    h = Math.max(1,h/2);
  }
  return { coefficients, width, height, levels };
}

/** Inverse of haar2D; pass its result, optionally with edited coefficients. */
export function inverseHaar2D({ coefficients, width, height, levels }) {
  checkHaarInput(coefficients, width, height);
  const values = Float64Array.from(coefficients);
  const temporary = new Float64Array(Math.max(width,height));
  if (!Array.isArray(levels)) throw new TypeError('Inverse Haar requires the original level dimensions.');
  for (const {width:w,height:h} of [...levels].reverse()) {
    if (h > 1) {
      for (let col = 0; col < w; col++) {
        for (let i = 0; i < h / 2; i++) {
          const a = values[i * width + col];
          const d = values[(i + h / 2) * width + col];
          temporary[2*i] = (a + d) * INV_SQRT_TWO;
          temporary[2*i+1] = (a - d) * INV_SQRT_TWO;
        }
        for (let row = 0; row < h; row++) values[row * width + col] = temporary[row];
      }
    }
    if (w > 1) {
      for (let row = 0; row < h; row++) {
        for (let i = 0; i < w / 2; i++) {
          const a = values[row * width + i];
          const d = values[row * width + i + w / 2];
          temporary[2*i] = (a + d) * INV_SQRT_TWO;
          temporary[2*i+1] = (a - d) * INV_SQRT_TWO;
        }
        for (let col = 0; col < w; col++) values[row * width + col] = temporary[col];
      }
    }
  }
  return values;
}
