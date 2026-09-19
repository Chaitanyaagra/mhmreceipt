/* "A new version is available" banner.

   The service worker (sw.js) serves app code stale-while-revalidate: the
   CACHED copy renders instantly, while a fresh copy downloads in the
   background and takes over on the NEXT navigation. That's the right
   tradeoff for speed, but it means a critical fix (a payment bug, a security
   rule change, a broken flow) can sit one whole visit away from a resident
   who already has the page open — with nothing telling them a fix exists.

   This closes that gap without forcing an interruption: once the new
   service worker has actually taken control of this tab (confirmed via
   controllerchange, not just "installed" — installed can still be waiting
   behind an open tab), show a small banner offering a one-tap reload. The
   person chooses when, so it never interrupts something they're doing
   mid-form. */
(function updateBanner() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  // Capture whether a service worker was ALREADY controlling this page
  // before anything else happens. A first-ever install (nothing was
  // controlling the page yet) also fires one controllerchange — that's
  // onboarding, not an update, and must not show this banner. Only a
  // controllerchange that happens while a worker was already active is a
  // genuine hand-off to a newer version.
  const hadController = !!navigator.serviceWorker.controller;
  let shown = false;

  function showBanner() {
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
      <span style="flex:1;">A new version is available.</span>
      <button type="button" id="swUpdateReloadBtn" style="background:#F5A623; color:#0A1B33; border:none; border-radius:8px; padding:7px 14px; font-weight:700; font-size:13px; cursor:pointer; white-space:nowrap;">Reload</button>
      <button type="button" id="swUpdateDismissBtn" aria-label="Dismiss" style="background:none; border:none; color:rgba(255,255,255,.6); font-size:18px; line-height:1; cursor:pointer; padding:2px 4px;">✕</button>
    `;
    document.body.appendChild(banner);
    document.getElementById('swUpdateReloadBtn').addEventListener('click', () => location.reload());
    document.getElementById('swUpdateDismissBtn').addEventListener('click', () => banner.remove());
  }

  // Fires when a NEW service worker actually takes control of this page —
  // i.e. the update is live for this tab, not just downloaded/waiting.
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || shown) return;
    shown = true;
    showBanner();
  });
})();
