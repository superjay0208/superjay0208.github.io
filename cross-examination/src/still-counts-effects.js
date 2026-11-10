let audio;
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export function sound(kind, enabled) {
  if (!enabled) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume().catch(() => {});
    const notes = kind === 'receipt' ? [330, 415, 494, 660] : kind === 'review' ? [260, 390] : [kind === 'yes' ? 440 : 370, 180];
    notes.forEach((freq, i) => {
      const o = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + i * .035;
      o.type = i === 0 ? 'sine' : 'triangle'; o.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(.0001, t); gain.gain.exponentialRampToValueAtTime(.09, t + .008); gain.gain.exponentialRampToValueAtTime(.0001, t + .15);
      o.connect(gain); gain.connect(audio.destination); o.start(t); o.stop(t + .17);
    });
  } catch { /* Silent play remains complete. */ }
}
export function confetti(root, verdict) {
  if (reduced()) return;
  for (let i = 0; i < 15; i++) {
    const el = document.createElement('i'); el.className = `paper-bit ${verdict}`;
    el.style.setProperty('--x', `${(Math.random() - .5) * 340}px`);
    el.style.setProperty('--y', `${-30 - Math.random() * 190}px`);
    el.style.setProperty('--r', `${Math.random() * 700}deg`);
    root.append(el); el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}
