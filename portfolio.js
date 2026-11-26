(() => {
  'use strict';

  const yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  const mediaWrap = document.getElementById('projector-media');
  const video = document.getElementById('projector-video');
  const toggleBtn = document.getElementById('projector-preview-toggle');
  if (!mediaWrap || !video || !toggleBtn) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let isVisible = false;
  let hoverActive = false;
  let pinnedActive = false;

  function updatePlayback() {
    const shouldPlay =
      isVisible &&
      !document.hidden &&
      (pinnedActive || (hoverActive && !reducedMotion.matches));

    if (shouldPlay) {
      mediaWrap.classList.add('is-playing');
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          mediaWrap.classList.remove('is-playing');
        });
      }
    } else {
      video.pause();
      mediaWrap.classList.remove('is-playing');
    }

    toggleBtn.setAttribute('aria-pressed', String(pinnedActive));
    toggleBtn.textContent = pinnedActive ? '❚❚ Pause reel' : '▶ Preview reel';
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        isVisible = entry.isIntersecting;
        updatePlayback();
      },
      { threshold: 0.25 }
    );
    observer.observe(mediaWrap);
  } else {
    isVisible = true;
  }

  mediaWrap.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return;
    hoverActive = true;
    updatePlayback();
  });

  mediaWrap.addEventListener('pointerleave', () => {
    hoverActive = false;
    updatePlayback();
  });

  toggleBtn.addEventListener('click', () => {
    pinnedActive = !pinnedActive;
    updatePlayback();
  });

  document.addEventListener('visibilitychange', updatePlayback);
  reducedMotion.addEventListener('change', updatePlayback);
})();
