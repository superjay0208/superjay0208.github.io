# The Shape of an Image

A static, browser-based companion to **Do Generalized-Gamma Scale Mixtures of Normals Fit Large Image Datasets?**, arXiv:2512.17038v3 (10 April 2026), by Brandon Marks, Yash Dave, Zixun Wang, Hannah Chung, Riya Patwa, Simon Cha, Michael Murphy, and Alexander Strang.

Serve the repository root with any static server that serves `.mjs` as JavaScript, then open `/research/`. The portfolio’s Research navigation and primary paper button lead here. There are no third-party runtime requests or package-install requirements; the local portfolio font is reused.

## Content and provenance

- `index.html` holds the eight-chapter narrative, accessible native controls, equations, and source links.
- `app.mjs` initializes experiments on demand: the two-pixel inverse example, finite scale mixture, parameter explorer, step-aware KS exercise, failure cases, and dependence example.
- `journey.mjs` / `journey.css` provide the eight-station field guide: direct chapter links, sequential navigation, optional read-all mode, a probability sublesson, a small dictionary, and progressive explanations. The interface uses object-level affordances and descriptive readouts rather than task banners or completion counters. Native controls and the full narrative remain available without the staged enhancement.
- `direct-input.mjs` supplements native range controls with horizontal manipulation of the two-pixel image, prior-density plot, and CDF comparison. Vertical touch gestures remain scrolling. The recovery signal maps a selected position to its finest-scale Haar detail, while the existing inspector slider covers all scales.
- `fit-model.mjs` memoizes numerical candidate evaluations for the current fixed sample in a bounded cache. Candidate changes reuse the exact previous KS gap and CDF points; changing the sample, width, or family parameters changes the cache key. Resize redraws reuse shape calculations.
- `probability-lab.mjs` introduces density area and cumulative probability with a linked threshold, adjustable normal width, and expected versus actual counts from 100 seeded draws. Its percentages use the full normal CDF, including tails outside the displayed frame.
- `inference-math.mjs` / `inference-lab.mjs` add a separate 128-value signal-recovery demonstration. Independent Gaussian noise, an orthonormal Haar transform, and Gaussian/Laplace/Cauchy marginal-MAP priors produce actual reconstructions. The three priors share the same interquartile width. All stationary candidates are compared for the nonconvex Cauchy posterior. The known original is used for error scoring, never to choose estimates or tune the prior. This is not a reconstruction experiment reported in the paper.
- `image-lab.mjs` generates the teaching images and computes actual orthonormal Haar transforms, coefficient retention, and inverse reconstruction. Its histogram always uses original coefficients.
- `math.mjs` implements the defining hierarchy from Eqs. (2)–(4): `G ~ Gamma(beta,1)`, `theta = vartheta*G^(1/r)`, `X = sqrt(theta)*Z`, `beta = (eta+1.5)/r > 0`. Density and CDF use normalized log-gamma quadrature. Samples use the actual hierarchy.
- `evidence.mjs` contains selected Table 4 rows, cross-checked against the authors’ public results CSV, with dataset descriptions, scope notes, and links. `evidence-ui.mjs` displays them without deriving unreported group counts.
- `assets/observed-fits.jpg` is the original Figure 8 from the paper, attributed to Marks et al. under CC BY 4.0. It is genuine published evidence, separate from the clearly labeled generated examples.

The paper’s v3 overall pass summaries conflict between §6.1 and Table 4. This companion discloses that discrepancy and uses individually attributed dataset–transform rows. It does not claim held-out performance, clinical validation, or established independence. Conventional fixed-null KS cutoffs are kept separate from fitted-model descriptive distances.

## Numerical verification

From the repository root:

```text
node research/tests/math.test.mjs
node research/tests/probability.test.mjs
node research/tests/inference.test.mjs
node research/tests/fit.test.mjs
```

Checks include exact unit-scale Laplace (`r=1, eta=-0.5, vartheta=2`) and Cauchy (`r=-1, eta=-2, vartheta=0.5`) benchmarks, PDF/CDF properties, convergence, normalized weights, hierarchical samples, undefined moments, both sides of ECDF jumps, and Haar energy/reconstruction. A normal limit is not mislabeled as a finite slider preset. Screen-reader value text reports physical quantities for logarithmic sliders.

The preceding release's browser QA covered mobile and desktop, keyboard range controls, selection synchronization, exact presets, same-data fitting, search cancellation, failure feedback, preserved marginals under shuffling, motion settings, link routing, and browser errors. Animations are finite and respect reduced-motion preferences.

Additional checks cover normal-area invariance, densities greater than one, actual versus expected sample counts, exact Gaussian/Laplace MAP formulas, global Cauchy modes versus dense numerical search, Haar energy/error identities, DC preservation, reproducible noise, and independence of the estimates from the hidden original. Browser QA also covers chapter-at-a-time/read-all navigation, deep links and browser history, dictionary dismissal, mobile chart aspect ratios, and chapter-state preservation. Expensive plots and the recovery/probability modules initialize when visited; hidden fit charts defer recomputation. No new runtime dependencies or third-party asset requests were introduced.

## Learning and interaction references

The layout uses direct manipulation, immediate consequences, and optional definitions. The approach is informed by [Podolefsky, Moore & Perkins on implicit scaffolding](https://arxiv.org/abs/1306.6544) and [Nielsen on progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/). These are design influences, not evidence that this companion has undergone a learning-outcome study.

The new mathematical illustrations also consult [NIST's normal distribution reference](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm) and [Gabriel Peyré's orthonormal wavelet denoising tutorial](https://mathematical-tours.github.io/book/interactive/denoising/). The visual direction continues the portfolio's [ONTO](https://www.onto.vc/) and [Apple Vision Pro](https://www.apple.com/apple-vision-pro/) references with original code-rendered graphics.

## Performance pass · 11 November 2026

- Probability axes, curve nodes, sample marks, and all 100 dots persist after initialization. Full normal curves are recalculated only when width changes. A synthetic DOM benchmark of 100 threshold updates created 13,700 elements / 300 subtree replacements before this change and zero / zero afterward, with the same numerical area result. This measures allocation work, not browser frame rate.
- Image retention sorts coefficients once per immutable scene transform. Raster buffers and cover-art layers are reused; duplicate animation frames are skipped. The cover and results explorer initialize only when their view is visited. Signal recovery calculations are reused when only the selected prior, inspection position, or layout changes.
- The portfolio glass settles after input, scheduling no frames while idle or offscreen. Its drawing buffer is capped near 650,000 desktop / 450,000 mobile pixels; empty rays are rejected before marching. Projector video decodes only during hover or keyboard focus while visible. These follow the principles in [MDN's WebGL performance guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices) and [web.dev's long-task guidance](https://web.dev/articles/optimize-long-tasks).
- Verification for this pass: numerical suites; DOM integration through all eight chapters; horizontal-versus-vertical pointer intent; native-control priority; lazy initialization; image-retention equality; finite plot geometry; homepage animation settling and media suspension; local served assets and links. Browser and native preview helpers failed to initialize in this session, so fresh visual browser QA and actual GPU/frame-rate measurements were unavailable. DOM and scheduling checks use geometry/canvas test doubles and do not substitute for those measurements.
