/* ==========================================================================
   ui-a11y.js — accessibility + offline helpers, with NO Firebase dependency.
   --------------------------------------------------------------------------
   These deliberately live in their own module rather than in app-common.js.
   app-common imports the Firebase SDK, so anything in it only runs after those
   CDN scripts load. Modal focus-trapping and the offline banner must work even
   when Firebase is slow or down — a resident on a dead connection still needs
   Esc to close a dialog and a "you are offline" hint. Keeping these here lets
   the Firebase-free part of each page install them unconditionally.
   ========================================================================== */

/* ---------------------------------------------------------------------- */
/*  Modal accessibility — focus trap, Esc to close, aria-modal              */
/*                                                                          */
/*  The app has seven dialogs, all opened by toggling an `.open` class on a */
/*  `.modal-backdrop`. Previously that was all it did: the background stayed */
/*  reachable by Tab, Esc did nothing, and a screen reader was never told a */
/*  dialog had appeared. Rewriting every open/close call site would be many */
/*  risky edits, so instead this watches for the `.open` class landing on   */
/*  any backdrop and layers the accessibility on centrally:                 */
/*                                                                          */
/*    • marks the backdrop role="dialog" aria-modal="true"                  */
/*    • moves focus into the dialog, remembering where it came from         */
/*    • traps Tab within the dialog while it is open                        */
/*    • closes on Esc (by removing `.open`, so existing close code runs)    */
/*    • restores focus to the trigger on close                             */
/*                                                                          */
/*  No call site changes: opening a modal the old way now just works.       */
/* ---------------------------------------------------------------------- */
export function installModalA11y() {
  if (typeof document === 'undefined') return;

  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  let openBackdrop = null;
  let lastFocused = null;

  const focusables = (root) => Array.from(root.querySelectorAll(FOCUSABLE))
    .filter(el => el.offsetParent !== null || el === document.activeElement);

  const onKeydown = (e) => {
    if (!openBackdrop) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      openBackdrop.classList.remove('open');   // triggers the existing close path
      return;
    }
    if (e.key === 'Tab') {
      const items = focusables(openBackdrop);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const activate = (backdrop) => {
    openBackdrop = backdrop;
    lastFocused = document.activeElement;
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    // Prefer the modal's heading/first control for the initial focus.
    const modal = backdrop.querySelector('.modal') || backdrop;
    const target = modal.querySelector('h2, h3, [autofocus]') || focusables(modal)[0] || modal;
    if (target && target.tagName && /H2|H3/.test(target.tagName)) target.setAttribute('tabindex', '-1');
    setTimeout(() => { try { target.focus({ preventScroll: false }); } catch (_) {} }, 40);
    document.addEventListener('keydown', onKeydown, true);
  };

  const deactivate = () => {
    document.removeEventListener('keydown', onKeydown, true);
    if (lastFocused) { try { lastFocused.focus({ preventScroll: true }); } catch (_) {} }
    openBackdrop = null; lastFocused = null;
  };

  // Watch every backdrop's class list for `.open` coming and going.
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.attributeName !== 'class') continue;
      const el = m.target;
      if (!el.classList || !el.classList.contains('modal-backdrop')) continue;
      const isOpen = el.classList.contains('open');
      if (isOpen && el !== openBackdrop) activate(el);
      else if (!isOpen && el === openBackdrop) deactivate();
    }
  });
  document.querySelectorAll('.modal-backdrop').forEach(b =>
    observer.observe(b, { attributes: true, attributeFilter: ['class'] }));

  // Clicking the dark area outside the dialog closes it — expected modal
  // behaviour that was also missing.
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop) backdrop.classList.remove('open');
    });
  });
}

/* ---------------------------------------------------------------------- */
/*  Offline awareness                                                       */
/*                                                                          */
/*  This is a PWA — residents open it on the move, on patchy networks. When */
/*  the connection drops, a submit used to fail with a generic error and no */
/*  explanation. This shows a quiet banner while offline so the person      */
/*  knows to wait, and clears it the moment the network returns.            */
/* ---------------------------------------------------------------------- */
export function installOfflineBanner() {
  if (typeof window === 'undefined') return;
  let banner = null;

  const show = () => {
    if (banner) return;
    banner = document.createElement('div');
    banner.className = 'offline-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M2 4l20 16M8.5 8.5A6 6 0 0021 12M12 5a9 9 0 019 4M3 9a9 9 0 013.5-2.6M6.5 12.5A6 6 0 019 11M12 20h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span>Aap abhi offline hain — internet aate hi dobara koshish karein.</span>`;
    document.body.appendChild(banner);
  };
  const hide = () => { banner && banner.remove(); banner = null; };

  window.addEventListener('offline', show);
  window.addEventListener('online', hide);
  if (!navigator.onLine) show();
}

/* Is the browser currently offline? Callers use this to give a specific
   message before attempting a write that is bound to fail. */
export function isOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}
