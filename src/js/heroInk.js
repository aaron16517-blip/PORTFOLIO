/* ============================================================
   HERO INK — small type that turns black under the ghost cursor

   The ghost cursor is white smoke under a 'screen' blend, so the light
   hero type it drifts behind disappears into it. That type takes an
   --ink value from 0 to 1 instead: 0 is its normal colour, 1 is black.

   Per LETTER, not per element. The bio is one wide block and the smoke
   is smaller than it, so inking the whole element turned the words the
   smoke was not touching black on the black ground — invisible.

   And from the smoke that is ACTUALLY there. After each frame the ghost
   lets us read its drawing buffer under a box; each letter is inked by
   how much smoke really sits behind it. Estimating that from the pointer
   and the radius was tried first and overshot — the smoke is patchy
   noise, so letters in the gaps went black against black.

   createHeroInk({ split, whole }) -> onFrame(state)
     split — elements whose text is broken into letters
     whole — elements inked as one (for text other code rewrites; menu.js
             swaps DIVE IN for CLOSE, which would wipe letter spans)
     Pass the returned function as the ghost cursor's onFrame option.
   ============================================================ */

/* Coverage is the smoke's brightness at that spot, 0..1. The switch sits
   around mid-grey on purpose: below it, the light type still out-contrasts
   the ground and black would vanish into the haze; above it, black wins.
   A low threshold was tried first and blacked out letters sitting on faint
   grey, which read as gaps in the words.

   A letter is either light or black, never between: a blend through the
   switch left mid-grey letters on mid-grey smoke, which vanished. The two
   thresholds are hysteresis, so a letter on the edge does not flicker. */
const INK_ON  = 0.46;
const INK_OFF = 0.36;

/* letter boxes are re-measured at most this often. They only move on
   resize, font load and the intro reveal, and ~150 rect reads a frame is
   waste; scroll is corrected for without a re-measure. */
const REMEASURE_MS = 300;

/* Replace each text node with one span per visible character. The letters
   are aria-hidden and the original sentence is kept once, visually hidden,
   so a screen reader still hears words rather than a spelled-out string. */
function splitLetters(el) {
  const text = el.textContent.replace(/\s+/g, ' ').trim();
  const letters = [];

  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  nodes.forEach((node) => {
    const value = node.nodeValue.replace(/\s+/g, ' ');
    if (!value.trim()) return;

    const wrap = document.createElement('span');
    wrap.setAttribute('aria-hidden', 'true');
    for (const ch of value) {
      if (ch === ' ') {
        wrap.appendChild(document.createTextNode(' '));
        continue;
      }
      const s = document.createElement('span');
      s.className = 'ink-c';
      s.textContent = ch;
      wrap.appendChild(s);
      letters.push(s);
    }
    node.replaceWith(wrap);
  });

  const sr = document.createElement('span');
  sr.className = 'ink-sr';
  sr.textContent = text;
  el.appendChild(sr);

  return letters;
}

export function createHeroInk({ split = [], whole = [] } = {}) {
  /* one group per element — one pixel readback each — holding the units
     (letters, or the element itself) that get their own --ink */
  const groups = [];

  split.filter(Boolean).forEach((el) => {
    el.setAttribute('data-ink', 'split');
    groups.push({ units: splitLetters(el).map((node) => ({ node })), fixed: false, guard: null });
  });

  whole.filter(Boolean).forEach((el) => {
    el.setAttribute('data-ink', 'whole');
    groups.push({
      units: [{ node: el }],
      fixed: getComputedStyle(el).position === 'fixed',
      /* DIVE IN reads CLOSE over the open menu — the smoke is not behind it */
      guard: () => el.getAttribute('aria-expanded') === 'true'
    });
  });

  groups.forEach((g) => g.units.forEach((u) => {
    u.value = 0;
    u.node.style.setProperty('--ink', '0');
  }));

  let measuredAt = -Infinity;
  let measuredScroll = 0;

  function measure(now) {
    measuredAt = now;
    measuredScroll = window.scrollY;
    for (const g of groups) {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      for (const u of g.units) {
        const rc = u.node.getBoundingClientRect();
        u.box = [rc.left, rc.top, rc.right, rc.bottom];
        l = Math.min(l, rc.left); t = Math.min(t, rc.top);
        r = Math.max(r, rc.right); b = Math.max(b, rc.bottom);
      }
      g.box = [l, t, r, b];
    }
  }

  function write(u, v) {
    if (u.value === v) return;
    u.value = v;
    u.node.style.setProperty('--ink', String(v));
  }

  const clear = (g) => g.units.forEach((u) => write(u, 0));

  return function onFrame({ opacity, sample }) {
    /* faded out or torn down: everything back to its normal colour */
    if (!(opacity > 0)) {
      groups.forEach(clear);
      return;
    }

    const now = performance.now();
    if (now - measuredAt > REMEASURE_MS) measure(now);
    const scrolled = window.scrollY - measuredScroll;

    for (const g of groups) {
      if (g.guard && g.guard()) { clear(g); continue; }

      /* in-flow boxes moved up by however far the page has scrolled since
         they were measured; fixed ones did not move */
      const dy = g.fixed ? 0 : scrolled;
      const [l, t, r, b] = g.box;
      const coverage = sample(l, t - dy, r, b - dy);
      if (!coverage) { clear(g); continue; }

      for (const u of g.units) {
        const c = coverage(u.box[0], u.box[1] - dy, u.box[2], u.box[3] - dy);
        write(u, c > (u.value ? INK_OFF : INK_ON) ? 1 : 0);
      }
    }
  };
}
