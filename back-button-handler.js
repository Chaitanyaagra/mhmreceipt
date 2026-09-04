/* Shared back-button / back-gesture handler for the installed PWA.

   Problem: in a standalone-installed PWA, the Android back button (and the
   back gesture) pops the single history entry and the OS closes the app.
   For an app with modals and in-page tab/view navigation that feels like a
   crash — one stray back and everything's gone.

   Approach: keep one "trap" entry on the history stack. When the user presses
   back, the popstate fires; we handle it (close the top-most open modal, or
   let a registered handler step back one level) and then immediately push the
   trap entry again so there's always something to pop next time. The app only
   actually exits when there's nothing left to close AND the user presses back
   again quickly (double-press to exit), which we confirm with a small toast.

   This is intentionally framework-free and defensive: any page can just
   include it, and pages can optionally register their own "step back" via
   window.__registerBackStep(fn) (e.g. admin returning to Overview, a resident
   tab returning to Home). If none is registered, the modal-closing behaviour
   alone already stops accidental exits from any modal. */
(function backButtonHandler() {
  // A page can register a function that tries to step back one level in its
  // own navigation (return true if it consumed the back press, false if it's
  // already at the top level and back should mean "exit").
  let stepBack = null;
  window.__registerBackStep = (fn) => { stepBack = typeof fn === 'function' ? fn : null; };

  // Close the visually top-most open modal, if any. Returns true if one closed.
  function closeTopOpenModal() {
    const open = Array.from(document.querySelectorAll('.modal-backdrop.open'));
    if (!open.length) return false;
    // Last one in DOM order is the most recently stacked / on top.
    open[open.length - 1].classList.remove('open');
    return true;
  }

  // Also close any open non-modal overlays this project uses (notification
  // panel, mobile nav drawer) so back dismisses those too.
  function closeOtherOverlays() {
    let closed = false;
    document.querySelectorAll('.notif-panel.open, .side-drawer.open, .drawer.open').forEach((el) => {
      el.classList.remove('open');
      closed = true;
    });
    return closed;
  }

  let lastBackAt = 0;
  function pushTrap() {
    try { history.pushState({ __trap: true }, ''); } catch (_) {}
  }

  // Seed one trap entry once the page has loaded.
  window.addEventListener('load', () => { pushTrap(); });

  window.addEventListener('popstate', () => {
    // 1) A modal open? Close it and re-arm. Never exits.
    if (closeTopOpenModal() || closeOtherOverlays()) {
      pushTrap();
      return;
    }
    // 2) Let the page step back one level (tab -> Home, view -> Overview).
    if (stepBack) {
      let consumed = false;
      try { consumed = stepBack() === true; } catch (_) { consumed = false; }
      if (consumed) { pushTrap(); return; }
    }
    // 3) Nothing left to close and we're at the top level: require a second
    //    back press within 2s to actually exit, so a single stray press
    //    can't. First press re-arms the trap and shows a hint.
    const now = Date.now();
    if (now - lastBackAt < 2000) {
      // Let this pop go through (do not re-arm) — the app exits.
      return;
    }
    lastBackAt = now;
    pushTrap();
    try {
      if (typeof window.showToast === 'function') {
        window.showToast('Press back again to exit', 'info');
      }
    } catch (_) {}
  });
})();
