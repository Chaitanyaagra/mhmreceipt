/* Automatic "new version" reload.

   The service worker (sw.js) serves app code stale-while-revalidate: the
   CACHED copy renders instantly, while a fresh copy downloads in the
   background and takes over on the NEXT navigation. That's the right
   tradeoff for speed, but it means a critical fix (a payment bug, a security
   rule change, a broken flow) can sit one whole visit away from a resident
   who already has the page open.

   The earlier version of this file showed a small banner with a "Reload"
   button and a dismiss (✕). In practice, many residents just dismissed it
   (or ignored it) and kept using the stale, already-loaded version
   indefinitely — exactly the gap this exists to close. This version instead
   reloads AUTOMATICALLY, the moment it's actually safe to do so, with no
   click required for the common case:

     - Tab is in the background (person switched away) → reload silently,
       right away. Nobody is looking, so there is nothing to interrupt.
     - Tab is visible but the person isn't mid-something (no modal open, not
       actively typing into a text field) → reload after a brief, visible,
       NON-dismissible "Updating…" notice (short enough not to be an
       interruption, but present long enough that a reload isn't a total
       surprise).
     - Tab is visible AND the person IS mid-something (a modal is open, or
       they're typing) → wait. Re-checked on the next likely "they just
       finished" moment (modal closing, a field losing focus, the tab being
       hidden/shown, a click anywhere) and, as a backstop, every 20 seconds
       regardless, so an update is never stuck waiting forever behind a tab
       that was simply left open and unattended. */
(function updateBanner() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Capture whether a service worker was ALREADY controlling this page
  // before anything else happens. A first-ever install (nothing was
  // controlling the page yet) also fires one controllerchange — that's
  // onboarding, not an update, and must not trigger a reload.
  const hadController = !!navigator.serviceWorker.controller;
  let pending = false;
  let reloadTimer = null;

  // A modal being open, or the focus currently sitting in an actual
  // text-entry field, is the closest cheap signal this app has for "the
  // person is in the middle of something" — reloading through either would
  // risk losing whatever they were doing. Anything else (browsing, a button
  // focused, a checkbox) is safe.
  function isMidSomething() {
    if (document.querySelector('.modal-backdrop.open')) return true;
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'TEXTAREA') return true;
    if (tag === 'INPUT') {
      const skip = ['button', 'submit', 'checkbox', 'radio', 'file', 'reset', 'range', 'color'];
      return !skip.includes((el.type || 'text').toLowerCase());
    }
    return false;
  }

  function showUpdatingNotice() {
    if (document.getElementById('swUpdateBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'swUpdateBanner';
    banner.setAttribute('role', 'status');
    banner.style.cssText = [
      'position:fixed', 'left:12px', 'right:12px', 'bottom:12px', 'z-index:9999',
      'background:#0A1B33', 'color:#fff', 'border-radius:12px', 'padding:12px 14px',
      'display:flex', 'align-items:center', 'gap:10px', 'box-shadow:0 8px 24px rgba(0,0,0,.3)',
      'font-size:13.5px', 'font-family:inherit'
    ].join(';');
    banner.innerHTML = `
      <span style="flex:1;">Updating to the latest version…</span>
      <span style="width:16px; height:16px; border:2px solid rgba(255,255,255,.3); border-top-color:#F5A623; border-radius:50%; animation:sw-spin .7s linear infinite; flex-shrink:0;"></span>
    `;
    if (!document.getElementById('sw-spin-style')) {
      const style = document.createElement('style');
      style.id = 'sw-spin-style';
      style.textContent = '@keyframes sw-spin{to{transform:rotate(360deg);}}';
      document.head.appendChild(style);
    }
    document.body.appendChild(banner);
  }

  function attemptReload() {
    if (!pending) return;
    if (document.hidden) { location.reload(); return; }
    if (isMidSomething()) return; // wait for the next trigger below
    if (reloadTimer) return; // already counting down
    showUpdatingNotice();
    // Short, fixed delay rather than instant — gives the "Updating…" notice
    // a moment to actually be seen before the page goes away, so a reload
    // never feels like a total surprise even though nothing needs a click.
    reloadTimer = setTimeout(() => location.reload(), 1200);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) return;
    pending = true;
    attemptReload();
  });

  // Re-check on every reasonable "they might have just become free" signal.
  document.addEventListener('visibilitychange', attemptReload);
  document.addEventListener('focusout', () => setTimeout(attemptReload, 50));
  document.addEventListener('click', () => setTimeout(attemptReload, 300));
  // Backstop: an update should never be stuck indefinitely behind a tab
  // that was simply left open and unattended (mid-something or not).
  setInterval(attemptReload, 20000);
})();
