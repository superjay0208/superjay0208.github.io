export const oppositeSide = side => side === 'for' ? 'against' : 'for';

export function sideForTurn(question, index) {
  return index % 2 === 0 ? question.startsWith : oppositeSide(question.startsWith);
}

export function assertQuestion(question) {
  if (!question || question.schemaVersion !== 1 || typeof question.question !== 'string' ||
      !['for', 'against'].includes(question.startsWith) || !Number.isInteger(question.version) ||
      !question.rules || question.rules.turns !== 6 || question.rules.secondsPerTurn !== 25 ||
      question.rules.maxWords !== 4 || question.rules.maxCharacters !== 40 ||
      question.rules.counterBonus !== 20 || question.rules.maxCounterBonuses !== 2 ||
      !Array.isArray(question.entries) || !question.entries.length) throw new Error('Unsupported question file.');
  const ids = new Set();
  for (const entry of question.entries) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) ||
        !['for', 'against'].includes(entry.side) || typeof entry.answer !== 'string' ||
        typeof entry.reveal !== 'string' || !Array.isArray(entry.aliases) ||
        !entry.aliases.every(alias => typeof alias === 'string') || !Array.isArray(entry.counters) ||
        ![10, 25, 50, 75, 100].includes(entry.points)) throw new Error('Invalid answer bank.');
    ids.add(entry.id);
  }
  for (const entry of question.entries) {
    for (const counter of entry.counters) {
      const target = question.entries.find(item => item.id === counter.targetId);
      if (!target || target.side === entry.side || typeof counter.reveal !== 'string') throw new Error('Invalid counterpunch link.');
    }
  }
  return question;
}

export function playableQuestion(question) {
  assertQuestion(question);
  // Keep test fixtures, research, and editorial notes in the source file, not every saved run.
  return structuredClone({ schemaVersion: question.schemaVersion, id: question.id,
    version: question.version, status: question.status, question: question.question,
    scope: question.scope, category: question.category, startsWith: question.startsWith,
    rules: question.rules, entries: question.entries.map(entry => ({ id: entry.id,
      side: entry.side, answer: entry.answer, aliases: entry.aliases, tier: entry.tier,
      points: entry.points, reveal: entry.reveal,
      counters: entry.counters.map(counter => ({ targetId: counter.targetId, reveal: counter.reveal })) })) });
}

export function createRun(question, mode, now = Date.now()) {
  assertQuestion(question);
  if (!['timed', 'relaxed'].includes(mode)) throw new Error('Unknown play mode.');
  return { storageVersion: 1, question: playableQuestion(question), mode, phase: 'turn',
    history: [], draft: '', startedAt: now, completedAt: null,
    deadline: mode === 'timed' ? now + question.rules.secondsPerTurn * 1000 : null };
}

export function scoreEntry(question, history, entry) {
  const bonuses = history.filter(turn => turn.bonusPoints > 0).length;
  const usedTargets = new Set(history.map(turn => turn.counterTargetId).filter(Boolean));
  let counter = null;
  let target = null;
  if (bonuses < question.rules.maxCounterBonuses) {
    for (const earlier of [...history].reverse()) {
      if (!earlier.entryId || earlier.side === entry.side || usedTargets.has(earlier.entryId)) continue;
      const link = entry.counters.find(item => item.targetId === earlier.entryId);
      if (link) { counter = link; target = earlier; break; }
    }
  }
  const bonusPoints = counter ? question.rules.counterBonus : 0;
  return { basePoints: entry.points, bonusPoints, total: entry.points + bonusPoints,
    counterTargetId: target?.entryId ?? null, counterTargetTurn: target?.turnIndex ?? null,
    counterReveal: counter?.reveal ?? null };
}

export function commitTurn(run, move, now = Date.now()) {
  if (run.phase !== 'turn' || run.history.length >= run.question.rules.turns) return run;
  const side = sideForTurn(run.question, run.history.length);
  if (run.mode === 'timed' && now >= run.deadline) move = { kind: 'timeout' };
  if (!['answer', 'pass', 'timeout'].includes(move.kind)) throw new Error('Unknown move.');
  const entry = move.kind === 'answer' ? run.question.entries.find(item => item.id === move.entryId) : null;
  if (move.kind === 'answer' && (!entry || entry.side !== side || run.history.some(turn => turn.entryId === entry.id))) {
    throw new Error('That answer cannot be played on this turn.');
  }
  const score = entry ? scoreEntry(run.question, run.history, entry) : {
    basePoints: 0, bonusPoints: 0, total: 0, counterTargetId: null, counterTargetTurn: null, counterReveal: null,
  };
  const record = { turnIndex: run.history.length, side, kind: move.kind, entryId: entry?.id ?? null,
    input: entry ? String(move.input ?? entry.answer).slice(0, run.question.rules.maxCharacters) : '',
    ...score };
  return { ...run, history: [...run.history, record], phase: 'reveal', deadline: null, draft: '' };
}

export function advanceRun(run, now = Date.now()) {
  if (run.phase !== 'reveal') return run;
  if (run.history.length === run.question.rules.turns) return { ...run, phase: 'complete', completedAt: now };
  return { ...run, phase: 'turn', draft: '',
    deadline: run.mode === 'timed' ? now + run.question.rules.secondsPerTurn * 1000 : null };
}

export function totalScore(run) {
  return run.history.reduce((sum, turn) => sum + turn.total, 0);
}

export function restoreRun(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.storageVersion !== 1 || !['turn', 'reveal', 'complete'].includes(data.phase) ||
        !['timed', 'relaxed'].includes(data.mode) || !Number.isFinite(data.startedAt) ||
        !Array.isArray(data.history)) return null;
    assertQuestion(data.question);
    if (data.history.length > data.question.rules.turns ||
        (data.phase === 'turn' && data.history.length >= data.question.rules.turns) ||
        (data.phase === 'reveal' && !data.history.length) ||
        (data.phase === 'complete' && data.history.length !== data.question.rules.turns)) return null;
    // Recompute the ledger instead of trusting persisted point totals or bonus targets.
    const history = [];
    for (const saved of data.history) {
      const index = history.length;
      const side = sideForTurn(data.question, index);
      if (saved.turnIndex !== index || saved.side !== side || !['answer', 'pass', 'timeout'].includes(saved.kind)) return null;
      const entry = data.question.entries.find(item => item.id === saved.entryId);
      if (saved.kind === 'answer' && (!entry || entry.side !== side || history.some(turn => turn.entryId === entry.id))) return null;
      const rebuilt = commitTurn({ ...data, phase: 'turn', mode: 'relaxed', history },
        { kind: saved.kind, entryId: saved.entryId, input: typeof saved.input === 'string' ? saved.input : '' }, 0);
      history.push(rebuilt.history.at(-1));
    }
    if (data.phase === 'turn' && data.mode === 'timed' && !Number.isFinite(data.deadline)) return null;
    return { ...data, question: playableQuestion(data.question), history, draft: typeof data.draft === 'string' ? data.draft.slice(0, 40) : '',
      deadline: data.phase === 'turn' && data.mode === 'timed' ? data.deadline : null };
  } catch { return null; }
}

export function shareText(run) {
  const answered = run.history.filter(turn => turn.kind === 'answer').length;
  const counters = run.history.filter(turn => turn.bonusPoints).length;
  const marks = run.history.map(turn => turn.bonusPoints ? '✳' : turn.kind === 'answer' ? '●' : '○').join(' ');
  return `Cross Examination · The prototype\n${marks}\n${totalScore(run)} points · ${answered}/${run.question.rules.turns} angles · ${counters} counterpunch${counters === 1 ? '' : 'es'}\n${run.mode === 'timed' ? '25-second turns' : 'Relaxed mode'} · Can you argue both sides?`;
}
