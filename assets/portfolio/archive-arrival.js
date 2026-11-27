// Only archive launches get an incoming veil. Normal visits render immediately.
(() => {
  let handoff;
  const key = 'archive-project-entry';
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return;
    sessionStorage.removeItem(key);
    handoff = JSON.parse(data);
  } catch {
    return;
  }
  if (handoff?.path !== location.pathname || Date.now() - handoff.time > 12000 ||
      matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement;
  const style = document.createElement('style');
  style.textContent = `
    html.archive-arriving::after {
      content: ""; position: fixed; inset: 0; z-index: 2147483647;
      background: #08090b; pointer-events: none;
      animation: archive-enter 440ms cubic-bezier(.25,.7,.3,1) both;
    }
    @keyframes archive-enter {
      0%, 16% { opacity: 1; }
      100% { opacity: 0; }
    }
  `;
  document.head.append(style);
  root.classList.add('archive-arriving');
  window.addEventListener('pageshow', () => {
    window.setTimeout(() => {
      root.classList.remove('archive-arriving');
      style.remove();
    }, 520);
  }, { once: true });
})();
