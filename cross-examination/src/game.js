export const oppositeSide = side => side === 'for' ? 'against' : 'for';

export function assertQuestion(question) {
  if (!question || question.schemaVersion !== 2 || typeof question.question !== 'string' ||
      !Number.isInteger(question.version) || question.rules?.turns !== 8 ||
      question.rules.maxWords !== 4 || question.rules.maxCharacters !== 40 ||
      question.rules.multiplierBase !== 2 || !Array.isArray(question.entries) || !question.entries.length) {
    throw new Error('Unsupported question file.');
  }
  const entries = new Map();
  for (const entry of question.entries) {
    if (!entry || entries.has(entry.id) || typeof entry.id !== 'string' ||
        !['for', 'against'].includes(entry.side) || typeof entry.standalone !== 'boolean' ||
        typeof entry.answer !== 'string' || typeof entry.reveal !== 'string' ||
        !Array.isArray(entry.aliases) || !entry.aliases.every(alias => typeof alias === 'string') ||
        !Array.isArray(entry.counters) || !Array.isArray(entry.claims) ||
        ![10, 25, 50, 75, 100].includes(entry.points)) throw new Error('Invalid answer bank.');
    const ranges = [], ids = new Set();
    for (const claim of entry.claims) {
      const start = entry.reveal.indexOf(claim.text);
      if (typeof claim.id !== 'string' || ids.has(claim.id) || !claim.text || start < 0 ||
          entry.reveal.indexOf(claim.text, start + 1) !== -1 ||
          ranges.some(([a, b]) => start < b && start + claim.text.length > a)) throw new Error('Invalid claim span.');
      ids.add(claim.id); ranges.push([start, start + claim.text.length]);
    }
    entries.set(entry.id, entry);
  }
  for (const entry of entries.values()) {
    if (!entry.standalone && !entry.counters.length) throw new Error('Counter-only entry needs a target.');
    const seen = new Set();
    for (const counter of entry.counters) {
      const target = entries.get(counter.targetId), key = `${counter.targetId}:${counter.targetClaimId}`;
      if (!target || target.side === entry.side || seen.has(key) || typeof counter.reveal !== 'string' ||
          !target.claims.some(claim => claim.id === counter.targetClaimId)) throw new Error('Invalid counterpunch link.');
      seen.add(key);
    }
    for (const claim of entry.claims) {
      if (![...entries.values()].some(candidate => candidate.counters.some(link =>
        link.targetId === entry.id && link.targetClaimId === claim.id))) throw new Error('Claim has no counter.');
    }
  }
  return question;
}

export function playableQuestion(question) {
  assertQuestion(question);
  return structuredClone({ schemaVersion: question.schemaVersion, id: question.id,
    version: question.version, question: question.question, scope: question.scope,
    category: question.category, startsWith: question.startsWith, rules: question.rules,
    entries: question.entries.map(entry => ({ id: entry.id, side: entry.side,
      answer: entry.answer, aliases: entry.aliases, tier: entry.tier, points: entry.points,
      reveal: entry.reveal, standalone: entry.standalone, claims: entry.claims,
      counters: entry.counters.map(({ targetId, targetClaimId, reveal }) => ({ targetId, targetClaimId, reveal })) })) });
}

export function createRun(question, now = Date.now()) {
  return { storageVersion: 2, question: playableQuestion(question), phase: 'playing', history: [],
    selection: { kind: 'fresh', side: question.startsWith }, draft: '', startedAt: now, completedAt: null };
}
export const totalScore = run => run.history.reduce((sum, turn) => sum + turn.total, 0);
export const usedIds = run => run.history.map(turn => turn.entryId);
export const currentEntry = run => run.question.entries.find(entry => entry.id === run.history.at(-1)?.entryId);
export function availableCounters(run, entryId, claimId) {
  const used = new Set(usedIds(run));
  return run.question.entries.filter(entry => !used.has(entry.id) && entry.counters.some(link =>
    link.targetId === entryId && link.targetClaimId === claimId));
}
export function availableClaims(run) {
  const entry = currentEntry(run);
  return entry?.claims.filter(claim => availableCounters(run, entry.id, claim.id).length) ?? [];
}
export function selectFresh(run, side = run.question.startsWith) {
  if (run.phase !== 'playing' || !['for', 'against'].includes(side)) throw new Error('Cannot start this angle.');
  return { ...run, selection: { kind: 'fresh', side }, draft: '' };
}
export function selectClaim(run, claimId) {
  const entry = currentEntry(run);
  if (run.phase !== 'playing' || !availableClaims(run).some(claim => claim.id === claimId)) throw new Error('Cannot challenge this claim.');
  return { ...run, selection: { kind: 'counter', targetId: entry.id, claimId }, draft: '' };
}
export function matchContext(run) {
  if (!run.selection) return null;
  return run.selection.kind === 'fresh' ? { kind: 'fresh' } : { ...run.selection };
}
export function currentSide(run) {
  return run.selection?.kind === 'fresh' ? run.selection.side : oppositeSide(currentEntry(run)?.side);
}
export function nextMultiplier(run) {
  return run.selection?.kind === 'counter' ? (run.history.at(-1)?.multiplier ?? 1) * run.question.rules.multiplierBase : 1;
}
export function commitAnswer(run, entryId, input = '', now = Date.now()) {
  if (run.phase !== 'playing' || !run.selection || run.history.length >= run.question.rules.turns) throw new Error('Choose your next move.');
  const entry = run.question.entries.find(item => item.id === entryId), selection = run.selection;
  if (!entry || usedIds(run).includes(entryId) || entry.side !== currentSide(run)) throw new Error('That answer cannot be played here.');
  let link = null;
  if (selection.kind === 'fresh') {
    if (!entry.standalone) throw new Error('That answer needs a claim to counter.');
  } else {
    if (currentEntry(run)?.id !== selection.targetId) throw new Error('Only the latest argument can be countered.');
    link = entry.counters.find(item => item.targetId === selection.targetId && item.targetClaimId === selection.claimId);
    if (!link) throw new Error('That answer does not counter the selected claim.');
  }
  const multiplier = nextMultiplier(run);
  const record = { entryId, side: entry.side, input: String(input || entry.answer).slice(0, 40),
    context: structuredClone(selection), multiplier, basePoints: entry.points,
    total: entry.points * multiplier, counterReveal: link?.reveal ?? null };
  const history = [...run.history, record], complete = history.length === run.question.rules.turns;
  return { ...run, history, selection: null, draft: '', phase: complete ? 'complete' : 'playing',
    completedAt: complete ? now : null };
}
export function restoreRun(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.storageVersion !== 2 || !Array.isArray(data.history) ||
        !Number.isFinite(data.startedAt) || !['playing', 'complete'].includes(data.phase)) return null;
    let run = createRun(data.question, data.startedAt);
    for (const record of data.history) {
      const context = record.context;
      if (context?.kind === 'fresh') run = selectFresh(run, context.side);
      else if (context?.kind === 'counter' && context.targetId === currentEntry(run)?.id) run = selectClaim(run, context.claimId);
      else return null;
      run = commitAnswer(run, record.entryId, record.input, data.completedAt ?? data.startedAt);
    }
    if (run.phase !== data.phase) return null;
    if (data.selection !== null) {
      if (data.selection?.kind === 'fresh') run = selectFresh(run, data.selection.side);
      else if (data.selection?.kind === 'counter' && data.selection.targetId === currentEntry(run)?.id) run = selectClaim(run, data.selection.claimId);
      else return null;
    }
    return { ...run, draft: typeof data.draft === 'string' ? data.draft.slice(0, 40) : '' };
  } catch { return null; }
}
export function shareText(run) {
  const counters = run.history.filter(turn => turn.context.kind === 'counter').length;
  const max = Math.max(1, ...run.history.map(turn => turn.multiplier));
  return `Cross Examination\n${run.history.map(turn => turn.context.kind === 'counter' ? '✳' : '●').join(' ')}\n${totalScore(run)} points · ${counters} counterpunches · ×${max} best chain\nArgue. Undo yourself. Repeat.`;
}
