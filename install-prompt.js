/* Shared PWA "install this app" prompt — ported from the MHM inspection app.
   index.html has its own inline copy (it loads no shared UI modules that early);
   guard.html and staff.html import this instead so the three apps behave
   identically without three copies of the logic.

   A browser fires `beforeinstallprompt` when a page qualifies as an installable
   PWA (manifest + service worker + HTTPS). We capture it and show our own
   dismissible banner rather than relying on the easily-missed address-bar icon.
   iOS/Safari never fires this event and has no programmatic install, so there
   we show the Share -> Add to Home Screen instruction instead. Self-suppresses
   once installed; a dismissal snoozes for three days instead of nagging. */
export function installAppInstallPrompt({ appName, showToast }) {
  let deferredPrompt = null;
  const SNOOZE_KEY = 'mhmrws_install_snoozed';
  const INSTALLED_KEY = 'mhmrws_pwa_installed';

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true
    || localStorage.getItem(INSTALLED_KEY) === '1';

  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isInAppBrowser = () =>
    /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|WhatsApp|TikTok|Snapchat|LinkedInApp|Twitter|GSA\/|Threads/i.test(navigator.userAgent || '');

  function shouldShow() {
    if (isStandalone()) return false;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return false;
    const snz = localStorage.getItem(SNOOZE_KEY);
    if (snz && Date.now() < Number(snz)) return false;
    return true;
  }

  const removeBanner = () => document.getElementById('installBanner')?.remove();

  function snooze() {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
    removeBanner();
  }

  function showBanner() {
    if (document.getElementById('installBanner') || !shouldShow()) return;
    if (!deferredPrompt && !isIOS()) return;

    const banner = document.createElement('div');
    banner.id = 'installBanner';
    banner.className = 'install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install app');
    banner.innerHTML = `
      <div class="ib-icon"><img src="icon-192.png" alt="" width="40" height="40"></div>
      <div class="ib-text">
        <b>Install ${appName}</b>
        <span>Home screen se ek app ki tarah kholein — tez aur offline bhi.</span>
      </div>
      <div class="ib-actions">
        <button type="button" class="ib-install">Install</button>
        <button type="button" class="ib-dismiss" aria-label="Dismiss">Baad mein</button>
      </div>`;
    document.body.appendChild(banner);

    banner.querySelector('.ib-dismiss').onclick = snooze;
    banner.querySelector('.ib-install').onclick = async () => {
      if (deferredPrompt) {
        const p = deferredPrompt;
        deferredPrompt = null;
        p.prompt();
        try {
          const choice = await p.userChoice;
          if (choice && choice.outcome === 'accepted') localStorage.setItem(INSTALLED_KEY, '1');
        } catch (e) {}
        removeBanner();
      } else if (isIOS()) {
        if (isInAppBrowser()) {
          showToast?.('Pehle menu se "Open in Safari" chunein, phir Share → "Add to Home Screen".', 'info');
        } else {
          showToast?.('Neeche Share button (⬆️) dabayein, phir "Add to Home Screen" chunein.', 'info');
        }
      }
    };
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    setTimeout(showBanner, 1200);
  });
  window.addEventListener('load', () => { if (isIOS()) setTimeout(showBanner, 1800); });
  window.addEventListener('appinstalled', () => {
    localStorage.setItem(INSTALLED_KEY, '1');
    deferredPrompt = null;
    removeBanner();
    showToast?.('App install ho gayi! Ab home screen se kholein ✓', 'success');
  });
}
