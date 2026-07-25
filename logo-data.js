/* ==========================================================================
   MHMRWS society seal
   --------------------------------------------------------------------------
   The seal now lives in logo.webp as a real image file, not as 66 KB of
   base64 inlined here. That base64 used to parse on EVERY page before first
   paint, in a render-blocking module — pure dead weight for the common case,
   where the seal is just an <img> the browser can fetch and cache on its own.

   What still needs a data-URI is the PDF and canvas code (jsPDF cannot take a
   URL, and a <canvas> tainted by a cross-origin-ish load cannot be exported).
   So this module keeps a data-URI available — but fetches it lazily, only when
   something actually asks, and caches the result. On a normal visit it never
   runs at all.

   This module still imports nothing from Firebase, so the branding path stays
   independent of the SDK: an <img src="logo.webp"> renders even if everything
   else on the page fails to load.
   ========================================================================== */

// Resolve logo.webp relative to this module, so it works from / and from /tools.
export const LOGO_URL = new URL('./logo.webp', import.meta.url).href;

let _dataUriPromise = null;

/* Fetch the seal and return it as a data: URI, for jsPDF / canvas. Cached, so
   repeated receipts in one session cost one network read (and the service
   worker serves it offline). */
export function getLogoDataUri() {
  if (_dataUriPromise) return _dataUriPromise;
  _dataUriPromise = fetch(LOGO_URL)
    .then(r => { if (!r.ok) throw new Error('logo fetch ' + r.status); return r.blob(); })
    .then(blob => new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(fr.result);
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    }))
    .catch(err => { _dataUriPromise = null; throw err; });  // let a later call retry
  return _dataUriPromise;
}

/* Back-compat shim. Older code imported LOGO_DATA_URI expecting a ready string.
   That eager value is exactly what we are trying to avoid, so this is now the
   image URL — correct for any <img src> or CSS use. Code paths that feed jsPDF
   or canvas must call getLogoDataUri() instead; those have been updated. */
export const LOGO_DATA_URI = LOGO_URL;
