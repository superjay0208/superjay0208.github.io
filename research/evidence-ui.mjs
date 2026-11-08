import {
  DATASETS,
  RESULTS,
  FIT_CATEGORIES,
  WORKFLOW,
  OVERALL_DISCREPANCY,
  SOURCES
} from './evidence.mjs';

const initialized = new WeakMap();
const datasetsById = new Map(DATASETS.map(dataset => [dataset.id, dataset]));
const resultsById = new Map(RESULTS.map(result => [result.id, result]));
const percent = number => `${Number(number.toFixed(1))}%`;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function sourceLink(label, url) {
  const link = element('a', '', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function largeNumber(value) {
  for (const [divisor, suffix] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand']]) {
    if (value >= divisor) return `${Number((value / divisor).toFixed(2))} ${suffix}`;
  }
  return value.toLocaleString('en-US');
}

function sourceImageCount(dataset) {
  const count = dataset.imageCount.toLocaleString('en-US');
  if (dataset.id === 'mri3d') return `${count} generated brain volumes`;
  if (dataset.id === 'mri2d') return `${count} generated 2D images across orientations`;
  if (dataset.id === 'coco') return `${count} source images across indoor and outdoor subsets`;
  return `${count} source images`;
}

export function initEvidence() {
  const choice = document.getElementById('result-choice');
  if (!choice) return null;
  if (initialized.has(choice)) return initialized.get(choice);

  const ids = ['workflow-buttons', 'workflow-copy', 'result-rows', 'dataset-context', 'combined-pass', 'pass-bar', 'pass-legend', 'paper-ks', 'paper-samples', 'result-note', 'fit-categories', 'discrepancy-note'];
  const nodes = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  if (ids.some(id => !nodes[id])) return null;
  const resultButtons = new Map();
  const workflowButtons = new Map();
  let selectedResult = 'space-fourier';
  let selectedWorkflow = WORKFLOW[0].id;

  nodes['workflow-buttons'].setAttribute('role', 'group');
  nodes['workflow-buttons'].setAttribute('aria-label', 'Explore the research workflow');
  nodes['workflow-copy'].setAttribute('aria-live', 'polite');
  nodes['result-note'].setAttribute('aria-live', 'polite');

  function selectWorkflow(id) {
    const step = WORKFLOW.find(item => item.id === id);
    if (!step) return;
    selectedWorkflow = id;
    workflowButtons.forEach((button, buttonId) => button.setAttribute('aria-pressed', String(buttonId === id)));
    const title = element('strong', '', step.title);
    const description = element('p', '', step.text);
    const link = sourceLink('Read this step in the paper ↗', step.source);
    nodes['workflow-copy'].replaceChildren(title, description, link);
  }

  const workflowFragment = document.createDocumentFragment();
  WORKFLOW.forEach((step, index) => {
    const button = element('button');
    button.type = 'button';
    button.dataset.step = step.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', 'workflow-copy');
    button.setAttribute('aria-label', `Step ${index + 1}: ${step.title}`);
    button.append(element('span', '', `STEP ${String(index + 1).padStart(2, '0')}`), document.createTextNode(step.title));
    button.addEventListener('click', () => selectWorkflow(step.id));
    workflowButtons.set(step.id, button);
    workflowFragment.append(button);
  });
  nodes['workflow-buttons'].replaceChildren(workflowFragment);

  const options = document.createDocumentFragment();
  const rows = document.createDocumentFragment();
  RESULTS.forEach(result => {
    const option = element('option', '', `${result.label} / ${result.transform}`);
    option.value = result.id;
    options.append(option);
    const button = element('button', 'result-row');
    button.type = 'button';
    button.dataset.result = result.id;
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-controls', 'dataset-context combined-pass pass-bar paper-ks paper-samples result-note');
    button.setAttribute('aria-label', `${result.label}, ${result.transform}: ${percent(result.combinedPassPct)} of coefficient groups classified as statistical or practical passes. Select this result.`);
    const label = element('span', '', result.label);
    label.append(element('span', '', result.transform));
    const score = element('strong', '', percent(result.combinedPassPct));
    score.setAttribute('aria-hidden', 'true');
    button.append(label, score);
    button.addEventListener('click', () => selectResult(result.id));
    resultButtons.set(result.id, button);
    rows.append(button);
  });
  choice.replaceChildren(options);
  nodes['result-rows'].replaceChildren(rows);

  function selectResult(id) {
    const result = resultsById.get(id);
    if (!result) return;
    const dataset = datasetsById.get(result.datasetId);
    if (!dataset) return;
    selectedResult = id;
    choice.value = id;
    resultButtons.forEach((button, buttonId) => button.setAttribute('aria-pressed', String(buttonId === id)));

    const contextTitle = element('strong', '', `${result.label} · ${dataset.category}`);
    const description = element('p', '', dataset.description);
    const shape = dataset.id === 'mri2d' && result.subset === 'axial' ? '333 × 234 axial slices' : dataset.imageShape;
    const count = element('p', 'context-count', `${sourceImageCount(dataset)} · ${shape}.`);
    const note = element('p', 'context-note', dataset.note);
    const grouping = element('p', 'context-note', 'Related transformed coefficients are pooled across the image collection. A fitted group contains many coefficients, not just one image.');
    const contextSource = sourceLink('Dataset details · Table 1 ↗', dataset.source);
    contextSource.className = 'source-note';
    nodes['dataset-context'].replaceChildren(contextTitle, description, count, note, grouping, contextSource);

    const statistical = result.statisticalPassPct;
    const practical = Number((result.combinedPassPct - statistical).toFixed(1));
    const remaining = Number((100 - result.combinedPassPct).toFixed(1));
    nodes['combined-pass'].textContent = percent(result.combinedPassPct);
    nodes['paper-ks'].textContent = result.medianKS.toFixed(3);
    nodes['paper-samples'].textContent = largeNumber(result.medianSamples);
    nodes['paper-samples'].title = `${result.medianSamples.toLocaleString('en-US')} coefficients per fitted group, median reported in Table 4.`;
    nodes['result-note'].textContent = result.note;

    const bar = document.createDocumentFragment();
    const legend = document.createDocumentFragment();
    const categories = [
      { label: 'Statistical pass', value: statistical, className: 'bar-statistical' },
      { label: 'Practical pass', value: practical, className: 'bar-practical' },
      { label: 'Not a combined pass', value: remaining, className: 'bar-fail' }
    ];
    categories.forEach(category => {
      const segment = element('span', category.className);
      segment.style.width = `${category.value}%`;
      segment.title = `${category.label}: ${percent(category.value)}`;
      segment.setAttribute('aria-hidden', 'true');
      bar.append(segment);
      const item = element('span');
      const label = element('span');
      const dot = element('i', category.className);
      dot.setAttribute('aria-hidden', 'true');
      label.append(dot, document.createTextNode(category.label));
      item.append(label, element('strong', '', percent(category.value)));
      legend.append(item);
    });
    nodes['pass-bar'].replaceChildren(bar);
    nodes['pass-bar'].setAttribute('aria-label', `${result.label}, ${result.transform}. ${percent(statistical)} statistical passes, ${percent(practical)} practical passes, and ${percent(remaining)} not classified as combined passes. Percentages describe fitted coefficient groups, not images.`);
    nodes['pass-legend'].replaceChildren(legend);
  }

  choice.addEventListener('change', () => selectResult(choice.value));

  const categories = document.createDocumentFragment();
  FIT_CATEGORIES.forEach(category => {
    const paragraph = element('p');
    paragraph.append(element('strong', '', `${category.label}. `), document.createTextNode(`${category.criterion} ${category.meaning} `), sourceLink('Table 3 ↗', category.source));
    categories.append(paragraph);
  });
  nodes['fit-categories'].replaceChildren(categories);

  nodes['discrepancy-note'].replaceChildren(
    element('strong', '', 'An unresolved overall summary. '),
    document.createTextNode(`${OVERALL_DISCREPANCY.text} `),
    sourceLink('Compare the results prose', OVERALL_DISCREPANCY.proseSource),
    document.createTextNode(' and '),
    sourceLink('Table 4 ↗', OVERALL_DISCREPANCY.source),
    document.createTextNode('. '),
    sourceLink('Check the authors’ results CSV ↗', SOURCES.resultsCsv)
  );

  selectWorkflow(selectedWorkflow);
  selectResult(selectedResult);
  const api = {
    selectResult,
    selectWorkflow,
    get selectedResult() { return selectedResult; },
    get selectedWorkflow() { return selectedWorkflow; }
  };
  initialized.set(choice, api);
  return api;
}
