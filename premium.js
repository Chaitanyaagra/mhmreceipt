/* ============================================================================
   premium.js — small, dependency-free "premium touch" helpers.

   Firebase-free on purpose, so it works on every page (and even if Firebase is
   slow or blocked). Exposes:
     - window.__confetti()            fire a celebratory burst (navy + gold)
     - window.__successHTML(t, m)     markup for the animated success checkmark
     - window.__hideAppLoader()       fade out the logo loading screen

   Everything respects prefers-reduced-motion: confetti is skipped and the
   checkmark simply appears without drawing.
   ============================================================================ */

const REDUCED = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---- Confetti -------------------------------------------------------------
   A one-shot canvas burst tuned to the society palette. No library — just a
   few dozen paper bits under gravity, cleaned up automatically. Called only on
   genuine success (registration submitted / payment recorded), never for
   ordinary actions. */
export function confetti(options = {}) {
  if (REDUCED) return;                       // honour reduced-motion
  const COLORS = options.colors || ['#C9A227', '#E4C765', '#2B5AA6', '#1F4585', '#ffffff'];
  const COUNT = options.count || 130;

  let canvas = document.getElementById('confettiCanvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confettiCanvas';
    document.body.appendChild(canvas);
  }
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const resize = () => {
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();

  const W = window.innerWidth, H = window.innerHeight;
  // Two launch points (lower-left and lower-right) firing up and inward.
  const pieces = [];
  for (let i = 0; i < COUNT; i++) {
    const fromLeft = i % 2 === 0;
    pieces.push({
      x: fromLeft ? W * 0.15 : W * 0.85,
      y: H * 0.62,
      vx: (fromLeft ? 1 : -1) * (Math.random() * 5 + 2) + (Math.random() - 0.5) * 3,
      vy: -(Math.random() * 11 + 9),
      g: 0.28 + Math.random() * 0.12,
      size: Math.random() * 7 + 4,
      color: COLORS[(Math.random() * COLORS.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
      life: 0,
      ttl: 120 + Math.random() * 40,
      shape: Math.random() < 0.5 ? 'rect' : 'circle'
    });
  }

  let raf;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of pieces) {
      if (p.life > p.ttl) continue;
      alive++;
      p.life++;
      p.vy += p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      const fade = Math.max(0, 1 - (p.life / p.ttl));
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (alive > 0) raf = requestAnimationFrame(tick);
    else { ctx.clearRect(0, 0, W, H); cancelAnimationFrame(raf); }
  };
  tick();
}

/* ---- Animated success checkmark ------------------------------------------
   Returns markup for a ring + drawn tick, with a title and message. Drop it
   into a modal body or inline container. */
export function successHTML(title, message) {
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
    <div class="success-pop">
      <div class="success-ring">
        <svg viewBox="0 0 52 52" aria-hidden="true">
          <path class="tick" d="M14 27l8 8 16-17"/>
        </svg>
      </div>
      ${title ? `<div class="success-title">${esc(title)}</div>` : ''}
      ${message ? `<div class="success-msg">${esc(message)}</div>` : ''}
    </div>`;
}

/* ---- Loading screen fade-out ---------------------------------------------
   Called once the first meaningful paint is ready. Removes the node after the
   CSS fade so it never traps focus or clicks. */
export function hideAppLoader() {
  const el = document.getElementById('appLoader');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => { try { el.remove(); } catch (e) {} }, 700);
}

/* Expose on window so the Firebase-dependent module blocks can call these
   without importing (mirrors the pattern used for __translate etc.). */
if (typeof window !== 'undefined') {
  window.__confetti = confetti;
  window.__successHTML = successHTML;
  window.__hideAppLoader = hideAppLoader;
}
