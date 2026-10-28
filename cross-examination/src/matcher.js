export function normalizeInput(value) {
  return String(value).normalize('NFKC').toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[^\p{L}\p{N}_\s']/gu, ' ')
    .trim().replace(/\s+/g, ' ');
}

// Optimal string alignment: insertions, deletions, replacements, and adjacent swaps.
export function editDistance(a, b) {
  const grid = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) grid[i][0] = i;
  for (let j = 0; j <= b.length; j++) grid[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      grid[i][j] = Math.min(grid[i - 1][j] + 1, grid[i][j - 1] + 1,
        grid[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        grid[i][j] = Math.min(grid[i][j], grid[i - 2][j - 2] + 1);
      }
    }
  }
  return grid[a.length][b.length];
}

function negations(value) {
  const words = new Set(['no', 'not', 'without', 'never', "isn't", 'isnt', "can't", 'cant', "don't", 'dont']);
  return value.split(' ').filter(word => words.has(word)).sort().join('|');
}

export function matchInput(question, raw, side, usedEntryIds = []) {
  const trimmed = String(raw).trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const input = normalizeInput(trimmed);
  if (!input || words > question.rules.maxWords || raw.length > question.rules.maxCharacters) {
    return { kind: 'invalid', reason: !input ? 'Name an angle first.' : 'Keep it to 1–4 words and 40 characters.' };
  }
  const used = new Set(usedEntryIds);
  const handles = question.entries.flatMap(entry => [entry.answer, ...entry.aliases]
    .map(handle => ({ entry, handle: normalizeInput(handle) })));
  const current = handles.filter(item => item.entry.side === side);
  const exact = current.find(item => item.handle === input);
  if (exact) {
    return { kind: used.has(exact.entry.id) ? 'already-used' : 'match', entry: exact.entry,
      entryId: exact.entry.id, matchType: input === normalizeInput(exact.entry.answer) ? 'exact' : 'alias' };
  }
  // Never redirect an exact opposite-side answer into a loose current-side match.
  const other = handles.find(item => item.entry.side !== side && item.handle === input);
  if (other) return { kind: 'wrong-side', entry: other.entry, entryId: other.entry.id };
  if (input.replace(/\s/g, '').length <= 3) return { kind: 'no-match' };

  const candidates = new Map();
  for (const item of current) {
    if (item.handle.replace(/\s/g, '').length <= 3 || negations(input) !== negations(item.handle)) continue;
    const length = Math.max(input.length, item.handle.length);
    const maxDistance = length <= 7 ? 1 : length <= 14 ? 2 : 3;
    if (Math.abs(input.length - item.handle.length) > maxDistance) continue;
    const distance = editDistance(input, item.handle);
    const similarity = 1 - distance / length;
    if (distance > maxDistance || similarity < 0.72) continue;
    const existing = candidates.get(item.entry.id);
    if (!existing || similarity > existing.similarity) {
      candidates.set(item.entry.id, { ...item, distance, similarity });
    }
  }
  const ranked = [...candidates.values()].sort((a, b) => b.similarity - a.similarity);
  if (!ranked.length) return { kind: 'no-match' };
  const best = ranked[0];
  if (ranked[1] && best.similarity - ranked[1].similarity < 0.12) return { kind: 'ambiguous' };
  if (used.has(best.entry.id)) return { kind: 'already-used', entry: best.entry, entryId: best.entry.id };
  const confident = (best.distance === 1 && best.similarity >= 0.8) || best.similarity >= 0.88;
  return { kind: confident ? 'match' : 'suggestion', entry: best.entry, entryId: best.entry.id,
    matchType: 'typo', distance: best.distance };
}
