# The Shape of an Image

A static, browser-based companion to **Do Generalized-Gamma Scale Mixtures of Normals Fit Large Image Datasets?**, arXiv:2512.17038v3 (10 April 2026), by Brandon Marks, Yash Dave, Zixun Wang, Hannah Chung, Riya Patwa, Simon Cha, Michael Murphy, and Alexander Strang.

Serve the repository root with any static server that serves `.mjs` as JavaScript, then open `/research/`. The portfolio’s Research navigation and primary paper button lead here. There are no third-party runtime requests or package-install requirements; the local portfolio font is reused.

## Content and provenance

- `index.html` holds the eight-chapter narrative, accessible native controls, equations, and source links.
- `app.mjs` handles the two-pixel inverse example, finite scale mixture, parameter explorer, step-aware KS exercise, failure cases, dependence example, and chapter navigation.
- `image-lab.mjs` generates the teaching images and computes actual orthonormal Haar transforms, coefficient retention, and inverse reconstruction. Its histogram always uses original coefficients.
- `math.mjs` implements the defining hierarchy from Eqs. (2)–(4): `G ~ Gamma(beta,1)`, `theta = vartheta*G^(1/r)`, `X = sqrt(theta)*Z`, `beta = (eta+1.5)/r > 0`. Density and CDF use normalized log-gamma quadrature. Samples use the actual hierarchy.
- `evidence.mjs` contains selected Table 4 rows, cross-checked against the authors’ public results CSV, with dataset descriptions, scope notes, and links. `evidence-ui.mjs` displays them without deriving unreported group counts.
- `assets/observed-fits.jpg` is the original Figure 8 from the paper, attributed to Marks et al. under CC BY 4.0. It is genuine published evidence, separate from the clearly labeled generated examples.

The paper’s v3 overall pass summaries conflict between §6.1 and Table 4. This companion discloses that discrepancy and uses individually attributed dataset–transform rows. It does not claim held-out performance, clinical validation, or established independence. Conventional fixed-null KS cutoffs are kept separate from fitted-model descriptive distances.

## Numerical verification

From the repository root:

```text
node research/tests/math.test.mjs
```

Checks include exact unit-scale Laplace (`r=1, eta=-0.5, vartheta=2`) and Cauchy (`r=-1, eta=-2, vartheta=0.5`) benchmarks, PDF/CDF properties, convergence, normalized weights, hierarchical samples, undefined moments, both sides of ECDF jumps, and Haar energy/reconstruction. A normal limit is not mislabeled as a finite slider preset. Screen-reader value text reports physical quantities for logarithmic sliders.

Browser QA covers mobile and desktop, keyboard range controls, selection synchronization, exact presets, same-data fitting, search cancellation, failure feedback, preserved marginals under shuffling, motion settings, link routing, and browser errors. Animations are finite, user-triggered, and respect reduced-motion preferences.
