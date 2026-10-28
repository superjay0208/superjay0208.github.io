import { matchInput } from './matcher.js?v=2';
import { playableQuestion, createRun, currentEntry, currentSide, availableClaims, availableCounters,
  selectFresh, selectClaim, matchContext, nextMultiplier, usedIds, commitAnswer, totalScore, restoreRun, shareText } from './game.js?v=2';

const main = document.querySelector('#main');
const h = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = value => value.toLocaleString('en-US');
const tierName = tier => ({ obvious: 'Classic', familiar: 'Good angle', clever: 'Clever', 'deep-cut': 'Deep cut', 'left-field': 'Wild card' }[tier] ?? 'Good angle');
let question, manifest, run, attempted = false, composing = false, sound = false, audio, storageAvailable = true;
let lastCorrection = '';
function read(key) { try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; } }
function write(key, value) { try { localStorage.setItem(key, value); } catch { storageAvailable = false; } }
const runKey = () => `cross-examination:chain:v2:${question.id}`;
const bestKey = () => `cross-examination:chain:best:${question.id}:${question.version}`;
function persist() { write(runKey(), JSON.stringify(run)); }
function announce(text) { document.querySelector('#announcer').textContent = text; }
function focusInput() {
  const input = document.querySelector('#answer-input');
  input?.focus({ preventScroll: true });
  input?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
function changeSelection(next) { run = next; attempted = false; lastCorrection = ''; persist(); render(); focusInput(); }
function scoreHeader() {
  return `<div class="scorebar"><div class="move-count"><div class="pips" aria-hidden="true">${Array.from({ length: question.rules.turns }, (_, i) => `<i class="${i < run.history.length ? 'filled' : ''}"></i>`).join('')}</div><span>${run.history.length} / ${question.rules.turns} moves</span></div><div class="score-total"><span>YOUR SCORE</span><strong id="score-number">${fmt(totalScore(run))}</strong></div></div>`;
}
function casePicker() {
  return `<div class="case-select-wrap"><label for="case-select" class="sr-only">Choose a question</label><select id="case-select">${manifest.questions.map(item => `<option value="${h(item.id)}" ${item.id === question.id ? 'selected' : ''}>${h(item.shortTitle ?? item.title?.replace(' · expanded bank', '') ?? item.id)}</option>`).join('')}</select><span aria-hidden="true">↗</span></div>`;
}
function quoteHTML(entry) {
  const available = new Set(run.phase === 'playing' ? availableClaims(run).map(claim => claim.id) : []);
  const spans = entry.claims.map(claim => ({ ...claim, start: entry.reveal.indexOf(claim.text) })).sort((a, b) => a.start - b.start);
  let cursor = 0, output = '';
  for (const claim of spans) {
    output += h(entry.reveal.slice(cursor, claim.start));
    const selected = run.selection?.kind === 'counter' && run.selection.claimId === claim.id;
    // An inline span can fragment across lines inside the sentence; native button boxes cannot.
    output += available.has(claim.id) ? `<span role="button" tabindex="0" class="claim ${selected ? 'selected' : ''}" data-claim="${h(claim.id)}" aria-pressed="${selected}" aria-label="Challenge: ${h(claim.text)}">${h(claim.text)}<span class="claim-arrow" aria-hidden="true">↗</span></span>` : h(claim.text);
    cursor = claim.start + claim.text.length;
  }
  return output + h(entry.reveal.slice(cursor));
}
function argumentCard() {
  const entry = currentEntry(run), turn = run.history.at(-1);
  const previous = run.history.length > 1 ? run.history.at(-2) : null;
  const counter = turn?.context.kind === 'counter';
  const previousEntry = previous && question.entries.find(item => item.id === previous.entryId);
  const target = counter && previousEntry?.claims.find(claim => claim.id === turn.context.claimId);
  return `<section class="argument-stage ${entry.side} ${counter ? 'counter-stage' : ''}" aria-label="Your latest argument">
    <div class="argument-meta"><span class="position-tag">${entry.side === 'for' ? 'YES, IT IS.' : 'NO, IT ISN’T.'}</span><span class="angle-label">${h(entry.answer)}</span><span class="earned">+${fmt(turn.total)}</span></div>
    ${target ? `<p class="defeated"><span aria-hidden="true">↳</span> <s>${h(target.text)}</s><span class="defeated-label">COUNTERED</span></p>` : ''}
    <blockquote class="argument-sentence" id="argument-sentence">${quoteHTML(entry)}</blockquote>
    <div class="argument-bottom"><span>${run.phase === 'complete' ? 'CASE CLOSED. FOR NOW.' : availableClaims(run).length ? 'CLICK AN UNDERLINED CLAIM TO TAKE IT APART' : 'THIS ANGLE IS TAPPED OUT. FIND A FRESH ONE.'}</span><div class="multiplier-stamp ${counter ? 'hot' : ''}" aria-label="Current multiplier ${turn.multiplier}">×${turn.multiplier}</div></div>
  </section>`;
}
function composer() {
  if (!run.selection) return `<div class="next-move"><p>${availableClaims(run).length ? 'Think you can beat your own argument?' : 'Some arguments have the last word.'}</p><button class="fresh-button" id="fresh-button">${availableClaims(run).length ? 'Or try a fresh angle' : 'Try a fresh angle'} <span aria-hidden="true">↗</span></button><span class="reset-note">starts a new chain at ×1</span></div>`;
  const counter = run.selection.kind === 'counter';
  const entry = currentEntry(run);
  const claim = counter && entry.claims.find(item => item.id === run.selection.claimId);
  const example = question.id === 'audiobook-reading' ? 'same story' : question.id === 'cereal-soup' ? 'bowl' : 'handheld';
  return `<section class="composer ${counter ? 'counter-composer' : ''}" aria-label="Your next answer">
    <div class="composer-label">${counter ? `<span class="counter-icon" aria-hidden="true">↶</span><label for="answer-input">Counter “${h(claim.text)}”</label><span class="next-multiplier">NEXT ×${nextMultiplier(run)}</span>` : `<label for="answer-input">${run.history.length ? 'A fresh angle.' : 'Make your case.'}</label><div class="side-picker" role="group" aria-label="Choose your side"><button type="button" data-side="for" aria-pressed="${currentSide(run) === 'for'}">Yes</button><button type="button" data-side="against" aria-pressed="${currentSide(run) === 'against'}">No</button></div>`}</div>
    <form id="answer-form" novalidate><div class="input-row"><input id="answer-input" name="angle" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="40" placeholder="${counter ? 'Name a counterexample…' : `e.g. ${example}…`}" value="${h(run.draft)}" aria-describedby="match-preview input-note"><button class="send-button" type="submit" aria-label="${counter ? 'Counter this claim' : 'Play this angle'}"><span aria-hidden="true">↗</span></button></div><div class="input-under"><p id="match-preview" role="status"></p><span id="input-note">1–4 words</span></div></form>
    <div class="composer-actions">${counter ? '<button class="fresh-button" id="fresh-button">Start a fresh angle ↗</button>' : run.history.length && availableClaims(run).length ? '<button class="fresh-button" id="back-button">↶ Back to the argument</button>' : '<span class="quiet-note">Spelling is not on trial.</span>'}<button class="hint-button" id="hint-button">Need a nudge?</button></div><p class="hint-text" id="hint-text"></p>
  </section>`;
}
function historyDetails() {
  if (!run.history.length) return '';
  return `<details class="history"><summary>Your trail <span>${run.history.length} angles</span></summary><ol>${run.history.map(turn => {
    const entry = question.entries.find(item => item.id === turn.entryId);
    return `<li><span class="trail-mark ${turn.context.kind === 'counter' ? 'is-counter' : ''}">${turn.context.kind === 'counter' ? '↶' : '•'}</span><div><strong>${h(entry.answer)}</strong><span>${turn.context.kind === 'counter' ? h(turn.counterReveal) : h(entry.reveal)}</span></div><b>${turn.basePoints} × ${turn.multiplier}<small>+${fmt(turn.total)}</small></b></li>`;
  }).join('')}</ol></details>`;
}
function results() {
  const score = totalScore(run), best = Number(read(bestKey()) ?? 0);
  if (score > best) write(bestKey(), String(score));
  const counters = run.history.filter(turn => turn.context.kind === 'counter').length;
  const multiplier = Math.max(...run.history.map(turn => turn.multiplier));
  return `<section class="results"><p class="eyebrow">YOU MAKE A COMPELLING COUNTERPOINT.</p><h2>Well argued.<br><em>And un-argued.</em></h2><div class="final-score">${fmt(score)}<span>POINTS</span></div><p>${counters} counterpunch${counters === 1 ? '' : 'es'} <span>·</span> ×${multiplier} best chain${score >= best ? ' <span>·</span> Personal best' : ''}</p><div class="result-actions"><button class="primary-button" id="again-button">Go again ↗</button><button class="fresh-button" id="share-button">Copy result</button></div></section>`;
}
function render() {
  const entry = currentEntry(run), complete = run.phase === 'complete';
  main.innerHTML = `<div class="game-shell ${entry ? 'has-argument' : 'opening'}">${casePicker()}${scoreHeader()}<div class="question-heading"><p class="eyebrow">${entry ? 'THE QUESTION' : 'TODAY’S VERY IMPORTANT QUESTION'}</p><h1>${h(question.question)}</h1>${entry ? '' : '<p class="opening-copy">Make a point. Pick it apart.<br>How many times can you change your mind?</p>'}</div>${complete ? results() + argumentCard() : entry ? argumentCard() + composer() : composer()}${lastCorrection ? `<p class="correction-receipt">${h(lastCorrection)}</p>` : ''}${historyDetails()}${storageAvailable ? '' : '<p class="storage-note">Browser storage is unavailable. Keep this tab open to finish.</p>'}</div>`;
  bind();
  preview();
}
function bind() {
  document.querySelector('#case-select').addEventListener('change', event => { persist(); const url = new URL(location.href); url.searchParams.set('case', event.target.value); location.href = url; });
  document.querySelectorAll('[data-claim]').forEach(button => {
    const choose = () => changeSelection(selectClaim(run, button.dataset.claim));
    button.addEventListener('click', choose);
    button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); choose(); } });
  });
  document.querySelectorAll('[data-side]').forEach(button => button.addEventListener('click', () => changeSelection(selectFresh(run, button.dataset.side))));
  document.querySelector('#fresh-button')?.addEventListener('click', () => changeSelection(selectFresh(run)));
  document.querySelector('#back-button')?.addEventListener('click', () => { run = { ...run, selection: null, draft: '' }; persist(); render(); });
  const input = document.querySelector('#answer-input');
  input?.addEventListener('compositionstart', () => { composing = true; });
  input?.addEventListener('compositionend', () => { composing = false; run.draft = input.value; persist(); preview(); });
  input?.addEventListener('input', () => { run.draft = input.value; attempted = false; persist(); if (!composing) preview(); });
  document.querySelector('#answer-form')?.addEventListener('submit', event => {
    event.preventDefault(); if (composing) return;
    attempted = true;
    const match = getMatch();
    if (match.kind === 'match') finish(match);
    else { preview(); rejectEffect(); }
  });
  document.querySelector('#hint-button')?.addEventListener('click', () => {
    const eligible = run.selection.kind === 'counter' ? availableCounters(run, run.selection.targetId, run.selection.claimId) : question.entries.filter(entry => entry.standalone && entry.side === currentSide(run) && !usedIds(run).includes(entry.id));
    document.querySelector('#hint-text').textContent = eligible.length ? `Try thinking about “${eligible[0].answer.toLowerCase()}”.` : 'You have used all these angles. Pick another claim or switch sides.';
  });
  document.querySelector('#again-button')?.addEventListener('click', () => { run = createRun(question); lastCorrection = ''; persist(); render(); focusInput(); });
  document.querySelector('#share-button')?.addEventListener('click', async () => {
    const text = shareText(run);
    try { await navigator.clipboard.writeText(text); document.querySelector('#share-button').textContent = 'Copied ✓'; }
    catch { document.querySelector('#share-output').value = text; document.querySelector('#share-dialog').showModal(); document.querySelector('#share-output').select(); }
  });
}
function getMatch() { return matchInput(question, run.draft, currentSide(run), usedIds(run), matchContext(run)); }
function preview() {
  const output = document.querySelector('#match-preview');
  if (!output || composing) return;
  if (!run.draft.trim()) { output.textContent = attempted ? 'Give us a little angle first.' : run.selection.kind === 'counter' ? 'An example, a flaw, a different way to see it.' : 'A feature, an idea, a familiar example.'; return; }
  const match = getMatch();
  output.className = match.kind === 'match' ? 'recognized' : attempted ? 'needs-work' : '';
  if (match.kind === 'match') {
    output.innerHTML = `${match.matchType === 'typo' ? `Corrected to <strong>${h(match.entry.answer)}</strong>` : `<strong>${h(match.entry.answer)}</strong>`}<span class="preview-points">${match.entry.points} × ${nextMultiplier(run)} = ${fmt(match.entry.points * nextMultiplier(run))}</span>`;
  } else if (match.kind === 'suggestion') {
    output.innerHTML = `Did you mean <button type="button" id="confirm-suggestion">${h(match.entry.answer)} ↗</button>?`;
    document.querySelector('#confirm-suggestion').addEventListener('click', () => finish(match));
  } else {
    const messages = {
      'invalid': match.reason, 'already-used': 'You’ve used that idea. Give it a new angle.',
      'wrong-side': `That argues ${currentSide(run) === 'for' ? 'no' : 'yes'}. Try the other direction.`,
      'wrong-context': run.selection.kind === 'fresh' ? 'That reply needs a specific claim to counter.' : 'That angle doesn’t counter this claim. Try another, or start fresh.',
      'ambiguous': 'A couple of possibilities. Try another word for it.',
      'no-match': 'Not in this bank yet. Try a shorter name or another angle.'
    };
    output.textContent = attempted || ['wrong-side', 'already-used', 'wrong-context'].includes(match.kind) ? messages[match.kind] : 'Keep going. We’ll catch the spelling.';
  }
}
let finishing = false;
function finish(match) {
  if (finishing) return;
  finishing = true;
  const before = totalScore(run), selected = document.querySelector('.claim.selected');
  const corrected = match.matchType === 'typo' || match.kind === 'suggestion';
  lastCorrection = corrected ? `Spelling saved: “${run.draft}” → ${match.entry.answer}` : '';
  // Score and persist synchronously; animation cannot submit the same move twice.
  run = commitAnswer(run, match.entryId, run.draft); persist();
  main.inert = true;
  selected?.classList.add('landed');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => {
    render();
    main.inert = false;
    (document.querySelector('.results') ?? document.querySelector('.question-heading'))?.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' });
    celebrate(run.history.at(-1), before);
    announce(`${match.entry.answer}. ${run.history.at(-1).total} points. Multiplier ${run.history.at(-1).multiplier}. ${run.phase === 'complete' ? 'Round complete.' : 'Choose an underlined claim or a fresh angle.'}`);
    if (run.phase === 'complete') document.querySelector('.results h2')?.setAttribute('tabindex', '-1');
    const focusTarget = document.querySelector('.claim') ?? document.querySelector('#fresh-button') ?? document.querySelector('#again-button');
    focusTarget?.focus({ preventScroll: true });
    finishing = false;
  }, reduced ? 0 : 180);
}
function rejectEffect() {
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.querySelector('.input-row')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }], { duration: 220 });
}
function celebrate(turn, before) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.querySelector('.argument-stage');
  const counter = turn.context.kind === 'counter';
  if (!reduced) {
    stage?.animate([{ opacity: .2, transform: 'translateY(30px) scale(.96) rotate(-.5deg)' }, { opacity: 1, transform: 'translateY(-5px) scale(1.008)' }, { opacity: 1, transform: 'none' }], { duration: 550, easing: 'cubic-bezier(.16,1,.3,1)' });
    document.querySelector('.multiplier-stamp')?.animate([{ transform: 'scale(2.3) rotate(22deg)', opacity: 0 }, { transform: 'scale(.85) rotate(-14deg)', opacity: 1 }, { transform: 'scale(1) rotate(-9deg)', opacity: 1 }], { duration: 650, delay: 90, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' });
    const start = performance.now();
    const count = time => { const t = Math.min(1, (time - start) / 650); const number = document.querySelector('#score-number'); if (number) number.textContent = fmt(Math.round(before + turn.total * (1 - Math.pow(1 - t, 3)))); if (t < 1) requestAnimationFrame(count); };
    requestAnimationFrame(count);
    const rect = stage?.getBoundingClientRect();
    if (rect) {
      const effects = document.querySelector('#effects');
      for (let i = 0; i < (counter ? 22 : 12); i++) {
        const particle = document.createElement('i'); particle.className = 'particle';
        particle.style.cssText = `left:${rect.left + rect.width * .76}px;top:${rect.top + rect.height * .7}px;background:${['#e77b44', '#b8d18a', '#233e32', '#e7bd49'][i % 4]};`;
        effects.append(particle);
        const angle = Math.PI * 2 * i / 22, distance = 60 + Math.random() * 170;
        particle.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * distance}px,${Math.sin(angle) * distance - 40}px) rotate(${i * 43}deg)`, opacity: 0 }], { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => particle.remove();
      }
      const hit = document.createElement('div'); hit.className = 'score-hit'; hit.textContent = counter ? `COUNTER! +${fmt(turn.total)}` : `+${fmt(turn.total)} · ${tierName(currentEntry(run).tier)}`; effects.append(hit);
      hit.animate([{ opacity: 0, transform: 'translate(-50%,20px) scale(.5) rotate(-8deg)' }, { opacity: 1, transform: 'translate(-50%,0) scale(1.05) rotate(-4deg)', offset: .2 }, { opacity: 1, transform: 'translate(-50%,-8px) scale(1) rotate(-4deg)', offset: .7 }, { opacity: 0, transform: 'translate(-50%,-45px) scale(.9) rotate(-4deg)' }], { duration: 1350, fill: 'both' }).onfinish = () => hit.remove();
    }
  }
  if (sound) playSound(counter, turn.multiplier);
}
function playSound(counter, multiplier) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume();
    const start = audio.currentTime, pitch = Math.min(880, 220 + Math.log2(multiplier) * 55);
    (counter ? [1, 1.25, 1.5, 2] : [1, 1.5]).forEach((ratio, i) => {
      const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(pitch * ratio, start + i * .055); gain.gain.setValueAtTime(0, start + i * .055);
      gain.gain.linearRampToValueAtTime(.075, start + i * .055 + .008); gain.gain.exponentialRampToValueAtTime(.001, start + i * .055 + .24);
      oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start + i * .055); oscillator.stop(start + i * .055 + .25);
    });
  } catch { /* Audio is optional; the visual game remains usable. */ }
}
document.querySelector('#help-button').addEventListener('click', () => document.querySelector('#help-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }));
document.querySelector('#sound-button').addEventListener('click', event => { sound = !sound; write('cross-examination:sound', String(sound)); event.currentTarget.textContent = `Sound ${sound ? 'on' : 'off'}`; event.currentTarget.setAttribute('aria-pressed', String(sound)); if (sound) playSound(false, 1); });
async function load() {
  try {
    const response = await fetch(new URL('../content/manifest.json?v=2', import.meta.url)); if (!response.ok) throw new Error('Question list unavailable.'); manifest = await response.json();
    const selected = new URLSearchParams(location.search).get('case');
    const item = manifest.questions.find(item => item.id === selected) ?? manifest.questions.find(item => item.id === manifest.defaultQuestion);
    const bank = await fetch(new URL(`../content/${item.file}?v=2`, import.meta.url)); if (!bank.ok) throw new Error('Question unavailable.');
    question = playableQuestion(await bank.json());
    const saved = restoreRun(read(runKey()));
    run = saved?.question.id === question.id && saved.question.version === question.version ? saved : createRun(question);
    sound = read('cross-examination:sound') === 'true'; document.querySelector('#sound-button').textContent = `Sound ${sound ? 'on' : 'off'}`; document.querySelector('#sound-button').setAttribute('aria-pressed', String(sound));
    render();
  } catch (error) { main.innerHTML = `<div class="load-error"><h1>We lost the argument.</h1><p>${h(error.message)}</p><a href="./">Try again ↗</a></div>`; }
}
load();
