export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export const matches = (when, answers) => when.every(c => answers[c.caseId] === c.verdict);
export const firstRule = (rules, answers) => rules.find(r => matches(r.when, answers)) ?? null;
export const finalAnswers = run => ({ ...Object.fromEntries(run.originalAnswers.map(a => [a.caseId, a.verdict])), ...run.overrides });
export const caseById = (topic, id) => topic.cases.find(c => c.id === id);
export function featuredTopic(manifest, day = utcDay()) {
  const n = Math.floor((Date.parse(day) - Date.parse(manifest.epoch)) / 86400000);
  return manifest.topics[((n % manifest.topics.length) + manifest.topics.length) % manifest.topics.length];
}
export function nextCase(topic, run) {
  const slot = topic.slots[run.originalAnswers.length];
  if (!slot) return null;
  const answers = Object.fromEntries(run.originalAnswers.map(a => [a.caseId, a.verdict]));
  const id = slot.caseId ?? slot.options.find(o => matches(o.when, answers))?.caseId ?? slot.fallbackCaseId;
  if (run.originalAnswers.some(a => a.caseId === id)) throw new Error('Repeated case in topic');
  const value = caseById(topic, id);
  if (!value) throw new Error('Missing case in topic');
  return value;
}
export function createRun(topic, day = utcDay()) {
  return { saveVersion: 1, topicId: topic.id, topicRevision: topic.revision, day,
    phase: 'choosing', originalAnswers: [], reviewPairId: null, overrides: {}, mode: 'solo' };
}
export function answer(topic, run, verdict) {
  if (run.phase !== 'choosing' || !['yes', 'no'].includes(verdict)) throw new Error('Invalid choice');
  const c = nextCase(topic, run);
  const updated = { ...run, originalAnswers: [...run.originalAnswers, { slot: run.originalAnswers.length, caseId: c.id, verdict }] };
  if (updated.originalAnswers.length === 8) {
    const pair = firstRule(topic.comparisons, finalAnswers(updated));
    updated.reviewPairId = pair?.id ?? null;
    updated.phase = pair ? 'review' : 'result';
  }
  return updated;
}
export function undo(run) {
  if (run.phase !== 'choosing' || !run.originalAnswers.length) return run;
  return { ...run, originalAnswers: run.originalAnswers.slice(0, -1), overrides: {}, reviewPairId: null };
}
export function revise(topic, run, caseId) {
  const pair = topic.comparisons.find(p => p.id === run.reviewPairId);
  if (run.phase !== 'review' || !pair?.caseIds.includes(caseId)) throw new Error('Invalid review edit');
  const overrides = { ...run.overrides };
  const original = run.originalAnswers.find(a => a.caseId === caseId).verdict;
  const value = finalAnswers(run)[caseId] === 'yes' ? 'no' : 'yes';
  if (value === original) delete overrides[caseId]; else overrides[caseId] = value;
  return { ...run, overrides };
}
export function finishReview(run) {
  if (run.phase !== 'review') return run;
  return { ...run, phase: 'result' };
}
export function receiptModel(topic, run) {
  if (run.originalAnswers.length !== 8) throw new Error('Receipt requires eight calls');
  const answers = finalAnswers(run), rule = firstRule(topic.receiptRules, answers);
  return { topicId: topic.id, question: topic.question, title: topic.completionTitle,
    adult: topic.adult, day: run.day, revision: topic.revision,
    updated: Object.keys(run.overrides).length > 0,
    headline: rule?.headline ?? topic.receiptFallback.headline,
    line: rule?.line ?? topic.receiptFallback.line,
    pairIds: rule?.caseIds ?? [],
    rows: run.originalAnswers.map(a => ({ id: a.caseId, label: caseById(topic, a.caseId).label,
      verdict: answers[a.caseId], verdictLabel: topic.labels[answers[a.caseId]], sceneId: caseById(topic, a.caseId).scene.id })) };
}
export function restoreRun(topic, raw) {
  try {
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!saved || saved.saveVersion !== 1 || saved.topicId !== topic.id || saved.topicRevision !== topic.revision || saved.mode !== 'solo') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(saved.day) || utcDay(Date.parse(saved.day)) !== saved.day) return null;
    if (!Array.isArray(saved.originalAnswers) || saved.originalAnswers.length > 8) return null;
    let run = createRun(topic, saved.day);
    for (const [i, entry] of saved.originalAnswers.entries()) {
      if (entry.slot !== i || nextCase(topic, run)?.id !== entry.caseId) return null;
      run = answer(topic, run, entry.verdict);
    }
    if (saved.reviewPairId !== run.reviewPairId || !['choosing', 'review', 'result'].includes(saved.phase)) return null;
    if (saved.phase !== run.phase && !(run.phase === 'review' && saved.phase === 'result')) return null;
    if (!saved.overrides || typeof saved.overrides !== 'object' || Array.isArray(saved.overrides)) return null;
    const pair = topic.comparisons.find(p => p.id === run.reviewPairId);
    for (const [id, verdict] of Object.entries(saved.overrides)) {
      if (!pair?.caseIds.includes(id) || !['yes', 'no'].includes(verdict)) return null;
      const original = run.originalAnswers.find(a => a.caseId === id).verdict;
      if (verdict === original) return null;
    }
    return { ...run, phase: saved.phase, overrides: { ...saved.overrides } };
  } catch { return null; }
}
