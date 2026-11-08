// Evidence transcribed from arXiv:2512.17038v3 (10 April 2026), then checked
// against the authors' public results_table.csv. These are reported fits,
// not browser simulations, reconstruction scores, or held-out test results.
const HTML = 'https://arxiv.org/html/2512.17038v3';
const REPO = 'https://github.com/yashdave003/gengamma-scale-mixture-validation-images';
export const SOURCES = {
  paper: 'https://arxiv.org/abs/2512.17038',
  html: HTML,
  pdf: 'https://arxiv.org/pdf/2512.17038v3',
  code: REPO,
  data: `${HTML}#S4`,
  table1: `${HTML}#S4.T1`,
  table2: `${HTML}#S5.T2`,
  table3: `${HTML}#S6.T3`,
  table4: `${HTML}#S6.T4`,
  table5: `${HTML}#S6.T5`,
  resultsCsv: `${REPO}/blob/main/publication/paper/CSVs/results_table.csv`,
  methods: `${HTML}#S5`,
  fitting: `${HTML}#S5.SS3`,
  results: `${HTML}#S6`,
  failures: `${HTML}#S6.SS2`,
  limitations: `${HTML}#S7.SS1`,
  nextSteps: `${HTML}#S7.SS2`,
  ksReference: 'https://www.itl.nist.gov/div898/handbook/eda/section3/eda35g.htm'
};

export const PAPER = {
  title: 'Do Generalized-Gamma Scale Mixtures of Normals Fit Large Image Datasets?',
  arxiv: '2512.17038',
  version: 3,
  versionDate: '10 April 2026',
  submittedDate: '18 December 2025',
  status: 'Preprint',
  authors: ['Brandon Marks', 'Yash Dave', 'Zixun Wang', 'Hannah Chung', 'Riya Patwa', 'Simon Cha', 'Michael Murphy', 'Alexander Strang'],
  question: 'Do flexible probability models used in imaging actually resemble the image data they are meant to describe?',
  scope: 'An empirical study of distributions of transformed image coefficients. It does not benchmark a new image-reconstruction algorithm.',
  license: 'CC BY 4.0',
  source: SOURCES.paper
};

export const DATASETS = [
  { id: 'agrivision', label: 'agriVision', category: 'Remote sensing', imageCount: 4500, imageShape: '256 × 256', description: 'Aerial views of central US farmland.', note: 'Images were standardized at the larger spatial-patch level before analysis.', source: SOURCES.table1 },
  { id: 'pastis', label: 'pastis', category: 'Remote sensing', imageCount: 1590, imageShape: '128 × 128', description: 'Satellite images of farm fields in France.', note: 'Repeated field textures make this an informative setting for frequency-based representations.', source: SOURCES.table1 },
  { id: 'spacenet', label: 'spaceNet', category: 'Remote sensing', imageCount: 3401, imageShape: '400 × 400', description: 'Mapping imagery centered on Rotterdam.', note: 'Some images contain large bodies of water. Nearly constant regions can produce a spike near zero in Haar coefficients.', source: SOURCES.table1 },
  { id: 'coco', label: 'COCO', category: 'Natural images', imageCount: 4050, imageShape: '256 × 256', description: 'Everyday scenes, analyzed in indoor and outdoor subsets.', note: 'The count covers the source collection used here; the paper does not report the indoor and outdoor image counts separately in Table 1.', source: SOURCES.table1 },
  { id: 'segment', label: 'Segment Anything', category: 'Natural images', imageCount: 7072, imageShape: '512 × 512', description: 'Diverse natural images from a segmentation-training collection.', note: 'Different subjects can create several clusters in coefficient distributions; one symmetric peak cannot describe every cluster.', source: SOURCES.table1 },
  { id: 'mri2d', label: 'Synthetic MRI · 2D', category: 'Medical imaging', imageCount: 15000, imageShape: 'Three brain-slice orientations', description: 'Generated brain images, analyzed as axial, coronal, and sagittal slices.', note: 'These are synthetic images from a latent diffusion model trained on UK Biobank data, not 15,000 patient scans. Table 1 reports 333 × 234 axial, 244 × 234 coronal, and 174 × 234 sagittal slices.', source: SOURCES.table1 },
  { id: 'mri3d', label: 'Synthetic MRI · 3D', category: 'Medical imaging', imageCount: 300, imageShape: '160 × 224 × 160', description: 'Generated three-dimensional brain volumes.', note: 'The 3D experiments extend the Haar analysis to seven differencing/averaging orientations. They are not a clinical validation study.', source: SOURCES.table1 },
  { id: 'classical', label: 'Classical reference images', category: 'Reference set', imageCount: 9, imageShape: 'A small comparison set', description: 'Familiar images often used to demonstrate image-processing methods.', note: 'Listed as standardTesting in Table 4. This comparison set is additional to the seven main datasets in Table 1.', source: `${HTML}#S4.SS2` }
];

// Every percentage is a percentage of fitted coefficient groups in the
// corresponding dataset/transform row, not a percentage of images or patients.
// Table 4 does not give a per-row count of groups. Do not infer exact counts
// from percentages rounded to one decimal place.
export const RESULTS = [
  { id: 'agri-fourier', datasetId: 'agrivision', label: 'agriVision', transformId: 'fourier', transform: 'Fourier', medianSamples: 2.6e6, medianKS: 0.005, statisticalPassPct: 2.3, combinedPassPct: 95.5, note: 'Most groups were practical passes rather than statistical passes.' },
  { id: 'pastis-fourier', datasetId: 'pastis', label: 'pastis', transformId: 'fourier', transform: 'Fourier', medianSamples: 2.6e5, medianKS: 0.002, statisticalPassPct: 90.9, combinedPassPct: 100.0, note: 'A strong example of both small discrepancies and many reported statistical passes.' },
  { id: 'space-fourier', datasetId: 'spacenet', label: 'spaceNet', transformId: 'fourier', transform: 'Fourier', medianSamples: 1.8e6, medianKS: 0.005, statisticalPassPct: 0.0, combinedPassPct: 100.0, note: 'A perfect combined-pass percentage does not mean exact equality of model and data: all passes here were practical.' },
  { id: 'space-haar', datasetId: 'spacenet', label: 'spaceNet', transformId: 'haar', transform: 'Haar wavelets', medianSamples: 1.6e6, medianKS: 0.012, statisticalPassPct: 4.7, combinedPassPct: 53.1, note: 'Large water regions help explain some spike-and-slab failures; changing representation changes the outcome.' },
  { id: 'coco-haar', datasetId: 'coco', subset: 'indoor', label: 'COCO · indoor', transformId: 'haar', transform: 'Haar wavelets', medianSamples: 2.6e5, medianKS: 0.013, statisticalPassPct: 25.0, combinedPassPct: 50.0, note: 'Orientation matters: the paper reports better vertical and diagonal than horizontal fits in natural images, especially at lower layers.' },
  { id: 'segment-haar', datasetId: 'segment', label: 'Segment Anything', transformId: 'haar', transform: 'Haar wavelets', medianSamples: 1.8e6, medianKS: 0.004, statisticalPassPct: 25.0, combinedPassPct: 85.2, note: 'The result varies with the dataset even when the representation is fixed.' },
  { id: 'mri2d-haar', datasetId: 'mri2d', subset: 'axial', label: 'Synthetic MRI · axial', transformId: 'haar', transform: 'Haar wavelets', medianSamples: 4.2e6, medianKS: 0.007, statisticalPassPct: 0.0, combinedPassPct: 76.2, note: 'These are distributions of coefficients from generated brain slices; the number is not a diagnostic or reconstruction-accuracy score.' },
  { id: 'mri3d-haar', datasetId: 'mri3d', label: 'Synthetic MRI · 3D', transformId: 'haar', transform: 'Haar wavelets', medianSamples: 1.6e6, medianKS: 0.005, statisticalPassPct: 7.1, combinedPassPct: 69.0, note: 'The paper also tests higher-dimensional data, with variation across the seven Haar orientations.' },
  { id: 'coco-gabor', datasetId: 'coco', subset: 'indoor', label: 'COCO · indoor', transformId: 'gabor', transform: 'Gabor filters', medianSamples: 6.6e7, medianKS: 0.006, statisticalPassPct: 0.0, combinedPassPct: 97.0, note: 'Very large coefficient groups make the reported statistical-pass standard demanding, even when the CDF discrepancies are small.' },
  { id: 'mri2d-gabor', datasetId: 'mri2d', subset: 'axial', label: 'Synthetic MRI · axial', transformId: 'gabor', transform: 'Gabor filters', medianSamples: 1.8e8, medianKS: 0.005, statisticalPassPct: 0.0, combinedPassPct: 95.2, note: 'Compare this with the axial Haar row to see how representation affects the share of acceptable fits.' },
  { id: 'coco-learned', datasetId: 'coco', subset: 'indoor', label: 'COCO · indoor', transformId: 'learned', transform: 'AlexNet filters', medianSamples: 2.0e8, medianKS: 0.009, statisticalPassPct: 0.0, combinedPassPct: 64.5, note: 'These are first-layer, pre-activation convolution/filter responses—not the final predictions of a neural network.' },
  { id: 'space-learned', datasetId: 'spacenet', label: 'spaceNet', transformId: 'learned', transform: 'AlexNet filters', medianSamples: 4.8e8, medianKS: 0.013, statisticalPassPct: 0.0, combinedPassPct: 42.9, note: 'More flexible learned features do not automatically produce a better fit to this particular prior family.' }
].map(row => ({...row, source: SOURCES.table4, crossCheck: SOURCES.resultsCsv, unit: 'fitted coefficient groups', medianSamplesUnit: 'coefficients per group'}));

export const FIT_CATEGORIES = [
  { id: 'statistical', label: 'Statistical pass', criterion: 'Reported p-value > 0.05, more than 100 samples, and a good visual fit.', meaning: 'The paper’s KS procedure does not distinguish the fitted distribution from the empirical one at its stated threshold. This does not establish that the model is true.', source: SOURCES.table3 },
  { id: 'practical', label: 'Practical pass', criterion: 'Usually KS < 0.01; sometimes accepted up to 0.015 after visual inspection.', meaning: 'The model captures the peak and tails closely, even though the discrepancy is statistically detectable. The paper treats the remaining mismatch as small for the intended use.', source: SOURCES.table3 },
  { id: 'borderline', label: 'Borderline', criterion: 'KS < 0.02, with a small visible failure mode.', meaning: 'Close to a useful fit, but with a feature the family does not capture well. This is a separate category, not included in combined passes.', source: SOURCES.table3 },
  { id: 'interesting', label: 'Interesting failure', criterion: 'A difficult fit, often involving an unusually pronounced peak.', meaning: 'It is unclear whether this distribution lies outside the family or whether searching and numerical computation are limiting the fit.', source: SOURCES.table3 },
  { id: 'trivial', label: 'Clear structural failure', paperLabel: 'Trivial failure', criterion: 'Asymmetry, multiple peaks, a double inflection, or spike-and-slab behavior.', meaning: 'The distribution has a feature that a symmetric, single-peaked member of this family cannot reproduce.', source: SOURCES.table3 }
];

export const WORKFLOW = [
  { id: 'standardize', title: 'Put images on a comparable scale', text: 'Center and scale each image to reduce differences in overall brightness and exposure. Remote-sensing standardization happens at the larger spatial-patch level.', source: `${HTML}#S5.SS1.SSS1` },
  { id: 'represent', title: 'Change the language of the image', text: 'Represent an image using Fourier components, Haar wavelets, Gabor filters, or the 64 filters from AlexNet’s first layer. The numbers to model are the resulting coefficients, not raw pixel brightness.', source: `${HTML}#S5.SS1.SSS2` },
  { id: 'group', title: 'Pool coefficients with a reason', text: 'A separate three-parameter fit at every image location would be unwieldy. Pool related coefficients into groups, with explicit assumptions about which locations, orientations, and frequencies can share a distribution.', source: `${HTML}#S5.SS1.SSS3` },
  { id: 'augment', title: 'Make the grouping assumptions visible', text: 'Some groups are approximately interchangeable already. Others correspond to deliberately discarding information through an image augmentation. For example, symmetrization adds negated coefficients; it changes the modeled data and must be justified.', source: `${HTML}#S5.SS1.SSS4` },
  { id: 'fit', title: 'Search for a close distribution', text: 'Search a coarse grid of the two shape parameters, choose scales by matching trimmed sample variances, and refine near the best fit. The objective is the smallest KS distance between model and empirical cumulative distributions.', source: SOURCES.fitting },
  { id: 'assess', title: 'Measure, inspect, and categorize', text: 'Use the KS discrepancy, the reported statistical threshold, and visual checks of density, cumulative probability, and log-density. Separately explore covariance between coefficient groups.', source: `${HTML}#S5.SS2` }
];

export const FINDINGS = [
  { id: 'flexibility', title: 'The peak and the tails need room to vary', text: 'The family can describe both a rounded peak with slow tail decay and a very sharp peak with faster tail decay. Figure 8 gives observed examples that familiar single-family priors do not capture well.', source: `${HTML}#S6.F8` },
  { id: 'beyond-classical', title: 'One familiar bell curve is often too restrictive', text: 'Section 6.1 reports that 85.0% of the empirical distributions accepted under this family were not fitted acceptably by any of the classical comparison models. This is conditional on that accepted subset, not 85% of images.', source: `${HTML}#S6.SS1` },
  { id: 'comparison', title: 'Flexibility improved the measured fit', text: 'Section 6.1 reports a better KS fit than the comparison priors for 91.5% of 1,071 coefficient blocks. Because several comparison models are contained in or approached by the larger family, a better optimized fit is partly expected; this is not a held-out prediction score.', source: `${HTML}#S6.SS1` },
  { id: 'representation', title: 'The representation changes the answer', text: 'For spaceNet, Table 4 reports combined pass rates of 100.0% for Fourier, 53.1% for Haar, and 42.9% for AlexNet filters. These percentages describe separate collections of coefficient-group fits.', source: SOURCES.table4 },
  { id: 'not-exact', title: 'A useful approximation can still fail a significance test', text: 'In the spaceNet Fourier row, the combined pass rate is 100.0% but the statistical pass rate is 0.0%. The accepted fits are practical approximations, not claims of exact equality.', source: SOURCES.table4 },
  { id: 'water', title: 'A calm patch of water can break the model', text: 'Nearly constant regions in some spaceNet images generate many Haar differences close to zero alongside larger coefficients elsewhere. The paper links some failures to this spike-and-slab shape.', source: `${HTML}#S6.SS2` },
  { id: 'filter-choice', title: 'Learned filters are not uniformly best for this task', text: 'Single-edge and multi-edge AlexNet filters generally fit this prior better than other learned-filter groups. Other filters can produce asymmetric or multimodal responses, outside the family’s shape assumptions.', source: `${HTML}#S6.SS2` },
  { id: 'regions', title: 'There may be a region of good answers', text: 'Different shape parameters can give similar fits when the scale changes too. The paper therefore studies regions of acceptable parameters instead of treating one optimal parameter triple as uniquely identified.', source: `${HTML}#S6.SS3` },
  { id: 'independence', title: 'A good histogram is only part of a prior model', text: 'Fourier and Haar groups show small pairwise covariance by the paper’s exploratory checks; learned filters show more dependence. The paper explicitly notes that low correlation does not prove independence and does not test independence within a group.', source: `${HTML}#S7.SS1` },
  { id: 'implication', title: 'Learn the parameters from relevant data', text: 'The paper recommends fitting to an actual dataset or using an empirical-Bayes approach because it finds no universal parameter rule across all datasets and representations.', source: `${HTML}#S7` }
];

export const LIMITATIONS = [
  { id: 'scope', title: 'Prior fit is not reconstruction performance', text: 'The study measures distributions of transformed coefficients. It does not show that a new denoiser, scanner, clinical decision, or uncertainty interval performs better in deployment.', source: `${HTML}#S3.SS3` },
  { id: 'same-data', title: 'These are optimized fits to the observed data', text: 'The grid search minimizes discrepancy on the empirical distributions being summarized. The fitting pipeline does not describe a separate held-out test split. Treat the table as a descriptive fit study, not an out-of-sample accuracy benchmark.', source: SOURCES.fitting },
  { id: 'test-calibration', title: 'A threshold is not a probability that a model is true', text: 'Classical one-sample KS calibration assumes independent observations and a fully specified reference distribution. Estimating parameters on the same sample changes that calibration. Here the pass labels are the paper’s reported categories, and independence is only partially examined.', source: SOURCES.ksReference, paperSource: `${HTML}#S5.SS2` },
  { id: 'tails', title: 'A small CDF gap can hide a tail mismatch', text: 'KS measures the largest absolute cumulative-probability gap and is relatively insensitive to rare tails. Different tail behavior can lead to different regularization or uncertainty even at similar KS distances.', source: SOURCES.limitations },
  { id: 'scale', title: 'Scale choices affect the answer', text: 'The search chooses candidate scales from empirical variances with selected extreme values trimmed. Outliers and alternative choices, such as matching kurtosis, can produce different parameter estimates with similar KS fit.', source: SOURCES.limitations },
  { id: 'dependence', title: 'Matching marginals does not establish joint independence', text: 'An image prior needs more than a collection of good one-dimensional histograms. The paper examines covariance between groups, but low pairwise correlation does not imply independence, and within-group independence remains untested.', source: SOURCES.limitations },
  { id: 'synthetic-medical', title: 'The medical examples are synthetic', text: 'The brain images were generated with a latent diffusion model. Their fit results should not be described as validation on independent patient cohorts or as clinical evidence.', source: `${HTML}#S4.SS3` },
  { id: 'labels', title: 'Practical fit includes expert judgment', text: 'Combined passes add statistical and practical passes. The practical categories use visual inspection as well as numerical cutoffs, so a combined-pass percentage is not the output of a single universal KS threshold.', source: SOURCES.table3 }
];

export const OVERALL_DISCREPANCY = {
  title: 'Why this lesson uses individual result rows',
  text: 'The v3 results prose and Table 4 give different overall pass summaries. Section 6.1 reports 71.8% combined (15.5% statistical plus 56.3% practical), while Table 4’s Overall row reports 83.5% combined and 7.3% statistical. The lesson uses selected, explicitly attributed dataset–transform rows, cross-checked against the authors’ public results CSV, rather than choosing an unresolved overall percentage.',
  source: SOURCES.table4,
  proseSource: `${HTML}#S6.SS1`,
  crossCheck: SOURCES.resultsCsv
};

export const PAPER_FIGURES = [
  { id: 'filters', number: 6, url: 'https://arxiv.org/html/2512.17038v3/figure/filters_wavelet_layers.jpg', title: 'The paper’s Fourier, Haar, Gabor, and learned-filter overview', source: `${HTML}#S5.F6`, credit: 'Marks et al., arXiv:2512.17038v3, Figure 6, CC BY 4.0.' },
  { id: 'observed-fits', number: 8, url: 'https://arxiv.org/html/2512.17038v3/figure/results/fit_categorization/best_hits_plot.jpg', title: 'Two observed coefficient distributions and their fitted priors', source: `${HTML}#S6.F8`, credit: 'Marks et al., arXiv:2512.17038v3, Figure 8, CC BY 4.0.' },
  { id: 'data', number: 5, url: 'https://arxiv.org/html/2512.17038v3/figure/data_panel.jpg', title: 'Representative images from the study datasets', source: `${HTML}#S4.F5`, credit: 'Marks et al., arXiv:2512.17038v3, Figure 5. Check the underlying dataset terms before reusing individual samples beyond this attributed paper figure.' }
];
