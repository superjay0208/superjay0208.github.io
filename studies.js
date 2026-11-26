(() => {
  'use strict';

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
