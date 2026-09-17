import gsap from 'gsap';
import { isTouch as touch } from './device.js';

/* ============================================================
   TextPressure — vanilla port of the React Bits component.
   Original ported from https://codepen.io/JuanFuentes/full/rgXKGQ

   Variable-font axes (wght / wdth / ital) react to the pointer:
   letters nearest it go wide and heavy.

   Two input models, one component:

   POINTER (desktop) — the original maths. Every letter reads its
   distance to an eased cursor; far letters thin to hairlines.

   TOUCH (phones) — the original maths reads as distortion on a phone:
   there is no hover, so the name sat frozen in whatever lopsided pose
   the last touch left it in. Instead the name rests in one even weight,
   and a finger raises a soft swell that travels with it — letters under
   the finger grow, the rest stay put — then everything eases back to
   rest when the finger lifts. Each letter springs toward its target, so
   the swell rolls through the word rather than snapping. One sweep plays
   after the intro so the gesture is discoverable.

   Both loops batch their work: every letter is measured first, then
   every letter is written. Interleaving the two forced a layout per
   letter per frame. Both loops also sleep when nothing is moving.

   createTextPressure(container, options)
     -> { chars, refresh, setAlphaActive, hint, destroy }
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

/* ---------- touch tuning ---------- */
/* the resting pose: tall, even, light — the name reads as one word */
const REST = { wght: 240, wdth: 46 };
/* what a letter becomes directly under the finger. wdth stops well short
   of the axis maximum so the swollen letters never push the word past
   the screen edge */
const PEAK = { wght: 900, wdth: 150 };
/* reach of the swell, as a share of the word's width */
const REACH = 0.34;
/* how quickly letters chase their target (per 60fps frame) */
const FOLLOW = 0.2;
/* how quickly the swell rises on touch and falls on release */
const ENGAGE_IN = 0.22;
const ENGAGE_OUT = 0.08;

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
  maxFontSize = Infinity,

  /* touch: where a finger counts. Defaults to the name itself */
  touchArea = null
} = {}) {
  const noop = { chars: [], destroy() {}, refresh() {}, setAlphaActive() {}, hint() {} };
  if (!container) return noop;

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

  const restSettings = `'wght' ${REST.wght}, 'wdth' ${REST.wdth}, 'ital' 0`;

  const spans = chars.map((char) => {
    const span = document.createElement('span');
    span.textContent = char;
    span.dataset.char = char;
    if (!stroke) span.style.color = textColor;
    /* touch starts at rest, so the first paint is already the right pose */
    if (touch) span.style.fontVariationSettings = restSettings;
    title.appendChild(span);
    return span;
  });

  container.innerHTML = '';
  container.appendChild(title);

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

  /* anything that moves the letters wakes the loop */
  let awake = true;
  const wake = () => { awake = true; };
  /* the touch loop caches letter positions; this tells it they moved */
  let layoutChanged = () => {};

  const debouncedSetSize = debounce(() => { setSize(); layoutChanged(); wake(); }, 100);
  setSize();
  let lastW = window.innerWidth;
  const onResize = () => {
    /* address bar on a phone — the name does not care about height */
    if (touch && window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    debouncedSetSize();
  };
  window.addEventListener('resize', onResize);

  /* the font arrives after first paint — remeasure once it does */
  if (document.fonts?.ready) document.fonts.ready.then(() => { setSize(); layoutChanged(); wake(); });

  /* off screen, nothing to update */
  let onScreen = true;
  const io = new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
    if (onScreen) wake();
  });
  io.observe(container);

  /* shared: measure every letter's centre in one pass */
  const centres = new Float64Array(spans.length);
  const measure = () => {
    for (let i = 0; i < spans.length; i++) {
      const r = spans[i].getBoundingClientRect();
      centres[i] = r.x + r.width / 2;
    }
  };

  if (touch) {
    /* ============ TOUCH ============ */
    const finger = { x: 0, y: 0 };
    const cur = spans.map(() => ({ wght: REST.wght, wdth: REST.wdth }));
    let engage = 0;         // 0 = resting, 1 = the swell is fully raised
    let engageTarget = 0;
    let hintTween = null;
    let swollen = false;    // true while any letter is off its rest pose
    const written = spans.map(() => restSettings);
    awake = false;          // at rest there is nothing to do

    const area = touchArea || container;
    const setFinger = (t) => { finger.x = t.clientX; finger.y = t.clientY; };

    /* The layout is read only while the name is at rest, then reused.
       Reading it every frame forced a full-page layout per frame, because
       the scroll animations write styles earlier in the same tick — and on
       a phone that was most of the lag. Positions are stored against the
       page, so scrolling needs no re-read. The swell is placed from the
       rest positions, which also keeps it from chasing its own growth. */
    let needMeasure = true;
    let restW = 0;
    let restMidY = 0;   // page-space centre line of the word
    const measureRest = () => {
      const r = title.getBoundingClientRect();
      if (!r.width) return;
      restW = r.width;
      restMidY = r.y + r.height / 2 + window.scrollY;
      measure();
      needMeasure = false;
    };
    const remeasure = () => { needMeasure = true; };
    layoutChanged = remeasure;

    /* passive, and nothing is prevented: a touch on the name still scrolls
       the page. The swell simply rides along with it. */
    const onStart = (e) => {
      const t = e.touches[0];
      if (!t) return;
      hintTween?.kill();
      hintTween = null;
      setFinger(t);
      engageTarget = 1;
      wake();
    };
    const onMove = (e) => {
      const t = e.touches[0];
      if (!t || engageTarget === 0) return;
      setFinger(t);
      wake();
    };
    const onEnd = (e) => {
      if (e.touches.length) return;
      engageTarget = 0;
      wake();
    };

    area.addEventListener('touchstart', onStart, { passive: true });
    area.addEventListener('touchmove', onMove, { passive: true });
    area.addEventListener('touchend', onEnd, { passive: true });
    area.addEventListener('touchcancel', onEnd, { passive: true });

    const tick = (_t, deltaMs) => {
      if (!awake || !onScreen) return;

      /* frame-rate independent easing */
      const f = Math.min(3, (deltaMs || 16.7) / 16.7);
      const ease = (k) => 1 - Math.pow(1 - k, f);

      /* read — only while every letter still sits in its rest pose */
      if (needMeasure && engage < 0.001 && !swollen) measureRest();
      const reach = restW * REACH;
      if (!reach) return;

      engage += (engageTarget - engage) * ease(engageTarget > engage ? ENGAGE_IN : ENGAGE_OUT);

      const midY = restMidY - window.scrollY;
      /* a finger a little above or below the word still counts; vertical
         distance is weighted down so the swell tracks the finger's x */
      const dy = (finger.y - midY) * 0.45;

      /* write */
      let moving = Math.abs(engageTarget - engage) > 0.002;
      const follow = ease(FOLLOW);

      for (let i = 0; i < spans.length; i++) {
        const d = Math.hypot(finger.x - centres[i], dy);
        /* cosine falloff: full at the finger, zero at `reach`, no hard edge */
        const k = d < reach ? 0.5 + 0.5 * Math.cos((Math.PI * d) / reach) : 0;
        const p = k * engage;

        const c = cur[i];
        const tw = REST.wght + (PEAK.wght - REST.wght) * p;
        const td = REST.wdth + (PEAK.wdth - REST.wdth) * p;
        c.wght += (tw - c.wght) * follow;
        c.wdth += (td - c.wdth) * follow;
        if (Math.abs(tw - c.wght) > 0.5 || Math.abs(td - c.wdth) > 0.3) moving = true;

        /* coarse steps: each new value re-shapes and re-rasterises a
           100px glyph and its outline, and single-unit steps at the tail of
           an ease are invisible */
        /* phones: coarser still. The browser caches each shaped variation,
           so fewer distinct values means most frames reuse a cached shape */
        const wg = REST.wght + Math.round((c.wght - REST.wght) / 20) * 20;
        const wd = REST.wdth + Math.round((c.wdth - REST.wdth) / 4) * 4;
        /* compared with what was last written: the browser hands the style
           back re-quoted, so comparing with it matched nothing and every
           letter was rewritten every frame */
        const settings = `'wght' ${wg}, 'wdth' ${wd}, 'ital' 0`;
        if (written[i] !== settings) {
          written[i] = settings;
          spans[i].style.fontVariationSettings = settings;
          if (settings !== restSettings) swollen = true;
        }
      }

      /* fully settled at rest — sleep until the next touch */
      if (!moving && engageTarget === 0) {
        engage = 0;
        awake = false;
        swollen = false;
        /* land exactly on the rest pose, not a unit off it */
        for (let i = 0; i < spans.length; i++) {
          cur[i].wght = REST.wght;
          cur[i].wdth = REST.wdth;
          if (written[i] !== restSettings) {
            written[i] = restSettings;
            spans[i].style.fontVariationSettings = restSettings;
          }
        }
      }
    };

    /* one sweep across the name after the intro: the affordance */
    const hint = () => {
      if (hintTween || engageTarget === 1) return;
      /* the reveal has just put every letter in place — read that layout */
      remeasure();
      const r = title.getBoundingClientRect();
      if (!r.width) return;
      const proxy = { x: r.left - r.width * 0.15 };
      finger.x = proxy.x;
      finger.y = r.y + r.height / 2;
      engageTarget = 1;
      wake();
      hintTween = gsap.to(proxy, {
        x: r.right + r.width * 0.15,
        duration: 1.8,
        ease: 'power1.inOut',
        onUpdate: () => {
          /* follow the word if the page scrolls, from the cached line */
          finger.x = proxy.x;
          finger.y = restMidY ? restMidY - window.scrollY : finger.y;
          wake();
        },
        onComplete: () => {
          hintTween = null;
          engageTarget = 0;
          wake();
        }
      });
    };

    gsap.ticker.add(tick);

    return {
      chars: spans,
      refresh() { setSize(); remeasure(); wake(); },
      setAlphaActive() {},
      hint,
      destroy() {
        gsap.ticker.remove(tick);
        hintTween?.kill();
        area.removeEventListener('touchstart', onStart);
        area.removeEventListener('touchmove', onMove);
        area.removeEventListener('touchend', onEnd);
        area.removeEventListener('touchcancel', onEnd);
        window.removeEventListener('resize', onResize);
        io.disconnect();
        container.innerHTML = '';
      }
    };
  }

  /* ============ POINTER ============ */
  const cursor = { x: 0, y: 0 };  // where the pointer actually is
  const mouse  = { x: 0, y: 0 };  // eased follower the letters read from

  {
    const { left, top, width: w, height: h } = container.getBoundingClientRect();
    mouse.x = cursor.x = left + w / 2;
    mouse.y = cursor.y = top + h / 2;
  }

  const lastSettings = spans.map(() => '');

  const onMouseMove = (e) => { cursor.x = e.clientX; cursor.y = e.clientY; wake(); };
  /* the letters' distances are in viewport space, so a scroll moves them */
  const onScroll = wake;
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('scroll', onScroll, { passive: true });

  const tick = () => {
    if (!awake || !onScreen) return;

    mouse.x += (cursor.x - mouse.x) / 15;
    mouse.y += (cursor.y - mouse.y) / 15;

    /* read */
    const titleRect = title.getBoundingClientRect();
    const maxDist = titleRect.width / 2;
    if (!maxDist) return;
    measure();
    /* x from the letter, y from the line: the reveal slides letters
       vertically, and that must not change the pose they land in */
    const midY = titleRect.y + titleRect.height / 2;

    /* write */
    let changed = false;
    for (let i = 0; i < spans.length; i++) {
      const span = spans[i];
      const d = dist(mouse, { x: centres[i], y: midY });

      const wdth    = width  ? Math.floor(getAttr(d, maxDist, 5, 200))   : 100;
      const wght    = weight ? Math.floor(getAttr(d, maxDist, 100, 900)) : 400;
      const italVal = italic ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 0;
      const alphaV  = alpha  ? getAttr(d, maxDist, 0, 1).toFixed(2)      : 1;

      /* compared with what was last written — the style reads back
         re-quoted, which made every frame look changed and kept this loop
         from ever sleeping */
      const settings = `'wght' ${wght}, 'wdth' ${wdth}, 'ital' ${italVal}`;
      if (lastSettings[i] !== settings) {
        lastSettings[i] = settings;
        span.style.fontVariationSettings = settings;
        changed = true;
      }
      if (alphaActive && span.style.opacity !== alphaV) {
        span.style.opacity = alphaV;
      }
    }

    /* the follower has caught the pointer and nothing changed — sleep
       until the pointer or the page moves again */
    const settled = Math.abs(cursor.x - mouse.x) < 0.1 && Math.abs(cursor.y - mouse.y) < 0.1;
    if (settled && !changed && !alphaActive) awake = false;
  };

  gsap.ticker.add(tick);

  return {
    chars: spans,
    refresh() { setSize(); wake(); },

    /* hand cursor-driven opacity over to the component */
    setAlphaActive(v) { alphaActive = alpha && v; wake(); },
    hint() {},
    destroy() {
      gsap.ticker.remove(tick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      io.disconnect();
      container.innerHTML = '';
    }
  };
}
