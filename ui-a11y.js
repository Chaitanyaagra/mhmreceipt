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

  /* Escape, a tap on the dark backdrop and the Back gesture all used to close
     a dialog instantly — including one with a half-filled form (or one whose
     submit was still running), losing what had been typed or entered. A
     dialog counts as "dirty" once the person has genuinely typed/selected
     something in it (isTrusted: scripted pre-fills and programmatic events
     don't count, so opening an edit form pre-populated is not "changes").
     Explicit Cancel/✕ buttons are deliberate and are not intercepted. */
  const markDirty = (e) => {
    if (!e.isTrusted) return;
    const t = e.target;
    if (!t || !t.matches || !t.matches('input, textarea, select')) return;
    if (['search', 'button', 'submit', 'reset'].includes(t.type) || t.hasAttribute('data-no-dirty')) return;
    e.currentTarget.dataset.dirty = '1';
  };
  const confirmClose = (backdrop) => {
    const busy = !!window.__appBusy;
    const dirty = backdrop && backdrop.dataset && backdrop.dataset.dirty === '1';
    if (!busy && !dirty) return true;
    return window.confirm(busy
      ? "An action is still in progress — closing this won't cancel it. Close anyway?"
      : 'You have unsaved changes here. Discard them and close?');
  };
  // Shared with back-button-handler.js (a plain script, not a module).
  window.__confirmModalClose = confirmClose;

  const onKeydown = (e) => {
    if (!openBackdrop) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!confirmClose(openBackdrop)) return;   // unsaved changes / work in progress: ask first
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
      if (isOpen && el !== openBackdrop) { delete el.dataset.dirty; activate(el); }
      else if (!isOpen) { delete el.dataset.dirty; if (el === openBackdrop) deactivate(); }
    }
  });
  document.querySelectorAll('.modal-backdrop').forEach(b =>
    observer.observe(b, { attributes: true, attributeFilter: ['class'] }));

  // Clicking the dark area outside the dialog closes it — expected modal
  // behaviour that was also missing.
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('input', markDirty, true);
    backdrop.addEventListener('change', markDirty, true);
    backdrop.addEventListener('mousedown', (e) => {
      if (e.target === backdrop && confirmClose(backdrop)) backdrop.classList.remove('open');
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

/* A "slow connection" banner — distinct from fully offline. Uses the Network
   Information API (navigator.connection.effectiveType), which reports '2g'
   or 'slow-2g' for a genuinely poor connection — common on Indian mobile
   networks, where being "online" doesn't mean things load quickly. This API
   only exists on Chrome/Edge/Android browsers, not Safari/iOS; where it's
   absent this quietly does nothing rather than erroring, so it's always
   safe to call. Shows once per slow stretch and clears itself the moment
   the connection improves — no action needed from the person either way. */
export function installSlowConnectionBanner() {
  if (typeof navigator === 'undefined' || !navigator.connection || typeof navigator.connection.effectiveType !== 'string') return;
  let banner = null;
  const isSlow = () => ['slow-2g', '2g'].includes(navigator.connection.effectiveType);

  const show = () => {
    if (banner || !navigator.onLine) return; // the offline banner already covers fully-offline
    banner = document.createElement('div');
    banner.className = 'offline-banner slow-connection-banner';
    banner.setAttribute('role', 'status');
    banner.innerHTML = `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
      <path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0M12 20h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>
      <span>Slow connection — pages may take a moment to load.</span>`;
    document.body.appendChild(banner);
  };
  const hide = () => { banner && banner.remove(); banner = null; };
  const check = () => { isSlow() ? show() : hide(); };

  navigator.connection.addEventListener('change', check);
  window.addEventListener('online', check);
  window.addEventListener('offline', hide); // let the offline banner own that state
  check();
}

/* ---------------------------------------------------------------------- */
/*  Password show / hide toggle                                            */
/*                                                                          */
/*  Adds an eye button to every password field so people can check what    */
/*  they typed. Runs from the Firebase-free block so it works on the login  */
/*  screens even if Firebase is slow or unavailable. Safe to call more than */
/*  once — already-wrapped fields are skipped, so it also covers password   */
/*  inputs that appear later (e.g. the admin "add user" form).             */
/* ---------------------------------------------------------------------- */
const EYE_SVG = `
  <svg class="pw-eye" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" stroke-width="1.7"/>
    <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7"/>
  </svg>
  <svg class="pw-eye-off" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7c2 0 3.8.7 5.3 1.6M22 12s-3.6 7-10 7c-2 0-3.8-.7-5.3-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M3 3l18 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
  </svg>`;

export function installPasswordToggles(root = document) {
  const fields = root.querySelectorAll('input[type="password"]');
  fields.forEach((input) => {
    if (input.dataset.pwToggle === '1') return;      // already done
    input.dataset.pwToggle = '1';

    // Wrap the input so the button can sit inside the field.
    const wrap = document.createElement('span');
    wrap.className = 'pw-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pw-toggle';
    btn.setAttribute('aria-label', 'Password dikhayein');
    btn.setAttribute('title', 'Password dikhayein');
    btn.innerHTML = EYE_SVG;
    wrap.appendChild(btn);

    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.classList.toggle('is-on', show);
      const label = show ? 'Password chhupayein' : 'Password dikhayein';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
      // Keep the caret where the user was typing.
      const pos = input.value.length;
      try { input.focus(); input.setSelectionRange(pos, pos); } catch (e) {}
    });
  });
}
