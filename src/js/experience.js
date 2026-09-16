import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   EXPERIENCE — one scrubbed timeline over a 300vh runway.

     the heading rises,
     a thread draws itself across the frame with a dot riding
     the end of it,
     and the cards come up in sequence into a staggered row.

   Like the rest of the site, this always runs the full motion.
   ============================================================ */

/* how far each card sits off the shared baseline once it lands —
   the row reads as a stagger rather than a rule.
   Below the breakpoint the cards are a single column, where an offset is not
   a stagger any more, just one card sitting on top of the next — so the
   column lands flat. */
const REST_OFFSET_ROW = [0, 34, 12];
const REST_OFFSET_COL = [0, 0, 0];

const restOffsets = () =>
  window.matchMedia('(max-width: 860px)').matches ? REST_OFFSET_COL : REST_OFFSET_ROW;

/* The thread, as fractions of the frame it is drawn in, resolved to pixels
   on every measure. It has to be built this way rather than parked in a fixed
   viewBox: a stretched viewBox makes one user unit stop being one pixel, and
   then the dash that draws the line (measured in screen units, because the
   stroke does not scale) and the point the dot rides (measured in user units,
   by getPointAtLength) disagree — the line finishes early and the dot trails
   behind it. Same units for both, no disagreement.

   The last point is 0.5 / 1.0 — dead centre of the frame's bottom edge, which
   is where the next section's seam begins. That is the hand-off. */
const THREAD = [
  ['M', [1.0083, 0.0778]],
  ['C', [0.8333, 0.2111], [0.7333, 0.3333], [0.5167, 0.3944]],
  ['C', [0.3167, 0.4500], [0.1250, 0.4778], [0.0917, 0.6222]],
  ['C', [0.0625, 0.7778], [0.5000, 0.7667], [0.5000, 1.0000]]
];

/* the point on the curve where it turns over and heads for the bottom edge */
const TURN = { x: 0.0917, y: 0.6222 };

export function initExperience() {
  const section = document.getElementById('experience');
  if (!section) return;

  const head  = section.querySelector('.exp__head');
  const path  = section.querySelector('#expPath');
  const dot   = section.querySelector('#expDot');
  const cards = gsap.utils.toArray('.exp-card', section);

  /* ---------- closed state ---------- */
  gsap.set(head, { opacity: 0, y: 40 });
  cards.forEach((card, i) => {
    gsap.set(card, { opacity: 0, y: 120 + i * 20, scale: 0.94 });
  });

  gsap.set(dot, { opacity: 0 });

  /* the thread is drawn by walking its own dash offset back to 0 */
  const svg = path.ownerSVGElement;
  let len = 0;
  let turnP = 0;

  const draw = { p: 0 };
  const walkThread = () => {
    /* the timeline can tick before the frame has been measured — at boot the
       preloader still owns the screen — and the path is empty until then */
    if (!len) return;
    path.style.strokeDashoffset = String(len * (1 - draw.p));
    /* the dot sits on the drawn end of the line — same units, so it stays
       exactly on the head of the stroke the whole way down */
    const pt = path.getPointAtLength(len * draw.p);
    dot.style.left = pt.x + 'px';
    dot.style.top  = pt.y + 'px';
  };

  const measure = () => {
    const box = svg.getBoundingClientRect();
    const w = box.width, h = box.height;
    if (w < 2 || h < 2) return;

    path.setAttribute('d', THREAD.map(
      ([cmd, ...pts]) => cmd + ' ' + pts
        .map(([x, y]) => (x * w).toFixed(2) + ' ' + (y * h).toFixed(2))
        .join(', ')
    ).join(' '));

    len = path.getTotalLength();
    path.style.strokeDasharray = String(len);

    /* Where the thread stops sweeping and starts falling. Found by walking the
       path rather than hard-coded, so reshaping the curve cannot put the two
       halves of the draw out of step with it. */
    const tx = TURN.x * w, ty = TURN.y * h;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 240; i++) {
      const pt = path.getPointAtLength((len * i) / 240);
      const d = (pt.x - tx) ** 2 + (pt.y - ty) ** 2;
      if (d < bestD) { bestD = d; best = i / 240; }
    }
    turnP = best;

    walkThread();
  };

  measure();
  /* the curve is sized to the frame, so it is rebuilt whenever ScrollTrigger
     remeasures everything else */
  ScrollTrigger.addEventListener('refresh', measure);

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.exp',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8,
      /* turnP is measured, so the tween below reads it as a function and this
         makes GSAP ask for it again after a resize */
      invalidateOnRefresh: true
    }
  });

  /* ---------- 1. the heading ---------- */
  tl.to(head, { opacity: 1, y: 0, duration: 0.12 }, 0.02);

  /* ---------- 2. the thread ----------
     Two moves, not one. It sweeps in and stops at the turn while the cards
     land, then drops out of the bottom of the frame — so the fall reads as
     the section handing over rather than as more of the same sweep. */
  tl.to(dot,  { opacity: 1, duration: 0.05 }, 0.06)
    .to(draw, { p: () => turnP, duration: 0.56, onUpdate: walkThread }, 0.06)
    .to(draw, { p: 1, duration: 0.20, ease: 'power1.in', onUpdate: walkThread }, 0.80);

  /* ---------- 3. the cards, one after another ---------- */
  const REST_OFFSET = restOffsets();
  cards.forEach((card, i) => {
    tl.to(card, {
      opacity: 1,
      y: REST_OFFSET[i] ?? 0,
      scale: 1,
      duration: 0.22,
      ease: 'power2.out'
    }, 0.18 + i * 0.18);
  });

  /* it rides the fall all the way to the edge and goes out with it */
  tl.to(dot, { opacity: 0, duration: 0.03 }, 0.97);

  /* ---------- 4. hand over ----------
     Nothing dims here, deliberately.

     The sticky unpins at exactly the scrub's end, and at that instant its
     bottom edge sits on the next section's top edge — which is where the
     next line starts, at the same 50% of the width. So the thread's last
     pixel and the seam's first pixel are the same pixel, and from then on
     both scroll at the same rate. Fading the frame out here is what used to
     break that join and leave a black gap in the middle of it. */

  return tl;
}
