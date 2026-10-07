/* ==========================================================================
   html-helpers.js — tiny, dependency-free HTML-string helpers.
   --------------------------------------------------------------------------
   imgTag(src, attrs) builds an <img> tag string with the URL attribute-escaped
   (including quotes).

   WHY THIS EXISTS, rather than writing <img src="${...}"> inline in the pages:
   the pages build their markup in template literals INSIDE large inline
   <script> blocks. Chromium's speculative HTML scanner occasionally reads that
   script text as markup and "preloads" the placeholder as if it were a real
   URL — e.g. GET /${escapeHtml(c.photoURL)} — which 404s and logs a console
   error. Measured at roughly 1 page load in 5 for admin.html and index.html.
   Keeping the literal text `<img src="` out of the inline scripts entirely
   (it lives only in this external file, which the scanner never sees as
   markup) stops those phantom requests.

   Kept separate from app-common.js on purpose: it must be importable from the
   Firebase-free block of a page without dragging the Firebase SDK in.
   ========================================================================== */
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function imgTag(src, attrs = '') {
  const safe = String(src ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  return `<img src="${safe}"${attrs ? ' ' + attrs : ''}>`;
}
