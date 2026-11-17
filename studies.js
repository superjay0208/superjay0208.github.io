(() => {
  'use strict';

  // Reading progress bar (scroll-coalesced, zero idle frames).
  const root = document.documentElement;
  let scrollPending = false;
  const updateScroll = () => {
    scrollPending = false;
    const total = root.scrollHeight - innerHeight;
    root.style.setProperty('--scroll', total > 0 ? String(Math.min(1, Math.max(0, scrollY / total))) : '0');
  };
  addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }, { passive: true });
  updateScroll();

  // Interactive before/after curtain toggle for paired comparison images.
  document.querySelectorAll('[data-compare-pair]').forEach(group => {
    const imgs = [...group.querySelectorAll('img')];
    if (imgs.length !== 2) return;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'compare-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.textContent = 'Interactive split view ↔';
    let stage = null;
    toggle.addEventListener('click', () => {
      const active = toggle.getAttribute('aria-pressed') !== 'true';
      toggle.setAttribute('aria-pressed', String(active));
      toggle.textContent = active ? 'Side-by-side view ◫' : 'Interactive split view ↔';
      if (active) {
        stage = document.createElement('div');
        stage.className = 'curtain-stage';
        const base = imgs[1].cloneNode();
        const overWrap = document.createElement('div');
        overWrap.className = 'curtain-over';
        overWrap.append(imgs[0].cloneNode());
        const handle = document.createElement('div');
        handle.className = 'curtain-handle';
        stage.append(base, overWrap, handle);
        let dragging = false;
        const setSplit = clientX => {
          const rect = stage.getBoundingClientRect();
          const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / Math.max(1, rect.width)) * 100));
          stage.style.setProperty('--split', `${pct.toFixed(1)}%`);
        };
        stage.addEventListener('pointerdown', e => { if (e.button === 0) { dragging = true; stage.setPointerCapture?.(e.pointerId); setSplit(e.clientX); } });
        stage.addEventListener('pointermove', e => { if (dragging || (e.pointerType === 'mouse' && !e.buttons)) setSplit(e.clientX); }, { passive: true });
        stage.addEventListener('pointerup', () => { dragging = false; });
        stage.addEventListener('pointercancel', () => { dragging = false; });
        group.hidden = true;
        group.after(stage);
      } else if (stage) {
        stage.remove();
        stage = null;
        group.hidden = false;
      }
    });
    group.after(toggle);
  });

  // Click-to-zoom image lightbox with keyboard Prev/Next navigation.
  const images = [...document.querySelectorAll('.study-shell img')];
  if (!images.length) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'study-lightbox';
  dialog.setAttribute('aria-label', 'Image zoom viewer');
  dialog.innerHTML = `<div class="study-lightbox-bar"><span id="lb-count"></span><div><button type="button" id="lb-prev" aria-label="Previous image">←</button> <button type="button" id="lb-next" aria-label="Next image">→</button> <button type="button" id="lb-close">Close ×</button></div></div><img id="lb-img" alt=""><p id="lb-cap"></p>`;
  document.body.append(dialog);
  const lbImg = dialog.querySelector('#lb-img');
  const lbCap = dialog.querySelector('#lb-cap');
  const lbCount = dialog.querySelector('#lb-count');
  let current = 0;
  const showAt = index => {
    current = (index + images.length) % images.length;
    const target = images[current];
    lbImg.src = target.currentSrc || target.src;
    lbImg.alt = target.alt || '';
    const cap = target.closest('.image-block, .group, .showcase-group')?.querySelector('.caption')?.textContent || target.alt || '';
    lbCap.textContent = cap.trim();
    lbCount.textContent = `${current + 1} / ${images.length}`;
  };
  images.forEach((img, index) => {
    img.addEventListener('click', () => {
      if (img.closest('.curtain-stage')) return;
      showAt(index);
      dialog.showModal();
    });
  });
  dialog.querySelector('#lb-prev').addEventListener('click', () => showAt(current - 1));
  dialog.querySelector('#lb-next').addEventListener('click', () => showAt(current + 1));
  dialog.querySelector('#lb-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
  document.addEventListener('keydown', e => {
    if (!dialog.open) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); showAt(current - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); showAt(current + 1); }
  });
})();
