/* ============================================================
   DEVICE — one place that decides how hard the page may work.

   Phones get the same sections and the same motion; what changes is
   the cost of each frame: no pointer-only effects (there is no pointer),
   no scrubbed filter blurs (a full-bleed blur re-rasterises every scroll
   frame on a mobile GPU), and the WebGL smoke renders smaller and at 30fps.

   Read once at boot. Rotating a phone does not turn it into a desktop.
   ============================================================ */

const mq = (q) => window.matchMedia(q).matches;

/* no hover and a finger for a pointer — phones and most tablets */
export const isTouch = mq('(hover: none)') || mq('(pointer: coarse)');

/* small screen, whatever the input */
export const isNarrow = mq('(max-width: 860px)');

/* the budget switch the effects read from */
export const isLowPower = isTouch || isNarrow;
