import { matchInput, normalizeInput } from './matcher.js?v=3';
import { playablePrompt, createRun, currentPrompt, commitAnswer, advanceRun, skipPrompt, totalScore, maximumScore, restoreRun, shareText } from './game.js?v=3';
const main = document.querySelector('#main');
const h = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const fmt = value => value.toLocaleString('en-US');
const rarity = points => points === 100 ? 'Wild card' : points === 75 ? 'Deep cut' : points === 50 ? 'Unexpected' : points === 25 ? 'Good find' : 'Classic counterexample';
const RUN_KEY = 'cross-examination:examples:run:v3';
let prompts, run, attempted = false, composing = false, sound = false, audio, storageAvailable = true, hiddenSuggestions = false;
function read(key) { try { return localStorage.getItem(key); } catch { storageAvailable = false; return null; } }
function write(key, value) { try { localStorage.setItem(key, value); } catch { storageAvailable = false; } }
function persist() { write(RUN_KEY, JSON.stringify(run)); }
function announce(text) { document.querySelector('#announcer').textContent = text; }
const bestKey = () => `cross-examination:examples:best:${prompts.map(prompt => `${prompt.id}:${prompt.version}`).join('|')}`;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function focusInput() { document.querySelector('#answer-input')?.focus({ preventScroll: true }); }
function header() {
  const answered = run.history.length, index = run.phase === 'reveal' ? answered : Math.min(answered + 1, 6);
  return `<div class="round-header"><div class="round-progress"><div class="pips" aria-hidden="true">${run.prompts.map((_, i) => `<i class="${i < answered ? run.history[i].kind === 'skip' ? 'skipped' : 'filled' : i === answered ? 'current' : ''}"></i>`).join('')}</div><span>${run.phase === 'complete' ? 'ROUND COMPLETE' : `CLAIM ${index} OF 6`}</span></div><div class="score-total"><span>POINTS</span><strong id="score-number">${fmt(totalScore(run))}</strong></div></div>`;
}
function guessView(prompt) {
  return `<section class="claim-view" aria-labelledby="claim-title"><p class="eyebrow">FIND ONE EXCEPTION.</p><h1 id="claim-title">“${h(prompt.claim)}”</h1><p class="instruction" id="instruction">${h(prompt.instruction)}</p>
  <form id="answer-form" novalidate><label class="sr-only" for="answer-input">Your counterexample</label><div class="input-row"><span class="what-about" aria-hidden="true">What about</span><input id="answer-input" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" maxlength="60" placeholder="e.g. ${h(prompt.starter.toLowerCase())}…" value="${h(run.draft)}" aria-describedby="match-preview instruction" aria-autocomplete="list" aria-controls="suggestions"><button class="send-button" type="submit" aria-label="Submit counterexample">↗</button></div><div class="input-under"><p id="match-preview" role="status"></p><span>just a name</span></div><div id="suggestions" role="listbox" aria-label="Spelling suggestions" hidden></div></form>
  <div class="guess-footer"><span>Less obvious = more points.</span><button class="skip-button" id="skip-button">Skip this claim ↗</button></div><p class="no-pressure">No timer. No points lost for trying.</p></section>`;
}
function revealView(prompt) {
  const record = run.history.at(-1), entry = prompt.entries.find(entry => entry.id === record.entryId);
  const corrected = normalizeInput(record.input) !== normalizeInput(entry.answer) && record.input.toLowerCase() !== entry.answer.toLowerCase();
  return `<section class="reveal-view" aria-labelledby="example-title"><p class="disproved-claim"><s>${h(prompt.claim)}</s></p><div class="answer-stage"><span class="not-always">NOT ALWAYS.</span><p class="what-about-label">WHAT ABOUT…</p><h1 id="example-title">${h(entry.answer)}<span class="answer-period">.</span></h1><p class="explanation">${h(entry.explanation)}</p><div class="answer-score"><span class="point-burst">+${entry.points}</span><div><strong>${rarity(entry.points)}</strong><span>${entry.points} / ${Math.max(...prompt.entries.map(entry => entry.points))} points</span></div></div></div>${corrected ? `<p class="correction-receipt">Matched “${h(record.input)}” to ${h(entry.answer)}.</p>` : ''}<button class="primary-button next-button" id="next-button">${run.history.length === 6 ? 'See your score' : 'Next claim'} <span aria-hidden="true">↗</span></button><p class="keyboard-note">or press Enter</p></section>`;
}
function completeView() {
  const score = totalScore(run), best = Number(read(bestKey()) ?? 0); if (score > best) write(bestKey(), String(score));
  return `<section class="results"><p class="eyebrow">SO MUCH FOR THE RULES.</p><h1>Point<br><em>taken.</em></h1><div class="final-score">${score}<span>/ ${maximumScore(run)} POINTS</span></div><p>${run.history.filter(record => record.kind === 'answer').length} counterexamples${score >= best && score > 0 ? ' · Personal best' : ''}</p><div class="result-actions"><button class="primary-button" id="again-button">Play again ↗</button><button class="quiet-link" id="share-button">Copy result</button></div></section><ol class="round-recap">${run.history.map((record, index) => { const prompt = run.prompts[index], entry = prompt.entries.find(entry => entry.id === record.entryId); return `<li><span class="recap-number">0${index + 1}</span><div><p>${h(prompt.claim)}</p><strong>${entry ? h(entry.answer) : 'Skipped'}</strong><span>${entry ? h(entry.explanation) : `One example: ${h(prompt.starter)}.`}</span></div><b>+${record.points}</b></li>`; }).join('')}</ol><details class="bank-explorer"><summary>See more counterexamples <span>↗</span></summary><p>These are fixed editorial scores. Different names for the same example receive the same points.</p>${run.prompts.map(prompt => `<section><h2>${h(prompt.claim)}</h2><div class="example-grid">${[...prompt.entries].sort((a,b) => a.points - b.points || a.answer.localeCompare(b.answer)).map(entry => `<span title="${h(entry.explanation)}">${h(entry.answer)} <small>${entry.points}</small></span>`).join('')}</div></section>`).join('')}</details>`;
}
function render() {
  main.innerHTML = `<div class="game-shell">${header()}${run.phase === 'complete' ? completeView() : run.phase === 'reveal' ? revealView(currentPrompt(run)) : guessView(currentPrompt(run))}${storageAvailable ? '' : '<p class="storage-note">Progress cannot be saved in this browser. Keep this tab open to finish.</p>'}</div>`;
  bind(); if (run.phase === 'guess') preview();
}
function next() { run = advanceRun(run); attempted = false; hiddenSuggestions = false; persist(); render(); focusInput(); if (run.phase === 'complete') document.querySelector('#again-button')?.focus({ preventScroll: true }); }
function bind() {
  const input = document.querySelector('#answer-input');
  input?.addEventListener('compositionstart', () => { composing = true; });
  input?.addEventListener('compositionend', () => { composing = false; run.draft = input.value; persist(); preview(); });
  input?.addEventListener('input', () => { run.draft = input.value; attempted = false; hiddenSuggestions = false; persist(); if (!composing) preview(); });
  input?.addEventListener('keydown', event => { if (event.key === 'ArrowDown') { const first = document.querySelector('[data-suggestion]'); if (first) { event.preventDefault(); first.focus(); } } else if (event.key === 'Escape') { hiddenSuggestions = true; preview(); } });
  document.querySelector('#answer-form')?.addEventListener('submit', event => { event.preventDefault(); if (composing) return; attempted = true; const match = getMatch(); if (match.kind === 'match') finish(match); else { preview(); announce(document.querySelector('#match-preview').textContent); } });
  document.querySelector('#skip-button')?.addEventListener('click', () => { run = skipPrompt(run); attempted = false; hiddenSuggestions = false; persist(); render(); focusInput(); if (run.phase === 'complete') document.querySelector('#again-button')?.focus({ preventScroll: true }); announce(run.phase === 'complete' ? 'Round complete.' : `Next claim. ${currentPrompt(run).claim}`); });
  document.querySelector('#next-button')?.addEventListener('click', next);
  document.querySelector('#again-button')?.addEventListener('click', () => { run = createRun(prompts); attempted = false; hiddenSuggestions = false; persist(); render(); main.scrollIntoView({ block: 'start' }); focusInput(); });
  document.querySelector('#share-button')?.addEventListener('click', async event => { const text = shareText(run); try { await navigator.clipboard.writeText(text); event.target.textContent = 'Copied ✓'; } catch { document.querySelector('#share-output').value = text; document.querySelector('#share-dialog').showModal(); document.querySelector('#share-output').select(); } });
}
function getMatch() { return matchInput(currentPrompt(run), run.draft); }
function preview() {
  const output = document.querySelector('#match-preview'), box = document.querySelector('#suggestions');
  if (!output || composing) return; box.hidden = true; box.innerHTML = ''; output.className = '';
  if (!run.draft.trim()) { output.textContent = attempted ? 'Name one thing first.' : 'Spelling doesn’t have to be perfect.'; return; }
  const match = getMatch();
  if (match.kind === 'match') { output.className = 'recognized'; output.innerHTML = `${match.matchType === 'typo' ? '<span class="spelling-note">Corrected to </span>' : ''}<strong>${h(match.entry.answer)}</strong> <span class="preview-points">${match.entry.points} points</span> <span aria-hidden="true">✓</span>`; }
  else if ((match.kind === 'suggestion' || match.kind === 'ambiguous') && match.suggestions?.length && !hiddenSuggestions) {
    output.textContent = 'Did you mean one of these?'; box.hidden = false;
    box.innerHTML = match.suggestions.map((suggestion, index) => `<button type="button" role="option" aria-selected="false" data-suggestion="${index}">${h(suggestion.entry.answer)}${normalizeInput(suggestion.matchedHandle) !== normalizeInput(suggestion.entry.answer) ? ` <small class="alias-note">also called ${h(suggestion.matchedHandle)}</small>` : ''} <span>↖</span></button>`).join('');
    box.querySelectorAll('[data-suggestion]').forEach(button => {
      button.addEventListener('click', () => { run.draft = match.suggestions[Number(button.dataset.suggestion)].entry.answer; attempted = false; hiddenSuggestions = true; document.querySelector('#answer-input').value = run.draft; persist(); preview(); focusInput(); });
      button.addEventListener('keydown', event => { const buttons = [...box.querySelectorAll('[data-suggestion]')], index = buttons.indexOf(button); if (event.key === 'ArrowDown') { event.preventDefault(); (buttons[index + 1] ?? buttons[0]).focus(); } else if (event.key === 'ArrowUp') { event.preventDefault(); if (index === 0) focusInput(); else buttons[index - 1].focus(); } else if (event.key === 'Escape') { event.preventDefault(); hiddenSuggestions = true; preview(); focusInput(); } });
    });
  } else if (match.kind === 'rejected') { output.className = 'needs-work'; output.textContent = match.reason; }
  else if (match.kind === 'invalid') { output.className = attempted ? 'needs-work' : ''; output.textContent = match.reason; }
  else { output.className = attempted ? 'needs-work' : ''; output.textContent = attempted ? 'Not found yet. Try another name, or skip. No points lost.' : 'Keep typing, or try another name for it.'; }
}
function finish(match) {
  if (run.phase !== 'guess') return;
  const before = totalScore(run); run = commitAnswer(run, match.entryId, run.draft); persist(); render();
  document.querySelector('#next-button').focus({ preventScroll: true });
  announce(`${match.entry.answer}. ${match.entry.explanation} ${match.entry.points} points.`);
  document.querySelector('.game-shell').scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'instant' : 'smooth' });
  celebrate(match.entry, before);
}
function celebrate(entry, before) {
  if (!reducedMotion()) {
    document.querySelector('.answer-stage').animate([{ opacity: .1, transform: 'translateY(24px) scale(.96)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.006)' }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.16,1,.3,1)' });
    document.querySelector('.not-always').animate([{ transform: 'scale(2.4) rotate(16deg)', opacity: 0 }, { transform: 'scale(.9) rotate(-9deg)', opacity: 1 }, { transform: 'rotate(-6deg)' }], { duration: 600, delay: 80, fill: 'backwards', easing: 'cubic-bezier(.16,1,.3,1)' });
    document.querySelector('.point-burst').animate([{ transform: 'scale(.3)', opacity: .1 }, { transform: 'scale(1.18)', opacity: 1 }, { transform: 'scale(1)' }], { duration: 600, delay: 100, fill: 'backwards' });
    const start = performance.now(), target = document.querySelector('#score-number');
    const count = time => { if (!target.isConnected) return; const t = Math.min(1, (time - start) / 650); target.textContent = fmt(Math.round(before + entry.points * (1 - (1 - t) ** 3))); if (t < 1) requestAnimationFrame(count); }; requestAnimationFrame(count);
    const rect = document.querySelector('.answer-score').getBoundingClientRect(), effects = document.querySelector('#effects');
    for (let i = 0; i < 18; i++) { const particle = document.createElement('i'); particle.className = 'particle'; particle.style.cssText = `left:${rect.left + 40}px;top:${rect.top + 35}px;background:${['#e77b44','#aec574','#233e32','#e7bd49'][i % 4]}`; effects.append(particle); const angle = i / 18 * Math.PI * 2, d = 55 + Math.random() * 110; particle.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(angle) * d}px,${Math.sin(angle) * d}px) rotate(${i * 41}deg)`, opacity: 0 }], { duration: 800, easing: 'cubic-bezier(.1,.7,.3,1)' }).onfinish = () => particle.remove(); }
  }
  if (sound) playSound(entry.points);
}
function playSound(points) {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); const start = audio.currentTime; [1,1.25,1.5,2].forEach((ratio, i) => { const oscillator = audio.createOscillator(), gain = audio.createGain(); oscillator.frequency.value = (220 + points * 2) * ratio; gain.gain.setValueAtTime(.001,start + i*.05); gain.gain.linearRampToValueAtTime(.065,start + i*.05+.008); gain.gain.exponentialRampToValueAtTime(.001,start + i*.05+.24); oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start + i*.05); oscillator.stop(start + i*.05+.25); }); } catch { /* Optional audio. */ }
}
document.querySelector('#help-button').addEventListener('click', () => document.querySelector('#help-dialog').showModal());
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelector('#sound-button').addEventListener('click', event => { sound = !sound; write('cross-examination:sound',String(sound)); event.currentTarget.textContent = `Sound ${sound ? 'on' : 'off'}`; event.currentTarget.setAttribute('aria-pressed',String(sound)); if (sound) playSound(10); });
async function load() {
  try {
    const response = await fetch(new URL('../content/manifest.json?v=3',import.meta.url)); if (!response.ok) throw new Error('The claim list could not load.'); const manifest = await response.json();
    if (manifest.version !== 3 || manifest.roundSize !== 6) throw new Error('Please reload to update the game.');
    prompts = await Promise.all(manifest.prompts.map(async item => { const response = await fetch(new URL(`../content/${item.file}?v=3`,import.meta.url)); if (!response.ok) throw new Error('A counterexample bank could not load.'); const prompt = playablePrompt(await response.json()); if (prompt.id !== item.id) throw new Error('A claim has the wrong bank.'); return prompt; }));
    const saved = restoreRun(read(RUN_KEY));
    run = saved && saved.prompts.every((prompt,index) => prompt.id === prompts[index]?.id && prompt.version === prompts[index].version) ? saved : createRun(prompts);
    sound = read('cross-examination:sound') === 'true'; document.querySelector('#sound-button').textContent = `Sound ${sound ? 'on' : 'off'}`; document.querySelector('#sound-button').setAttribute('aria-pressed',String(sound)); render();
  } catch(error) { main.innerHTML = `<div class="load-error"><h1>That didn’t load.</h1><p>${h(error.message)}</p><a href="./">Try again ↗</a></div>`; }
}
load();
