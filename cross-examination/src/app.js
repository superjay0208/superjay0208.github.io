import { createRun, answer, undo, revise, finishReview, finalAnswers, nextCase, caseById, receiptModel, featuredTopic } from './still-counts-engine.js?v=sc1';
import { storageAdapter } from './still-counts-storage.js?v=sc1';
import { receiptPNG, receiptText, topicURL } from './still-counts-share.js?v=sc1';
import { sceneSVG } from './still-counts-scenes.js?v=sc1';
import { sound, confetti, reduced } from './still-counts-effects.js?v=sc1';

const main = document.querySelector('#main'), announcer = document.querySelector('#announcer');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let backing; try { backing = localStorage; } catch { backing = null; }
const store = storageAdapter(backing);
let manifest, topic, run, generation = 0, locked = false, soundOn = store.read('still-counts:sound') !== 'off', notice = '';
const topicCache = new Map(), held = new Set();
const art = (c, mini = false) => `<div class="scene${mini ? ' mini' : ''}" role="img" aria-label="${esc(c.scene.alt)}">${sceneSVG(c.scene.id, { mini })}</div>`;
const label = verdict => topic.labels[verdict];
function save() { store.save(topic, run); }
function notify(text) { announcer.textContent = text; }
function soundUI() { const b = document.querySelector('#sound-button'); b.setAttribute('aria-pressed', String(soundOn)); b.setAttribute('aria-label', `Sound ${soundOn ? 'on' : 'off'}`); b.textContent = soundOn ? '♫' : '♩'; }
function progress() {
  return `<div class="progress-row"><span>${run.phase === 'choosing' ? `CALL ${run.originalAnswers.length + 1}` : 'ALL CALLS IN'}<b> / 8</b></span><div class="progress-marks" role="progressbar" aria-label="Calls made" aria-valuenow="${run.originalAnswers.length}" aria-valuemin="0" aria-valuemax="8">${Array.from({ length: 8 }, (_, i) => `<i class="${i < run.originalAnswers.length ? run.originalAnswers[i].verdict : i === run.originalAnswers.length ? 'current' : ''}"></i>`).join('')}</div></div>`;
}
function topicIntro() {
  return `<aside class="topic-intro"><div class="edition"><span class="edition-dot"></span>${esc(topic.contentLabel.toUpperCase())}</div><h1>${esc(topic.question)}</h1><p class="scope">${esc(topic.scope)}</p><div class="desk-seal" aria-hidden="true"><span>DEPARTMENT OF</span><strong>YOUR<br>BUSINESS</strong><span>EST. ABOUT NOW</span></div><p class="intro-note">Your call.<br><em>There is no wrong answer.</em></p></aside>`;
}
function trays() {
  if (!run.originalAnswers.length) return `<div class="first-note"><span aria-hidden="true">↖</span> Trust your gut. We'll bring the awkward examples.</div>`;
  const answers = finalAnswers(run);
  return `<div class="trays" aria-label="Your earlier calls">${['yes', 'no'].map(verdict => `<div class="tray ${verdict}"><span>${esc(label(verdict))}</span><div>${run.originalAnswers.filter(a => answers[a.caseId] === verdict).map(a => `<span class="tray-token" title="${esc(caseById(topic, a.caseId).label)}">${sceneSVG(caseById(topic, a.caseId).scene.id, { mini: true })}<span class="sr-only">${esc(caseById(topic, a.caseId).label)}</span></span>`).join('') || '<i class="empty-tray">Nothing yet.</i>'}</div></div>`).join('')}</div>`;
}
function choosingView() {
  const c = nextCase(topic, run), last = run.originalAnswers.at(-1);
  const direct = c.mutation && c.mutation.fromCaseId === last?.caseId;
  return `<section class="play-layout">${topicIntro()}<div class="inspection">${progress()}<article class="case-card ${direct ? 'mutation' : ''}" id="case-card"><div class="case-top"><span>${direct ? 'ONLY CHANGE' : run.originalAnswers.length >= 6 ? 'ONE MORE THING…' : 'EXHIBIT ' + String(run.originalAnswers.length + 1).padStart(2, '0')}</span><span aria-hidden="true">✳</span></div>${art(c)}<div class="case-copy"><p class="change-note">${direct ? esc(c.mutation.changeLabel) : c.mutation ? 'Another case. Same question.' : '&nbsp;'}</p><h2 id="case-title" tabindex="-1">${esc(c.label)}</h2><p>${esc(c.body)}</p></div><div class="verdict-stamp" id="verdict-stamp" aria-hidden="true"></div></article><div class="choice-buttons"><button class="choice yes" data-verdict="yes"><span>${esc(label('yes'))}</span><kbd>1</kbd><b aria-hidden="true">↗</b></button><button class="choice no" data-verdict="no"><span>${esc(label('no'))}</span><kbd>2</kbd><b aria-hidden="true">↘</b></button></div><div class="below-choices"><span>GO WITH YOUR GUT.</span><button id="undo-button" class="text-button" ${run.originalAnswers.length ? '' : 'disabled'}>↶ Undo</button></div>${trays()}</div></section>`;
}
function reviewView() {
  const pair = topic.comparisons.find(p => p.id === run.reviewPairId), answers = finalAnswers(run);
  const changed = Object.keys(run.overrides).length > 0;
  return `<section class="review-view"><p class="eyebrow">WAIT. LOOK AT THESE TWO.</p><h1 id="case-title" tabindex="-1">${esc(changed ? 'Your line. Updated.' : pair.headline)}</h1><p class="review-sub">${changed ? 'Your updated calls are below. You can keep both.' : esc(pair.line)}</p><div class="review-pair">${pair.caseIds.map(id => { const c = caseById(topic, id); return `<article class="review-card">${art(c)}<div class="review-copy"><h2>${esc(c.label)}</h2><p>${esc(c.body)}</p><span class="verdict-pill ${answers[id]}">${esc(label(answers[id]))}</span><button class="change-call" data-revise="${esc(id)}">↶ Change this call</button></div></article>`; }).join('')}</div><div class="review-actions"><button class="primary-button" id="finish-button">${changed ? 'Done. Print it.' : 'Keep my calls.'}<span aria-hidden="true">↗</span></button><button class="text-button" id="skip-review">See receipt</button></div><p class="small-note">A boundary, not a gotcha. You're allowed to draw it there.</p></section>`;
}
function receiptHTML(model) {
  return `<article class="receipt-paper" id="receipt"><div class="receipt-logo">still counts<span>?</span></div><div class="receipt-meta">${esc(model.day)} / EDITION ${model.revision}${model.updated ? ' / UPDATED' : ''}</div><h2>${esc(model.question)}</h2><p class="receipt-title">${esc(model.title)}</p><div class="receipt-rule"></div><ol class="receipt-rows">${model.rows.map((r, i) => `<li class="${model.pairIds.includes(r.id) ? 'spotlight' : ''}"><span class="receipt-index">0${i + 1}</span><span>${esc(r.label)}</span><b class="${r.verdict}">${esc(r.verdictLabel)}</b></li>`).join('')}</ol><div class="receipt-observation"><span aria-hidden="true">✳</span><h3>${esc(model.headline)}</h3><p>${esc(model.line)}</p></div><div class="receipt-bottom"><span>YOUR LINE. YOUR CALL.</span><i class="barcode" aria-hidden="true"></i><span>TAKE IT UP WITH THE GROUP CHAT.</span></div></article>`;
}
function resultView() {
  const model = receiptModel(topic, run);
  return `<section class="result-layout"><aside class="result-intro"><p class="eyebrow">THE CALLS ARE YOURS. THE RECEIPT IS OURS.</p><h1 id="case-title" tabindex="-1">Well. <br>That's <br><em>your line.</em></h1><p>Someone you know is going to disagree.</p><div class="result-actions"><button class="primary-button" id="save-receipt">Save receipt <span aria-hidden="true">↓</span></button><button class="secondary-button" id="copy-result">Copy result <span aria-hidden="true">↗</span></button><p id="export-status" role="status"></p></div><button class="text-button" id="another-topic">Try another topic ↗</button><button class="text-button replay" id="replay-button">Make your calls again ↶</button></aside>${receiptHTML(model)}</section>`;
}
function render({ focus = false } = {}) {
  generation++; locked = false;
  document.body.dataset.topic = topic.id; document.body.dataset.phase = run.phase;
  main.innerHTML = `${notice ? `<p class="notice">${esc(notice)}</p>` : ''}${!store.available ? '<p class="notice">Progress cannot be saved here. Keep this tab open to finish.</p>' : ''}${run.phase === 'choosing' ? choosingView() : run.phase === 'review' ? reviewView() : resultView()}`;
  document.querySelectorAll('[data-verdict]').forEach(b => b.addEventListener('click', e => { if (e.detail > 1) return; makeChoice(b.dataset.verdict); }));
  document.querySelector('#undo-button')?.addEventListener('click', () => { if (locked) return; run = undo(run); save(); render({ focus: true }); });
  document.querySelectorAll('[data-revise]').forEach(b => b.addEventListener('click', () => { run = revise(topic, run, b.dataset.revise); save(); sound('review', soundOn); render(); document.querySelector(`[data-revise="${b.dataset.revise}"]`)?.focus(); notify('Call changed. Both updated verdicts are shown.'); }));
  for (const id of ['finish-button', 'skip-review']) document.getElementById(id)?.addEventListener('click', () => { run = finishReview(run); save(); sound('receipt', soundOn); render({ focus: true }); });
  document.querySelector('#replay-button')?.addEventListener('click', () => { run = createRun(topic); notice = ''; save(); render({ focus: true }); window.scrollTo({ top: 0 }); });
  document.querySelector('#another-topic')?.addEventListener('click', openTopics);
  document.querySelector('#copy-result')?.addEventListener('click', copyResult);
  document.querySelector('#save-receipt')?.addEventListener('click', saveReceipt);
  if (focus) { document.querySelector('#case-title')?.focus({ preventScroll: true }); if (run.phase !== 'choosing') window.scrollTo({ top: 0, behavior: reduced() ? 'instant' : 'smooth' }); }
}
function makeChoice(verdict) {
  if (locked || !run || run.phase !== 'choosing' || document.querySelector('dialog[open]')) return;
  locked = true;
  const token = generation; run = answer(topic, run, verdict); save();
  document.querySelectorAll('.choice, #undo-button').forEach(b => { b.disabled = true; });
  const card = document.querySelector('#case-card'), stamp = document.querySelector('#verdict-stamp');
  stamp.textContent = label(verdict); stamp.classList.add(verdict, 'landed'); card.classList.add('decided', verdict);
  sound(verdict, soundOn); confetti(document.querySelector('#effects'), verdict);
  setTimeout(() => { if (generation !== token) return; render({ focus: true }); notify(run.phase === 'choosing' ? `Call ${run.originalAnswers.length + 1} of 8. ${nextCase(topic, run).label}` : run.phase === 'review' ? 'Your calls are in. Look at these two.' : 'Your receipt is ready.'); if (run.phase === 'result') sound('receipt', soundOn); }, reduced() ? 110 : 420);
}
async function copyResult() {
  const text = receiptText(receiptModel(topic, run), topicURL(location.href, topic.id));
  try { await navigator.clipboard.writeText(text); document.querySelector('#copy-result').textContent = 'Copied ✓'; }
  catch { document.querySelector('#copy-output').value = text; document.querySelector('#copy-dialog').showModal(); document.querySelector('#copy-output').select(); }
}
async function saveReceipt() {
  const button = document.querySelector('#save-receipt'), status = document.querySelector('#export-status');
  const model = receiptModel(topic, run); button.disabled = true; status.textContent = 'Printing your receipt…';
  try {
    const blob = await receiptPNG(model), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = `still-counts-${model.topicId}-${model.day}.png`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000); status.textContent = 'Receipt image ready.';
  } catch { status.textContent = 'Could not save the image. Copy your result or take a screenshot.'; }
  finally { button.disabled = false; }
}
function openTopics() {
  document.querySelector('#topic-list').innerHTML = manifest.topics.map(item => `<button class="topic-option ${item.id === topic.id ? 'selected' : ''}" data-topic="${esc(item.id)}"><span>${esc(item.label)}</span><strong>${esc(item.question)}</strong><b aria-hidden="true">↗</b></button>`).join('');
  document.querySelectorAll('.topic-option[data-topic]').forEach(b => b.addEventListener('click', async () => { document.querySelector('#topics-dialog').close(); await loadTopic(b.dataset.topic, true); }));
  document.querySelector('#topics-dialog').showModal();
}
async function loadTopic(id, updateURL = false) {
  const token = ++generation; locked = true;
  const item = manifest.topics.find(t => t.id === id) ?? featuredTopic(manifest);
  try {
    if (!topicCache.has(item.id)) {
      const response = await fetch(new URL(`../content/still-counts/${item.file}?v=sc1`, import.meta.url));
      if (!response.ok) throw new Error('Topic unavailable');
      const value = await response.json();
      if (value.id !== item.id || value.revision !== item.revision || value.slots.length !== 8) throw new Error('Invalid topic');
      topicCache.set(item.id, value);
    }
    if (generation !== token) return;
    topic = topicCache.get(item.id);
    const loaded = store.load(topic); run = loaded.run ?? createRun(topic);
    notice = loaded.invalid ? 'That saved session could not be restored. A fresh set of calls is ready.' : '';
    if (updateURL) { const url = new URL(location.href); url.searchParams.set('topic', item.id); history.replaceState(null, '', url); }
    save(); render({ focus: updateURL }); if (updateURL) window.scrollTo({ top: 0 });
  } catch {
    if (generation !== token) return;
    main.innerHTML = '<section class="error-view"><h1>The desk is stuck.</h1><p>This topic could not load. Reload to try again.</p><button class="primary-button" id="retry-button">Try again ↗</button></section>';
    document.querySelector('#retry-button').addEventListener('click', () => loadTopic(item.id, updateURL));
  }
}
document.querySelector('#sound-button').addEventListener('click', () => { soundOn = !soundOn; store.write('still-counts:sound', soundOn ? 'on' : 'off'); soundUI(); sound('yes', soundOn); });
document.querySelector('#topics-button').addEventListener('click', () => { if (manifest && topic) openTopics(); });
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.addEventListener('keydown', event => {
  if (event.repeat || held.has(event.key)) { if (['1', '2', 'Enter', ' '].includes(event.key)) event.preventDefault(); return; }
  held.add(event.key);
  if (event.ctrlKey || event.altKey || event.metaKey || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
  if (event.key === '1' || event.key === '2') { event.preventDefault(); makeChoice(event.key === '1' ? 'yes' : 'no'); }
});
document.addEventListener('keyup', e => held.delete(e.key)); window.addEventListener('blur', () => held.clear());
soundUI();
try {
  const response = await fetch(new URL('../content/still-counts/manifest.json?v=sc1', import.meta.url));
  if (!response.ok) throw new Error('Manifest unavailable'); manifest = await response.json();
  const requested = new URL(location.href).searchParams.get('topic');
  await loadTopic(requested ?? featuredTopic(manifest).id);
} catch { main.innerHTML = '<section class="error-view"><h1>The desk is closed.</h1><p>Something failed to load. Please reload the page.</p></section>'; }
