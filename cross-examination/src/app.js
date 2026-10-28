import { normalizeInput, matchInput } from './matcher.js';
import { playableQuestion, createRun, commitTurn, advanceRun, sideForTurn, oppositeSide,
  totalScore, restoreRun, shareText } from './game.js';

const main = document.querySelector('#main');
const announcer = document.querySelector('#announcer');
const RUN_KEY = 'cross-examination:prototype:run:v1';
const MODE_KEY = 'cross-examination:prototype:mode';
const h = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const sideName = side => side === 'for' ? 'FOR' : 'AGAINST';
const tierName = tier => ({ obvious: 'Obvious', familiar: 'Familiar', clever: 'Clever', 'deep-cut': 'Deep cut', 'left-field': 'Left field' }[tier] ?? 'An angle');
let question, latestQuestion, run = null, mode = 'timed', attempted = false, composing = false;
let storageAvailable = true;
let lastClockWarning = '';
let newBest = false;
let manifest = null, caseNumber = '001';
const runKey = () => `${RUN_KEY}:${question.id}`;

function readStorage(key) {
  try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; }
}
function writeStorage(key, value) {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); }
  catch { storageAvailable = false; }
}
function persist() { writeStorage(runKey(), run ? JSON.stringify(run) : null); }
function announce(text) { announcer.textContent = ''; requestAnimationFrame(() => { announcer.textContent = text; }); }
function entryFor(turn) { return question.entries.find(entry => entry.id === turn.entryId); }
function acceptedPhraseCount() {
  return new Set(question.entries.flatMap(entry => [entry.answer, ...entry.aliases]).map(normalizeInput)).size;
}
function bestKey(playMode = mode) { return `cross-examination:best:${question.id}:v${question.version}:${playMode}`; }
function bestScore(playMode = mode) {
  const stored = readStorage(bestKey(playMode));
  if (stored === null) return null;
  const value = Number(stored);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function saveBest() {
  const previous = bestScore(run.mode);
  newBest = previous === null || totalScore(run) > previous;
  if (newBest) writeStorage(bestKey(run.mode), String(totalScore(run)));
}

const burgerArt = `<svg class="burger-art" viewBox="0 0 400 320" aria-hidden="true">
  <ellipse cx="200" cy="285" rx="140" ry="15" fill="#182b26" opacity=".12"/>
  <path d="M68 128C68 57 128 35 200 35s132 22 132 93Z" fill="#efad68" stroke="#182b26" stroke-width="5"/>
  <path d="M68 128h264v21H68z" fill="#f3bf81" stroke="#182b26" stroke-width="5"/>
  <path d="m67 155 32-10 27 15 31-14 36 15 33-15 32 12 42-13 34 12-8 24H75Z" fill="#78a87b" stroke="#182b26" stroke-width="5" stroke-linejoin="round"/>
  <rect x="70" y="180" width="260" height="40" rx="18" fill="#684130" stroke="#182b26" stroke-width="5"/>
  <path d="m75 178 83-9 43 33 38-30 89 7-7 9-80-6-37 37-49-35-80 6Z" fill="#f1f95d" stroke="#182b26" stroke-width="4" stroke-linejoin="round"/>
  <path d="M73 228h254v21c0 20-34 27-127 27s-127-7-127-27Z" fill="#efad68" stroke="#182b26" stroke-width="5"/>
  <g stroke="#f8f4e8" stroke-width="7" stroke-linecap="round"><path d="m116 99 10-6m31-28 8 6m38-16-4 9m42-2 8 8m37 31 9-4m-72 6 10 3m-61-6-7 7"/></g>
</svg>`;

const bowlArt = `<svg class="burger-art" viewBox="0 0 400 320" aria-hidden="true"><ellipse cx="200" cy="279" rx="135" ry="14" fill="#182b26" opacity=".12"/><path d="m292 133 46-87" stroke="#182b26" stroke-width="17" stroke-linecap="round"/><path d="M65 144h270c-4 82-53 125-135 125S69 226 65 144Z" fill="#78a87b" stroke="#182b26" stroke-width="5"/><ellipse cx="200" cy="144" rx="135" ry="37" fill="#fffdf5" stroke="#182b26" stroke-width="5"/><g fill="#efad68" stroke="#182b26" stroke-width="3"><ellipse cx="131" cy="137" rx="16" ry="10" transform="rotate(-20 131 137)"/><ellipse cx="187" cy="154" rx="17" ry="9" transform="rotate(25 187 154)"/><ellipse cx="248" cy="136" rx="17" ry="10" transform="rotate(-15 248 136)"/><ellipse cx="205" cy="125" rx="14" ry="8"/><ellipse cx="282" cy="153" rx="13" ry="8"/></g></svg>`;
const bookArt = `<svg class="burger-art" viewBox="0 0 400 320" aria-hidden="true"><ellipse cx="200" cy="280" rx="135" ry="14" fill="#182b26" opacity=".12"/><path d="M64 111c60-17 101-8 136 16 35-24 76-33 136-16v143c-62-15-101-7-136 12-35-19-74-27-136-12Z" fill="#fffdf5" stroke="#182b26" stroke-width="5"/><path d="M200 127v139" stroke="#182b26" stroke-width="5"/><g stroke="#9cad92" stroke-width="4"><path d="m85 146 87 12m-87 14 87 13m-87 12 87 13m55-52 87-12m-87 39 87-13m-87 38 87-13"/></g><path d="M100 126V98a100 83 0 0 1 200 0v28" fill="none" stroke="#182b26" stroke-width="15"/><rect x="83" y="102" width="34" height="62" rx="13" fill="#edf65c" stroke="#182b26" stroke-width="5"/><rect x="283" y="102" width="34" height="62" rx="13" fill="#edf65c" stroke="#182b26" stroke-width="5"/></svg>`;

function storageNote() {
  return storageAvailable ? '' : '<p class="storage-note">Progress cannot be saved in this browser. Keep this tab open to finish your run.</p>';
}

function renderIntro() {
  const best = bestScore();
  const words = question.question.split(' ');
  const last = words.pop();
  const article = words.at(-1) === 'a' ? `${words.pop()} ` : '';
  const title = `${h(words.join(' '))}<br>${article}<em>${h(last)}</em>`;
  const art = question.id === 'audiobook-reading' ? bookArt : question.id === 'cereal-soup' ? bowlArt : burgerArt;
  const caption = question.id === 'audiobook-reading' ? 'A book. A voice. A page-turning question.' : question.id === 'cereal-soup' ? 'Some milk. Some cereal. Some strong opinions.' : 'A bun. A patty. A matter of principle.';
  main.innerHTML = `<section class="intro" aria-labelledby="case-title">
    <div class="intro-copy"><p class="eyebrow"><span class="tiny-star" aria-hidden="true">✳</span> CASE ${caseNumber} · ${h(question.category.toUpperCase())}</p>
      <h1 id="case-title" class="${question.question.length > 28 ? 'long-question' : ''}">${title}</h1>
      <p class="intro-description">Pick an angle. Switch sides.<br>Get points for thinking twice.</p>
      ${manifest.questions.length > 1 ? `<div class="case-picker"><label for="case-select">PICK A SMALL HILL</label><select id="case-select">${manifest.questions.map(item => `<option value="${h(item.id)}" ${item.id === question.id ? 'selected' : ''}>${h(item.title ?? item.id)}</option>`).join('')}</select></div>` : ''}
      <fieldset class="mode-switch"><legend class="sr-only">Play style</legend>
        <label class="${mode === 'timed' ? 'selected' : ''}"><input type="radio" name="mode" value="timed" ${mode === 'timed' ? 'checked' : ''}><span>25-second turns</span></label>
        <label class="${mode === 'relaxed' ? 'selected' : ''}"><input type="radio" name="mode" value="relaxed" ${mode === 'relaxed' ? 'checked' : ''}><span>No timer</span></label>
      </fieldset>
      <button class="button primary start-button" id="start-button">Open the case <span aria-hidden="true">↗</span></button>
      <p class="intro-fine">6 turns · 1–4 words · both sides of the argument</p>
      ${best === null ? '' : `<p class="best-note">Your ${mode === 'timed' ? 'timed' : 'relaxed'} best <strong>${best} pts</strong></p>`}
      ${storageNote()}
    </div>
    <div class="evidence-art"><div class="evidence-label">EXHIBIT A <span>${caseNumber} / ${h(question.category.toUpperCase())}</span></div>${art}
      <div class="evidence-stamp">OPEN TO<br>ARGUMENT</div><p class="art-caption">${caption}</p>
      <span class="art-note">No strong opinions<br>required. Just a few.</span></div>
  </section>
  <section class="intro-bottom" aria-label="Game overview"><div><span class="step-number">01</span><h2>Find a fresh angle.</h2><p>Type a feature or a familiar example. We supply the argument.</p></div><div><span class="step-number">02</span><h2>Take the other side.</h2><p>FOR, then AGAINST. You are your own worthy opponent.</p></div><div><span class="step-number">03</span><h2>Land a counterpunch.</h2><p>Challenge an earlier angle for a little extra satisfaction. And +20.</p></div></section>
  <p class="prototype-note"><span class="mini-dot"></span> ${question.entries.length} ANGLES · ${acceptedPhraseCount()} WAYS TO SAY THEM · A LITTLE PROOF OF CONCEPT.</p>`;
  main.dataset.phase = 'intro';
  document.querySelector('#start-button').addEventListener('click', () => {
    run = createRun(question, mode); attempted = false; persist(); render();
    announce(`Turn 1. Argue ${sideName(sideForTurn(question, 0))}. ${mode === 'timed' ? '25 seconds.' : 'No timer.'}`);
  });
  document.querySelectorAll('input[name="mode"]').forEach(input => input.addEventListener('change', () => {
    mode = input.value; writeStorage(MODE_KEY, mode); renderIntro();
    document.querySelector(`input[value="${mode}"]`).focus();
  }));
  document.querySelector('#case-select')?.addEventListener('change', event => {
    const url = new URL(location.href); url.searchParams.set('case', event.target.value); location.assign(url);
  });
}

function progress() {
  const active = run.phase === 'turn' ? run.history.length : run.history.length - 1;
  return `<ol class="turn-track" aria-label="Six alternating turns">${Array.from({ length: question.rules.turns }, (_, index) => {
    const turn = run.history[index];
    const side = sideForTurn(question, index);
    return `<li class="${side} ${index === active ? 'current' : ''} ${turn ? 'done' : ''}" ${index === active ? 'aria-current="step"' : ''}>
      <span class="turn-number">0${index + 1}</span><strong>${sideName(side)}</strong><small>${turn ? `${turn.total} pts${turn.bonusPoints ? ' ✳' : ''}` : index === active ? 'YOUR TURN' : 'UP NEXT'}</small></li>`;
  }).join('')}</ol>`;
}

function recordList() {
  if (!run.history.length) return `<div class="empty-record"><span aria-hidden="true">↗</span><p>A blank record.<br>An extremely important question.</p><small>Your angles will collect here.</small></div>`;
  const target = run.phase === 'reveal' ? run.history.at(-1)?.counterTargetId : null;
  return `<ol class="record-list">${run.history.map(turn => {
    const entry = entryFor(turn);
    return `<li class="record-item ${turn.entryId && turn.entryId === target ? 'counter-target' : ''}"><div class="record-meta"><span class="side-tag ${turn.side}">${sideName(turn.side)}</span><span>TURN ${turn.turnIndex + 1}</span><b>${turn.total ? '+' : ''}${turn.total}</b></div>
      ${entry ? `<details><summary>${h(entry.answer)}${turn.bonusPoints ? '<span class="counter-star" aria-label="Counterpunch">✳</span>' : ''}</summary><p>${h(entry.reveal)}</p>${turn.counterReveal ? `<p class="record-counter">+20 counterpunch: ${h(turn.counterReveal)}</p>` : ''}</details>` : `<p class="pass-record">${turn.kind === 'timeout' ? 'Time called.' : 'Passed for now.'}</p>`}</li>`;
  }).join('')}</ol>`;
}

function renderTurnCard() {
  const side = sideForTurn(question, run.history.length);
  return `<section class="answer-card ${side}" aria-label="Current turn"><div class="answer-top"><p class="eyebrow">TURN ${run.history.length + 1} OF ${question.rules.turns}</p><div class="clock ${run.mode === 'relaxed' ? 'relaxed' : ''}" role="timer" aria-label="${run.mode === 'timed' ? 'Time remaining' : 'Untimed practice'}"><span id="clock-value">${run.mode === 'timed' ? '25' : '∞'}</span><small>${run.mode === 'timed' ? 'SEC' : 'NO CLOCK'}</small></div></div>
    <span class="stance-heading">Argue <strong>${sideName(side)}</strong><span aria-hidden="true">${side === 'for' ? '↗' : '↘'}</span></span>
    <p class="stance-description">${side === 'for' ? 'Find a reason to say yes.' : 'Find a reason to say no.'}</p>
    <form id="answer-form" novalidate><label for="angle-input">Name your angle.</label><div class="input-shell"><input id="angle-input" name="angle" placeholder="A feature, an idea, an example…" value="${h(run.draft)}" maxlength="40" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="done" aria-describedby="input-help match-preview"><span class="input-arrow" aria-hidden="true">↵</span></div>
      <div class="input-meta"><span id="input-help">1–4 words. Spelling is not on trial.</span><span id="word-counter">0 / 4</span></div>
      <div class="match-preview" id="match-preview" aria-live="polite"></div>
      <button class="button primary submit-button" id="submit-button" type="submit">Put it on record <span aria-hidden="true">↗</span></button>
    </form>
    <div class="turn-options"><button class="text-button muted" id="pass-button">Pass this turn</button><details class="nudge"><summary>Need a nudge?</summary><p>${question.category === 'food' ? 'Think of ingredients, how you eat it, what you call it, or a familiar food that makes a point.' : 'Think of everyday language, how it works, a familiar example, or the purpose it serves.'}</p></details></div>
    ${run.mode === 'timed' ? '<div class="timer-track" aria-hidden="true"><div id="timer-fill"></div></div>' : ''}
  </section>`;
}

function renderRevealCard() {
  const turn = run.history.at(-1);
  const entry = entryFor(turn);
  const nextSide = oppositeSide(turn.side);
  return `<section class="answer-card reveal-card ${turn.side}" aria-labelledby="reveal-title"><div class="answer-top"><p class="eyebrow">TURN ${turn.turnIndex + 1} · ON THE RECORD</p><span class="side-tag ${turn.side}">${sideName(turn.side)}</span></div>
    <div class="reveal-score">${turn.total ? '+' : ''}${turn.total}<span>PTS</span></div>
    <p class="tier-label">${entry ? `${h(tierName(entry.tier))} angle · ${turn.basePoints} base points` : turn.kind === 'timeout' ? 'THE CLOCK HAS SPOKEN' : 'AN HONORABLE PASS'}</p>
    <h2 id="reveal-title">${entry ? h(entry.answer) : turn.kind === 'timeout' ? 'Time called.' : 'Let that one go.'}</h2>
    <p class="reveal-copy">${entry ? h(entry.reveal) : 'There is another angle around the corner. Take a breath, then switch sides.'}</p>
    ${entry && normalizeInput(turn.input) !== normalizeInput(entry.answer) ? `<p class="recognized-from">Recognized from “${h(turn.input)}”</p>` : ''}
    ${turn.bonusPoints ? `<div class="counter-callout"><div><span aria-hidden="true">✳</span><strong>COUNTERPUNCH</strong><b>+20</b></div><p>${h(turn.counterReveal)}</p><small>Challenged your turn ${(turn.counterTargetTurn ?? 0) + 1}: ${h(question.entries.find(item => item.id === turn.counterTargetId)?.answer ?? '')}</small></div>` : ''}
    <button class="button primary continue-button" id="continue-button">${run.history.length === question.rules.turns ? 'Close the case' : `Switch to ${sideName(nextSide)}`} <span aria-hidden="true">${run.history.length === question.rules.turns ? '↗' : '↔'}</span></button>
    <p class="between-turns">The next clock starts when you do.</p></section>`;
}

function renderGame() {
  main.innerHTML = `<section class="game-heading"><div><p class="eyebrow">CASE ${caseNumber} · ${run.mode === 'timed' ? '25-SECOND TURNS' : 'RELAXED MODE'}</p><h1>${h(question.question)}</h1><p class="scope">${h(question.scope)}</p></div><div class="score-readout"><span>TOTAL SCORE</span><div><strong data-total-score>${totalScore(run)}</strong><small>PTS</small></div></div></section>
    ${progress()}<div class="game-layout">${run.phase === 'turn' ? renderTurnCard() : renderRevealCard()}
    <aside class="notebook" aria-label="Your previous arguments"><div class="notebook-heading"><h2>On the record</h2><span>${String(run.history.length).padStart(2, '0')} / 06</span></div>${recordList()}<p class="notebook-note">A fresh angle earns points.<br>A good counter earns a little more.</p></aside></div>
    <div class="game-bottom"><span><span class="mini-dot"></span> ${question.entries.length} AUTHORED ANGLES · ${question.status === 'example' ? 'EXAMPLE BANK' : 'QUESTION BANK'}</span><button class="text-button muted" id="restart-button">Start fresh ↗</button></div>${storageNote()}`;
  main.dataset.phase = run.phase;
  document.querySelector('#restart-button').addEventListener('click', () => document.querySelector('#restart-dialog').showModal());
  if (run.phase === 'turn') {
    const input = document.querySelector('#angle-input');
    input.addEventListener('compositionstart', () => { composing = true; });
    input.addEventListener('compositionend', () => { composing = false; updateDraft(); });
    input.addEventListener('input', updateDraft);
    document.querySelector('#answer-form').addEventListener('submit', event => {
      event.preventDefault(); if (composing || !run || run.phase !== 'turn') return;
      attempted = true;
      const match = currentMatch();
      if (match.kind === 'match') submitEntry(match.entryId);
      else { updatePreview(); announce(matchMessage(match)); document.querySelector('#confirm-suggestion')?.focus(); }
    });
    document.querySelector('#pass-button').addEventListener('click', () => finish({ kind: 'pass' }));
    updatePreview(); tick(); input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  } else {
    document.querySelector('#continue-button').addEventListener('click', () => {
      run = advanceRun(run); attempted = false; lastClockWarning = '';
      if (run.phase === 'complete') saveBest();
      persist(); render();
      if (run.phase === 'turn') announce(`Turn ${run.history.length + 1}. Argue ${sideName(sideForTurn(question, run.history.length))}.`);
    });
    document.querySelector('#continue-button').focus({ preventScroll: true });
  }
}

function updateDraft() {
  if (!run || run.phase !== 'turn') return;
  run.draft = document.querySelector('#angle-input').value;
  attempted = false; persist(); if (!composing) updatePreview();
}
function currentMatch() {
  return matchInput(question, run.draft, sideForTurn(question, run.history.length), run.history.map(turn => turn.entryId).filter(Boolean));
}
function matchMessage(match) {
  if (match.kind === 'wrong-side') return `That angle is ${sideName(match.entry.side)}. You are arguing ${sideName(sideForTurn(question, run.history.length))}.`;
  if (match.kind === 'already-used') return `Already on record: ${match.entry.answer}. Try a fresh angle.`;
  if (match.kind === 'ambiguous') return 'That could mean a few things. Be a little more specific.';
  if (match.kind === 'invalid') return match.reason;
  if (match.kind === 'suggestion') return `Did you mean ${match.entry.answer}? Confirm the suggestion to use it.`;
  return 'No match in this small example bank. Try another angle.';
}
function updatePreview() {
  if (!run || run.phase !== 'turn') return;
  const target = document.querySelector('#match-preview');
  const match = currentMatch();
  const words = run.draft.trim() ? run.draft.trim().split(/\s+/).length : 0;
  document.querySelector('#word-counter').textContent = `${words} / 4`;
  document.querySelector('#word-counter').classList.toggle('over-limit', words > 4);
  target.className = 'match-preview';
  if (!run.draft.trim()) target.innerHTML = '<span class="preview-mark" aria-hidden="true">↳</span><span>A few words can make a whole argument.</span>';
  else if (match.kind === 'match') {
    target.classList.add('matched');
    target.innerHTML = `<span class="preview-mark" aria-hidden="true">✓</span><span>Reading this as <strong>${h(match.entry.answer)}</strong>${match.matchType === 'typo' ? '<small>SPELLING RESCUED</small>' : ''}</span>`;
  } else if (match.kind === 'suggestion') {
    target.classList.add('suggested');
    target.innerHTML = `<span>Did you mean <strong>${h(match.entry.answer)}</strong>?</span><button type="button" id="confirm-suggestion">Use this angle ↗</button>`;
    document.querySelector('#confirm-suggestion').addEventListener('click', () => submitEntry(match.entryId, true));
  } else if (attempted || ['wrong-side', 'already-used', 'ambiguous'].includes(match.kind) || words > 4) {
    target.classList.add('needs-work'); target.textContent = matchMessage(match);
  } else target.innerHTML = '<span class="preview-mark" aria-hidden="true">↳</span><span>Name a feature, an idea, or a familiar example.</span>';
}
function submitEntry(entryId, confirmed = false) {
  if (!run || run.phase !== 'turn') return;
  const match = currentMatch();
  if (match.entryId !== entryId || !(match.kind === 'match' || (confirmed && match.kind === 'suggestion'))) return;
  finish({ kind: 'answer', entryId, input: run.draft });
}
function finish(move) {
  if (!run || run.phase !== 'turn') return;
  run = commitTurn(run, move); persist(); render();
  const turn = run.history.at(-1);
  announce(`${entryFor(turn)?.answer ?? (turn.kind === 'timeout' ? 'Time called' : 'Passed')}. ${turn.total} points.${turn.bonusPoints ? ' Counterpunch! 20 bonus points.' : ''}`);
}

function tick() {
  if (!run || run.phase !== 'turn' || run.mode !== 'timed') return;
  const milliseconds = run.deadline - Date.now();
  if (milliseconds <= 0) { finish({ kind: 'timeout' }); return; }
  const seconds = Math.ceil(milliseconds / 1000);
  const clock = document.querySelector('#clock-value');
  if (clock) {
    clock.textContent = seconds;
    clock.parentElement.classList.toggle('urgent', seconds <= 5);
    document.querySelector('#timer-fill').style.width = `${Math.max(0, Math.min(100, milliseconds / (question.rules.secondsPerTurn * 10)))}%`;
  }
  const warningKey = `${run.history.length}:${seconds}`;
  if ([10, 5].includes(seconds) && lastClockWarning !== warningKey) { lastClockWarning = warningKey; announce(`${seconds} seconds remaining.`); }
}

function bankExplorer() {
  const card = entry => {
    const phrases = new Set([entry.answer, ...entry.aliases].map(normalizeInput));
    const links = entry.counters.map(counter => `<li><a href="#bank-${h(counter.targetId)}">${h(question.entries.find(item => item.id === counter.targetId)?.answer ?? '')} ↗</a><p>${h(counter.reveal)}</p></li>`).join('');
    return `<article id="bank-${h(entry.id)}"><div><h4>${h(entry.answer)}</h4><b>${entry.points} pts</b></div><p>${h(entry.reveal)}</p>
      <details class="bank-phrases"><summary>${phrases.size} accepted phrases</summary><small>${[entry.answer, ...entry.aliases].map(h).join(', ')}</small></details>
      ${links ? `<details class="bank-counters"><summary>Directly counters ${entry.counters.length} earlier angle${entry.counters.length === 1 ? '' : 's'}</summary><ul>${links}</ul></details>` : '<small class="no-counter">No counterpunch links for this angle.</small>'}</article>`;
  };
  return `<details class="bank-explorer"><summary>Explore the answer bank <span>SPOILERS AHEAD ↗</span></summary><p class="fine-print">${question.entries.length} authored angles and ${acceptedPhraseCount()} accepted phrases. Open a card’s counter links to see which earlier arguments it can challenge. Points are editorial; a counterpunch needs its target on your record.</p><div class="bank-columns">${['for', 'against'].map(side => `<div><h3 class="side-tag ${side}">${sideName(side)}</h3>${question.entries.filter(entry => entry.side === side).map(card).join('')}</div>`).join('')}</div></details>`;
}

function renderResults() {
  const answered = run.history.filter(turn => turn.entryId).length;
  const counters = run.history.filter(turn => turn.bonusPoints).length;
  main.innerHTML = `<section class="results-heading"><p class="eyebrow"><span class="tiny-star" aria-hidden="true">✳</span> CASE CLOSED · ${run.mode === 'timed' ? 'TIMED' : 'RELAXED'}</p><h1>Well, that<br>was <em>debatable.</em></h1><p>${answered ? 'Both sides have been heard. The case remains delightfully complicated.' : 'Some hills are for another day. There is always a fresh angle.'}</p></section>
    <section class="result-scorecard" aria-label="Your final score"><div class="final-score"><span>POINTS ON RECORD</span><strong data-final-score>${totalScore(run)}</strong><small>${newBest ? '✳ A NEW PERSONAL BEST' : `PERSONAL BEST · ${bestScore(run.mode) ?? totalScore(run)} PTS`}</small></div><div class="result-stats"><div><strong>${answered}<span>/ 6</span></strong><p>angles on record</p></div><div><strong>${counters}<span>× +20</span></strong><p>counterpunch${counters === 1 ? '' : 'es'} landed</p></div><div><strong>${run.mode === 'timed' ? '25' : '∞'}<span>${run.mode === 'timed' ? 'SEC' : 'TIME'}</span></strong><p>${run.mode === 'timed' ? 'per turn' : 'a little room to think'}</p></div></div></section>
    <div class="result-actions"><button class="button primary" id="copy-button">Copy result <span aria-hidden="true">↗</span></button><button class="button secondary" id="replay-button">Play again <span aria-hidden="true">↺</span></button></div>
    <section class="completed-record"><div class="section-heading"><h2>Your six little hills</h2><span>THE COMPLETE RECORD</span></div>${recordList()}</section>${bankExplorer()}${storageNote()}`;
  main.dataset.phase = 'complete';
  document.querySelector('#copy-button').addEventListener('click', async event => {
    const button = event.currentTarget;
    try { await navigator.clipboard.writeText(shareText(run)); button.textContent = 'Copied ✓'; announce('Result copied.'); }
    catch { const output = document.querySelector('#share-output'); output.value = shareText(run); document.querySelector('#share-dialog').showModal(); output.focus(); output.select(); }
  });
  document.querySelector('#replay-button').addEventListener('click', resetToIntro);
  document.querySelector('#copy-button').focus({ preventScroll: true });
}

function resetToIntro() {
  run = null; question = latestQuestion; newBest = false; attempted = false; persist(); render();
  document.querySelector('#start-button').focus({ preventScroll: true });
}
function render() {
  if (!run) renderIntro();
  else if (run.phase === 'complete') renderResults();
  else renderGame();
}

document.querySelector('#help-button').addEventListener('click', () => document.querySelector('#help-dialog').showModal());
document.querySelector('#cases-button').addEventListener('click', () => document.querySelector('#cases-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelector('#confirm-restart').addEventListener('click', () => { document.querySelector('#restart-dialog').close(); resetToIntro(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
window.addEventListener('pageshow', tick);

async function load() {
  try {
    const manifestUrl = new URL('../content/manifest.json', import.meta.url);
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error('Manifest unavailable.');
    manifest = await response.json();
    const requested = new URL(location.href).searchParams.get('case') ?? manifest.defaultQuestion;
    const selected = manifest.questions.find(item => item.id === requested) ?? manifest.questions.find(item => item.id === manifest.defaultQuestion);
    if (!selected) throw new Error('Question unavailable.');
    const contentResponse = await fetch(new URL(selected.file, manifestUrl));
    if (!contentResponse.ok) throw new Error('Question unavailable.');
    latestQuestion = playableQuestion(await contentResponse.json());
    if (latestQuestion.id !== selected.id) throw new Error('Manifest does not match question.');
    caseNumber = String(manifest.questions.indexOf(selected) + 1).padStart(3, '0');
    question = latestQuestion;
    const storedMode = readStorage(MODE_KEY);
    mode = storedMode === 'relaxed' ? 'relaxed' : 'timed';
    let storedRun = readStorage(runKey());
    const legacyRun = readStorage(RUN_KEY);
    if (!storedRun && legacyRun && restoreRun(legacyRun)?.question.id === latestQuestion.id) {
      storedRun = legacyRun;
      writeStorage(runKey(), legacyRun);
      writeStorage(RUN_KEY, null);
    }
    run = restoreRun(storedRun);
    if (run && run.question.id !== latestQuestion.id) run = null;
    question = run?.question ?? latestQuestion;
    document.querySelector('#case-links').innerHTML = manifest.questions.map(item => `<a href="?case=${encodeURIComponent(item.id)}" ${item.id === question.id ? 'aria-current="page"' : ''}>${h(item.title ?? item.id)} <span aria-hidden="true">↗</span></a>`).join('');
    document.querySelector('#cases-button').disabled = false;
    document.querySelector('#help-bank-note').textContent = `Spelling is not on trial. Clear typos get a visible correction; uncertain ones need your confirmation. This case has ${question.entries.length} authored angles with fixed editorial scores.`;
    if (run) mode = run.mode;
    if (run?.phase === 'complete') saveBest();
    render();
    setInterval(tick, 200);
  } catch (error) {
    console.error('Could not open the case:', error);
    main.innerHTML = '<section class="load-error"><p class="eyebrow">A SMALL OBJECTION</p><h1>The case file<br>did not open.</h1><p>Use the local preview link and try again. All game files need to be served together.</p><button class="button primary" id="retry-button">Try again ↗</button></section>';
    document.querySelector('#retry-button').addEventListener('click', () => location.reload());
  }
}
load();
