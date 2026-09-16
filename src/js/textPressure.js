import gsap from 'gsap';
import { isTouch as touch } from './device.js';

/* ============================================================
   TextPressure — vanilla port of the React Bits component.
   Original ported from https://codepen.io/JuanFuentes/full/rgXKGQ

   Variable-font axes (wght / wdth / ital) react to cursor distance:
   letters nearest the cursor go wide and heavy, far ones go narrow
   and light. Same maths as the React version, no framework.

   createTextPressure(container, options) -> { destroy, refresh }
   ============================================================ */

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

/* value falls off with distance, clamped to a floor */
const getAttr = (distance, maxDist, minVal, maxVal) => {
  const val = maxVal - Math.abs((maxVal * distance) / maxDist);
  return Math.max(minVal, val + minVal);
};

const debounce = (fn, delay) => {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
};

export function createTextPressure(container, {
  text = 'COMPRESSA',
  fontFamily = 'Roboto Flex',

  width  = true,
  weight = true,
  italic = true,
  alpha  = false,

  flex   = true,
  stroke = false,
  scale  = false,

  textColor   = '#FFFFFF',
  strokeColor = '#FF0000',
  className   = '',

  minFontSize = 24,
  maxFontSize = Infinity
} = {}) {
  if (!container) return { destroy() {}, refresh() {} };

  const chars = text.split('');

  /* alpha writes opacity every frame; the reveal needs to own it first */
  let alphaActive = false;

  /* ---------- build the DOM ---------- */
  const title = document.createElement('h1');
  title.className = ['text-pressure-title', className, flex ? 'is-flex' : '', stroke ? 'is-stroke' : '']
    .filter(Boolean)
    .join(' ');

  title.style.fontFamily = fontFamily;
  title.style.color = textColor;
  title.style.setProperty('--tp-stroke-color', strokeColor);

  const spans = chars.map((char) => {
    const span = document.createElement('span');
    span.textContent = char;
    span.dataset.char = char;
    if (!stroke) span.style.color = textColor;
    title.appendChild(span);
    return span;
  });

  container.innerHTML = '';
  container.appendChild(title);

  /* ---------- cursor tracking ---------- */
  const cursor = { x: 0, y: 0 };  // where the pointer actually is
  const mouse  = { x: 0, y: 0 };  // eased follower the letters read from

  const centreOnContainer = () => {
    const { left, top, width: w, height: h } = container.getBoundingClientRect();
    mouse.x = cursor.x = left + w / 2;
    mouse.y = cursor.y = top + h / 2;
  };
  centreOnContainer();

  const onMouseMove = (e) => { cursor.x = e.clientX; cursor.y = e.clientY; };

  /* Touch: no pointer to follow. Following the finger meant every scroll
     swipe re-laid-out the whole name, and the pose went stale the moment the
     page moved (the stored point stayed put while the letters scrolled away,
     so they all collapsed to hairlines). Instead the name holds the pose it
     has with the cursor resting at its centre — wide in the middle, fine at
     the edges — computed on demand rather than every frame. */
  if (!touch) window.addEventListener('mousemove', onMouseMove);

  /* ---------- sizing ---------- */
  const setSize = () => {
    const { width: containerW, height: containerH } = container.getBoundingClientRect();
    if (!containerW) return;

    let fontSize = containerW / (chars.length / 2);
    fontSize = Math.max(fontSize, minFontSize);
    fontSize = Math.min(fontSize, maxFontSize);

    title.style.fontSize = `${fontSize}px`;
    title.style.lineHeight = '1';
    title.style.transform = 'scale(1, 1)';

    if (!scale) return;

    requestAnimationFrame(() => {
      const textRect = title.getBoundingClientRect();
      if (textRect.height > 0) {
        const yRatio = containerH / textRect.height;
        title.style.lineHeight = yRatio;
        title.style.transform = `scale(1, ${yRatio})`;
      }
    });
  };

  /* how many frames the touch pose keeps re-settling after something moved
     the letters (size, font, reveal) — a pose change shifts its neighbours,
     so it takes a few passes to land */
  let settle = 20;
  const reflow = () => { settle = 20; };

  const debouncedSetSize = debounce(() => { setSize(); reflow(); }, 100);
  setSize();
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    /* address bar on a phone — the name does not care about height */
    if (touch && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    debouncedSetSize();
  });

  /* the font arrives after first paint — remeasure once it does */
  if (document.fonts?.ready) document.fonts.ready.then(() => { setSize(); reflow(); });

  /* off screen, nothing to update */
  let onScreen = true;
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
  }).observe(container);

  /* ---------- the loop (shares GSAP's ticker, no second rAF) ---------- */
  const tick = () => {
    if (!onScreen) return;

    if (touch) {
      if (settle <= 0) return;
      settle--;
      /* the resting point is the name's own centre, read in the same frame
         as the letters so scroll position cancels out */
      const { left, top, width: cw, height: ch } = container.getBoundingClientRect();
      mouse.x = left + cw / 2;
      mouse.y = top + ch / 2;
    } else {
      mouse.x += (cursor.x - mouse.x) / 15;
      mouse.y += (cursor.y - mouse.y) / 15;
    }

    const titleRect = title.getBoundingClientRect();
    const maxDist = titleRect.width / 2;
    if (!maxDist) return;

    spans.forEach((span) => {
      /* x from the letter, y from the line: the reveal slides letters
         vertically, and that must not change the pose they land in */
      const rect = span.getBoundingClientRect();
      const charCentre = { x: rect.x + rect.width / 2, y: titleRect.y + titleRect.height / 2 };
      const d = dist(mouse, charCentre);

      const wdth    = width  ? Math.floor(getAttr(d, maxDist, 5, 200))   : 100;
      const wght    = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400;
      const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 0;
      const alphaV  = alpha  ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 1;

      const settings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`;
      if (span.style.fontVariationSettings !== settings) {
        span.style.fontVariationSettings = settings;
      }
      if (alphaActive && span.style.opacity !== alphaV) {
        span.style.opacity = alphaV;
      }
    });
  };

  gsap.ticker.add(tick);

  return {
    chars: spans,
    refresh() { setSize(); reflow(); },

    /* hand cursor-driven opacity over to the component */
    setAlphaActive(v) { alphaActive = alpha && v; },
    destroy() {
      gsap.ticker.remove(tick);
      window.removeEventListener('mousemove', onMouseMove);
      container.innerHTML = '';
    }
  };
}
