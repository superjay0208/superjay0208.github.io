import assert from 'node:assert/strict';
import { probabilityDraws, probabilitySnapshot } from '../probability-lab.mjs';

const near=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} differs from ${b}`);
const half=probabilitySnapshot(0,1);
assert.equal(half.share,.5);
assert.equal(half.expected,50);
// Scale the marker and bell together: the area remains unchanged, while density changes units.
const usual=probabilitySnapshot(1,1);
const squeezed=probabilitySnapshot(.25,.25);
near(usual.share,.841344746068543);
near(squeezed.share,usual.share,1e-14);
near(squeezed.density,4*usual.density,1e-14);
assert.ok(squeezed.peak>1);
assert.ok(squeezed.share<1);
// Dots in sample mode are the actual count of rescaled draws, never rounded expected counts.
const samples=Float64Array.from([-2,-1,0,1,2]);
assert.equal(probabilitySnapshot(.25,.25,samples).actual,4);
assert.equal(probabilitySnapshot(.25,1,samples).actual,3);
assert.equal(probabilitySnapshot(.25,1,samples).count,5);
assert.deepEqual(probabilityDraws(51),probabilityDraws(51));
assert.notDeepEqual(probabilityDraws(51),probabilityDraws(52));
assert.equal(probabilityDraws(51).length,100);
// Tail probabilities include the entire model, not just the visible horizontal range.
near(probabilitySnapshot(3,1).share,.99865010196837);
assert.throws(()=>probabilitySnapshot(0,0),RangeError);
assert.throws(()=>probabilitySnapshot(NaN,1),RangeError);
console.log('Probability primer: area invariance, density units, actual sample counts, reproducibility, and tails passed.');
