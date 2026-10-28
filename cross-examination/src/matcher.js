export function normalizeInput(value) {
  return String(value).normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[’‘']/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().replace(/\s+/g, ' ');
}
function nameForm(value) { return normalizeInput(value).replace(/^(?:(?:a|an|the)\s+)+/, ''); }
function singular(word) {
  const irregular = { mice: 'mouse', geese: 'goose', feet: 'foot', teeth: 'tooth', children: 'child', octopi: 'octopus', dice: 'die' };
  if (irregular[word]) return irregular[word];
  if (word.length > 4 && word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.length > 4 && /(?:ches|shes|xes|zes|sses|uses)$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !/(?:ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}
const variantForm = value => nameForm(value).split(' ').map(singular).join('');
const compact = value => nameForm(value).replace(/\s/g, '');
const rawCompact = value => normalizeInput(value).replace(/\s/g, '');
const negation = value => nameForm(value).split(' ').filter(word => ['no', 'not', 'never', 'without', 'isnt', 'cant', 'dont'].includes(word)).sort().join('|');

// Adjacent swapped letters count as one typo, as do insertion/deletion/replacement.
export function editDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
  }
  return rows[a.length][b.length];
}
const indexes = new WeakMap();
function indexFor(prompt) {
  if (indexes.has(prompt)) return indexes.get(prompt);
  const handles = prompt.entries.flatMap(entry => [entry.answer, ...entry.aliases].map(handle =>
    ({ entry, handle, name: nameForm(handle), compact: compact(handle), rawCompact: rawCompact(handle), variant: variantForm(handle), negation: negation(handle) })));
  const rejected = (prompt.rejected ?? []).flatMap(entry => [entry.answer, ...entry.aliases].map(handle =>
    ({ entry, name: nameForm(handle), compact: compact(handle), rawCompact: rawCompact(handle), variant: variantForm(handle) })));
  const index = { handles, rejected }; indexes.set(prompt, index); return index;
}
function sameForm(item, input) { return item.name === input.name || item.compact === input.compact || item.rawCompact === input.rawCompact || item.variant === input.variant; }
function answerResult(item, input, used, matchType) {
  return { kind: used.has(item.entry.id) ? 'already-used' : 'match', entry: item.entry,
    entryId: item.entry.id, matchType, matchedHandle: item.handle };
}
export function matchInput(prompt, raw, usedEntryIds = []) {
  const trimmed = String(raw).trim();
  const input = { name: nameForm(trimmed), compact: compact(trimmed), rawCompact: rawCompact(trimmed), variant: variantForm(trimmed) };
  if (!input.name || trimmed.length > 60 || input.name.split(/\s+/).length > 6) return { kind: 'invalid', reason: !input.name ? 'Name one thing first.' : 'Just a name: up to 6 words and 60 characters.' };
  const used = new Set(usedEntryIds), index = indexFor(prompt);
  // Known non-examples are a hard boundary, including plurals and harmless formatting.
  const invalid = index.rejected.find(item => sameForm(item, input));
  if (invalid) return { kind: 'rejected', reason: invalid.entry.reason };
  const exact = index.handles.find(item => item.name === input.name);
  if (exact) return answerResult(exact, input, used, input.name === nameForm(exact.entry.answer) ? 'exact' : 'alias');
  const variant = index.handles.find(item => sameForm(item, input));
  if (variant) return answerResult(variant, input, used, 'variant');

  const signature = negation(trimmed), ranked = new Map();
  for (const item of index.handles) {
    if (signature !== item.negation) continue;
    const length = Math.max(input.compact.length, item.compact.length);
    const limit = length <= 5 ? 1 : length <= 11 ? 2 : length <= 20 ? 3 : 4;
    if (Math.abs(input.compact.length - item.compact.length) > limit) continue;
    const distance = editDistance(input.compact, item.compact), similarity = 1 - distance / length;
    if (distance > limit || similarity < .62) continue;
    const score = similarity;
    if (!ranked.has(item.entry.id) || score > ranked.get(item.entry.id).score) ranked.set(item.entry.id, { ...item, distance, similarity, score });
  }
  const candidates = [...ranked.values()].sort((a, b) => b.score - a.score || a.distance - b.distance || a.entry.answer.localeCompare(b.entry.answer));
  const best = candidates[0], margin = best ? best.score - (candidates[1]?.score ?? 0) : 0;
  // Correct a clear typo in a known non-example instead of awarding a different nearby noun.
  if (input.compact.length >= 4) {
    const blocked = index.rejected.find(item => Math.abs(item.compact.length - input.compact.length) <= 1 &&
      editDistance(input.compact, item.compact) <= 1 && (!best || best.distance > 1));
    if (blocked) return { kind: 'rejected', reason: blocked.entry.reason };
  }
  const confident = best && input.compact.length >= 4 && best.handle.length >= 4 && margin >= .065 &&
    ((best.distance === 1 && best.similarity >= .72) || (best.distance <= 2 && best.similarity >= .8) || best.similarity >= .89);
  if (confident) return answerResult(best, input, used, 'typo');

  // Incomplete names offer explicit choices. They never silently become a scored answer.
  if (input.compact.length >= 3 && !signature) {
    for (const item of index.handles) {
      const prefix = item.compact.startsWith(input.compact) && input.compact.length / item.compact.length >= .3;
      const fuzzyPrefix = input.compact.length >= 5 && item.compact.length > input.compact.length &&
        editDistance(input.compact, item.compact.slice(0, input.compact.length)) <= 1;
      if (!prefix && !fuzzyPrefix) continue;
      const score = prefix ? .9 + input.compact.length / item.compact.length * .08 : .73;
      if (!ranked.has(item.entry.id) || score > ranked.get(item.entry.id).score) ranked.set(item.entry.id, { ...item, distance: null, score, prefix: true });
    }
  }
  const suggestions = [...ranked.values()].sort((a, b) => b.score - a.score || a.entry.answer.length - b.entry.answer.length || a.entry.answer.localeCompare(b.entry.answer)).slice(0, 3)
    .map(item => ({ entry: item.entry, entryId: item.entry.id, matchedHandle: item.handle }));
  if (!suggestions.length) return { kind: 'no-match' };
  const ambiguous = candidates.length > 1 && margin < .065 && ![...ranked.values()].some(item => item.prefix);
  return { kind: ambiguous ? 'ambiguous' : 'suggestion', ...(ambiguous ? {} : { entry: suggestions[0].entry, entryId: suggestions[0].entryId }), suggestions };
}
