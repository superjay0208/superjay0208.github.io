export function assertPrompt(prompt) {
  if (!prompt || prompt.schemaVersion !== 3 || typeof prompt.id !== 'string' || !Number.isInteger(prompt.version) ||
      typeof prompt.claim !== 'string' || typeof prompt.instruction !== 'string' || !Array.isArray(prompt.entries) || !prompt.entries.length || !Array.isArray(prompt.rejected)) throw new Error('Unsupported counterexample bank.');
  const ids = new Set();
  for (const entry of prompt.entries) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || typeof entry.answer !== 'string' ||
        !Array.isArray(entry.aliases) || !entry.aliases.every(alias => typeof alias === 'string') ||
        ![10, 25, 50, 75, 100].includes(entry.points) || typeof entry.explanation !== 'string') throw new Error('Invalid counterexample.');
    ids.add(entry.id);
  }
  return prompt;
}
export function playablePrompt(prompt) {
  assertPrompt(prompt);
  return structuredClone({ schemaVersion: 3, id: prompt.id, version: prompt.version, claim: prompt.claim,
    instruction: prompt.instruction, scope: prompt.scope, starter: prompt.starter, category: prompt.category,
    entries: prompt.entries.map(({ id, answer, aliases, points, explanation }) => ({ id, answer, aliases, points, explanation })),
    rejected: prompt.rejected.map(({ answer, aliases, reason }) => ({ answer, aliases, reason })) });
}
export function createRun(prompts, now = Date.now()) {
  if (!Array.isArray(prompts) || prompts.length !== 6 || new Set(prompts.map(prompt => prompt.id)).size !== 6) throw new Error('A round needs six different claims.');
  return { storageVersion: 3, prompts: prompts.map(playablePrompt), history: [], phase: 'guess', draft: '', startedAt: now, completedAt: null };
}
export function currentPrompt(run) { return run.prompts[run.phase === 'reveal' ? run.history.length - 1 : Math.min(run.history.length, run.prompts.length - 1)]; }
export const totalScore = run => run.history.reduce((sum, record) => sum + record.points, 0);
export const maximumScore = run => run.prompts.reduce((sum, prompt) => sum + Math.max(...prompt.entries.map(entry => entry.points)), 0);
export function commitAnswer(run, entryId, input = '') {
  if (run.phase !== 'guess' || run.history.length >= run.prompts.length) throw new Error('This claim has already been answered.');
  const prompt = currentPrompt(run), entry = prompt.entries.find(entry => entry.id === entryId);
  if (!entry) throw new Error('That example is not in this claim.');
  return { ...run, phase: 'reveal', draft: '', history: [...run.history,
    { promptId: prompt.id, entryId, input: String(input || entry.answer).slice(0, 60), points: entry.points, kind: 'answer' }] };
}
export function advanceRun(run, now = Date.now()) {
  if (run.phase !== 'reveal') return run;
  const complete = run.history.length === run.prompts.length;
  return { ...run, phase: complete ? 'complete' : 'guess', draft: '', completedAt: complete ? now : null };
}
export function skipPrompt(run, now = Date.now()) {
  if (run.phase !== 'guess') return run;
  const prompt = currentPrompt(run);
  return advanceRun({ ...run, phase: 'reveal', history: [...run.history,
    { promptId: prompt.id, entryId: null, input: '', points: 0, kind: 'skip' }] }, now);
}
export function restoreRun(raw) {
  try {
    const saved = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!saved || saved.storageVersion !== 3 || !Number.isFinite(saved.startedAt) || !Array.isArray(saved.history) || !['guess', 'reveal', 'complete'].includes(saved.phase)) return null;
    let run = createRun(saved.prompts, saved.startedAt);
    for (const [index, record] of saved.history.entries()) {
      if (run.phase !== 'guess' || record.promptId !== currentPrompt(run).id) return null;
      if (record.kind === 'skip') run = skipPrompt(run, saved.completedAt ?? saved.startedAt);
      else if (record.kind === 'answer') {
        run = commitAnswer(run, record.entryId, record.input);
        if (index < saved.history.length - 1 || saved.phase !== 'reveal') run = advanceRun(run, saved.completedAt ?? saved.startedAt);
      } else return null;
    }
    if (run.phase !== saved.phase) return null;
    return { ...run, draft: run.phase === 'guess' && typeof saved.draft === 'string' ? saved.draft.slice(0, 60) : '' };
  } catch { return null; }
}
export function shareText(run) {
  return `Cross Examination\n${run.history.map(record => record.kind === 'skip' ? '○' : record.points >= 75 ? '✦' : record.points >= 50 ? '✳' : '●').join(' ')}\n${totalScore(run)} / ${maximumScore(run)} points · ${run.history.filter(record => record.kind === 'answer').length}/6 counterexamples\nOne example breaks the rule.`;
}
