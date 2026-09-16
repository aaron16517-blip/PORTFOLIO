/* ============================================================
   clinicOS — motion layer
   Motion is always on. There is deliberately no reduced-motion
   kill switch here; the animation IS the product story.
   ============================================================ */
(() => {
'use strict';

const TAU  = Math.PI * 2;
const $    = (s, r = document) => r.querySelector(s);
const $$   = (s, r = document) => [...r.querySelectorAll(s)];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeOutExpo = t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

/* ============================================================
   0 · Brand

   Change the two values below and the whole page follows: the tab
   title, the meta description, both wordmarks, every mention in the
   copy, and the label on the case-study chart. Nothing else to edit.
   ============================================================ */
const BRAND = { lead: 'clinic', tail: 'OS' };
const BRAND_NAME = BRAND.lead + BRAND.tail;

(function rebrand() {
  document.title = BRAND_NAME + ' \u2014 AI infrastructure for the top 1% of clinics';
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute('content',
    BRAND_NAME + ' automates routine front-desk admin and eliminates lost ' +
    'appointments. AI reception built for dental clinics.');

  // the two wordmarks carry markup, so they are rebuilt rather than substituted
  $$('[data-brand]').forEach(el => {
    el.textContent = BRAND.lead;
    const b = document.createElement('b');
    b.textContent = BRAND.tail;
    el.appendChild(b);
  });

  if (BRAND_NAME === 'clinicOS') return;              // markup already matches

  // every remaining mention lives in a text node; rewrite before anything
  // else in this file touches the DOM
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const hits = [];
  while (walk.nextNode()) {
    if (walk.currentNode.nodeValue.indexOf('clinicOS') > -1) hits.push(walk.currentNode);
  }
  hits.forEach(n => { n.nodeValue = n.nodeValue.split('clinicOS').join(BRAND_NAME); });
})();

/* ============================================================
   1 · Split text into animatable words / chars
   ============================================================ */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  words.forEach((w, i) => {
    const span = document.createElement('span');
    span.className = 'w';
    const inner = document.createElement('i');
    inner.textContent = w;
    inner.style.transitionDelay = (i * 0.055) + 's';
    span.appendChild(inner);
    el.appendChild(span);
    if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
  });
}
$$('[data-split]').forEach(splitWords);

/* ============================================================
   2 · Reveal observer  (reveals, splits, counters, bigmark)

   Every entrance replays. One observer arms the animation when an
   element scrolls in; a second one, with a buffer around the viewport,
   disarms it only once it is properly off-screen — so the reset never
   happens where anyone can see it, and the next pass animates again.
   ============================================================ */

// strip the element back to its starting state without playing the
// transition backwards: kill durations, change the class, flush, restore
function rearm(els) {
  if (!els.length) return;
  els.forEach(el => el.classList.add('no-anim'));
  els.forEach(el => el.classList.remove('in'));
  void document.body.offsetHeight;                  // one flush for the batch
  els.forEach(el => el.classList.remove('no-anim'));
}

const ENTER = { threshold: 0.16, rootMargin: '0px 0px -8% 0px' };
const EXIT  = { threshold: 0,    rootMargin: '120px 0px 120px 0px' };

const revealIO = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) en.target.classList.add('in'); });
}, ENTER);

const revealOut = new IntersectionObserver((entries) => {
  rearm(entries.filter(en => !en.isIntersecting && en.target.classList.contains('in'))
               .map(en => en.target));
}, EXIT);

$$('[data-reveal], [data-split], [data-bigmark]').forEach(el => {
  revealIO.observe(el);
  revealOut.observe(el);
});

/* ---- number counters ---- */
function runCount(el) {
  if (el.__counting) return;                        // already at or heading to target
  el.__counting = true;
  const target = parseFloat(el.dataset.count);
  const suffix = el.dataset.suffix ?? '';
  const dur = 1500 + Math.min(target, 200) * 4;
  const t0 = performance.now();
  const tick = (now) => {
    if (!el.__counting) return;
    const p = clamp((now - t0) / dur, 0, 1);
    el.textContent = Math.round(easeOutExpo(p) * target) + suffix;
    if (p < 1) el.__raf = requestAnimationFrame(tick);
  };
  el.__raf = requestAnimationFrame(tick);
}
function resetCount(el) {
  if (!el.__counting) return;
  el.__counting = false;
  cancelAnimationFrame(el.__raf);
  el.textContent = '0' + (el.dataset.suffix ?? '');
}
const countIO = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (en.isIntersecting) runCount(en.target); });
}, { threshold: 0.5 });
const countOut = new IntersectionObserver((entries) => {
  entries.forEach(en => { if (!en.isIntersecting) resetCount(en.target); });
}, EXIT);
$$('[data-count]').forEach(el => { countIO.observe(el); countOut.observe(el); });

/* ============================================================
   3 · Preloader
   ============================================================ */
const pre = $('#pre'), preBar = $('#preBar'), prePct = $('#prePct');
const PRE_MS = 1250;                       // wall-clock, not frame-count
let preStart = 0, preDone = false;

function openCurtain() {
  if (preDone) return;
  preDone = true;
  preBar.style.transform = 'scaleX(1)';
  prePct.textContent = '100';
  setTimeout(() => {
    pre.classList.add('done');
    document.body.classList.remove('is-locked');
    // hero copy enters once the curtain lifts
    $$('.hero [data-reveal], .hero [data-split]').forEach(el => el.classList.add('in'));
  }, 240);
}
const loadTick = (now) => {
  if (preDone) return;
  if (!preStart) preStart = now;
  const p = clamp((now - preStart) / PRE_MS, 0, 1);
  const eased = easeOutExpo(p);
  preBar.style.transform = 'scaleX(' + eased + ')';
  prePct.textContent = String(Math.round(eased * 100)).padStart(2, '0');
  if (p < 1) requestAnimationFrame(loadTick); else openCurtain();
};
document.body.classList.add('is-locked');
requestAnimationFrame(loadTick);
setTimeout(openCurtain, PRE_MS + 900);      // safety net if rAF is throttled

/* ============================================================
   4 · Scroll progress + nav state + scrollspy
   ============================================================ */
const nav = $('#nav'), progress = $('#progress');
const sections = ['#product', '#apollo', '#programme', '#results']
  .map(id => ({ id, el: $(id) })).filter(s => s.el);
const navAnchors = $$('#navLinks a');

let ticking = false;
function onScroll() {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = 'scaleX(' + clamp(y / (max || 1), 0, 1) + ')';
  nav.classList.toggle('stuck', y > 40);

  // scrollspy
  let active = null;
  sections.forEach(s => {
    const r = s.el.getBoundingClientRect();
    if (r.top <= innerHeight * 0.45 && r.bottom >= innerHeight * 0.35) active = s.id;
  });
  navAnchors.forEach(a => a.classList.toggle('on', a.getAttribute('href') === active));

  parallaxFrame();
  ticking = false;
}
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
}, { passive: true });

/* nav hover pip */
const navPip = $('#navPip'), navLinks = $('#navLinks');
navAnchors.forEach(a => {
  a.addEventListener('pointerenter', () => {
    const r = a.getBoundingClientRect(), p = navLinks.getBoundingClientRect();
    navPip.style.width = r.width + 'px';
    navPip.style.transform = 'translateX(' + (r.left - p.left) + 'px)';
    navPip.style.opacity = '1';
  });
});
navLinks.addEventListener('pointerleave', () => { navPip.style.opacity = '0'; });

/* burger + sheet */
const burger = $('#burger'), sheet = $('#sheet');
burger.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  sheet.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.classList.toggle('is-locked', open);
});
$$('#sheet a').forEach(a => a.addEventListener('click', () => {
  nav.classList.remove('open'); sheet.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-locked');
}));

/* ============================================================
   5 · Pointer spotlight + magnetic buttons + card glow
   ============================================================ */
const spot = $('#spot');
let pxT = 50, pyT = 26, px = 50, py = 26;
addEventListener('pointermove', (e) => {
  pxT = (e.clientX / innerWidth) * 100;
  pyT = (e.clientY / innerHeight) * 100;
  mx = e.clientX; my = e.clientY;
}, { passive: true });

(function spotLoop() {
  px = lerp(px, pxT, 0.07); py = lerp(py, pyT, 0.07);
  spot.style.setProperty('--px', px + '%');
  spot.style.setProperty('--py', py + '%');
  requestAnimationFrame(spotLoop);
})();

let mx = innerWidth / 2, my = innerHeight / 2;

/* magnetic */
const magnets = $$('[data-magnet]').map(el => ({ el, x: 0, y: 0, tx: 0, ty: 0 }));
magnets.forEach(m => {
  m.el.addEventListener('pointermove', (e) => {
    const r = m.el.getBoundingClientRect();
    m.tx = (e.clientX - (r.left + r.width / 2)) * 0.32;
    m.ty = (e.clientY - (r.top + r.height / 2)) * 0.42;
    m.el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    m.el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
  });
  m.el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
});
(function magnetLoop() {
  magnets.forEach(m => {
    m.x = lerp(m.x, m.tx, 0.16); m.y = lerp(m.y, m.ty, 0.16);
    if (Math.abs(m.x) > 0.02 || Math.abs(m.y) > 0.02)
      m.el.style.transform = 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)';
    else m.el.style.transform = '';
  });
  requestAnimationFrame(magnetLoop);
})();

/* bento cell glow follows the pointer */
$$('.cell, .metric, .fcard, .prob').forEach(c => {
  c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--cx', ((e.clientX - r.left) / r.width * 100) + '%');
    c.style.setProperty('--cy', ((e.clientY - r.top) / r.height * 100) + '%');
  });
});

/* ============================================================
   6 · Parallax
   ============================================================ */
const paras = $$('[data-parallax]').map(el => ({ el, f: parseFloat(el.dataset.parallax) }));
function parallaxFrame() {
  const vh = innerHeight;
  paras.forEach(p => {
    const r = p.el.getBoundingClientRect();
    if (r.bottom < -200 || r.top > vh + 200) return;
    const d = (r.top + r.height / 2 - vh / 2);
    p.el.style.transform = 'translate3d(0,' + (-d * p.f).toFixed(2) + 'px,0)';
  });
}

/* ============================================================
   7 · Logo marquee
   ============================================================ */
const LOGOS = [
  ['Bloomdale', 'M3 11 8 3l5 8-5 3Z'],
  ['Aurelis Clinics', 'M8 2.5 13.5 13H2.5Z'],
  ['NordLabs', 'M2.5 13V3h3l5 7V3h3v10h-3l-5-7v7Z'],
  ['Apolonia', 'M8 2.5c3 2.5 4.5 5 4.5 7A4.5 4.5 0 0 1 3.5 9.5c0-2 1.5-4.5 4.5-7Z'],
  ['Dentimed Group', 'M2.6 8a5.4 5.4 0 1 1 10.8 0 5.4 5.4 0 0 1-10.8 0Zm3 0a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 0 0-4.8 0Z'],
  ['Serene Health', 'M8 13.5 3 8.6A3.1 3.1 0 0 1 8 4.9a3.1 3.1 0 0 1 5 3.7Z'],
  ['Vantera', 'M2.5 3h3l2.5 7L10.5 3h3l-4 10h-3Z']
];
const track = $('#marqTrack');
const buildLogos = () => LOGOS.map(([name, d]) =>
  '<span class="marq__item"><svg width="16" height="16" viewBox="0 0 16 16" fill="none">' +
  '<path d="' + d + '" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>' + name + '</span>'
).join('');
track.innerHTML = buildLogos() + buildLogos() + buildLogos() + buildLogos();

/* ============================================================
   8 · How-it-works stepper
   ============================================================ */
const steps = $$('.step');
const panes = $$('.pane');
let stepIdx = 0, stepTimer = null, stepPaused = false;

function setStep(i) {
  stepIdx = i % steps.length;
  steps.forEach((s, k) => s.classList.toggle('on', k === stepIdx));
  panes.forEach((p, k) => p.classList.toggle('on', k === stepIdx));
  if (stepIdx === 2) animateCal();
}
function stepLoop() {
  clearTimeout(stepTimer);
  stepTimer = setTimeout(() => { if (!stepPaused) setStep(stepIdx + 1); stepLoop(); }, 4600);
}
steps.forEach((s, i) => {
  s.addEventListener('click', () => { setStep(i); stepLoop(); });
  s.addEventListener('pointerenter', () => { stepPaused = true; });
  s.addEventListener('pointerleave', () => { stepPaused = false; });
});

/* calendar */
const calGrid = $('#calGrid');
const BOOKED = new Set([3, 4, 5, 9, 10, 11, 12, 16, 17, 18, 19, 23, 24, 25, 30, 31, 32]);
if (calGrid) {
  let html = '';
  for (let i = 0; i < 35; i++) {
    const day = i - 1;
    const cls = day < 1 ? 'n' : (BOOKED.has(i) ? 'b' : '');
    html += '<span class="' + cls + '">' + (day < 1 ? '' : day) + '</span>';
  }
  calGrid.innerHTML = html;
}
function animateCal() {
  if (!calGrid) return;
  $$('span', calGrid).forEach((c, i) => {
    c.style.transform = 'scale(.7)';
    c.style.opacity = '0';
    setTimeout(() => { c.style.transform = ''; c.style.opacity = ''; }, 18 * i);
  });
}

/* the stepper runs while the section is on screen, and starts over
   from step one each time you come back to it */
const stepsWrap = $('#steps');
if (stepsWrap) {
  let stepsLive = false;
  new IntersectionObserver((e) => {
    if (!e[0].isIntersecting || stepsLive) return;
    stepsLive = true;
    setStep(0);
    stepLoop();
  }, { threshold: 0.25 }).observe(stepsWrap);

  new IntersectionObserver((e) => {
    if (e[0].isIntersecting || !stepsLive) return;
    stepsLive = false;
    clearTimeout(stepTimer);
    setStep(0);
  }, EXIT).observe(stepsWrap);
}

/* ============================================================
   9 · Problem cards — click to reveal the fix
   ============================================================ */
$$('[data-prob]').forEach(card => {
  const go = $('.prob__go', card);
  const toggle = () => {
    const wasOpen = card.classList.contains('open');
    $$('[data-prob]').forEach(c => c.classList.remove('open'));
    card.classList.toggle('open', !wasOpen);
  };
  go.addEventListener('click', toggle);
  card.addEventListener('click', (e) => { if (e.target !== go && !go.contains(e.target)) toggle(); });
});

/* ============================================================
   10 · Comparison toggle
   ============================================================ */
const seg = $('#seg'), segPip = $('#segPip'), compare = $('#compare');
if (seg) {
  const btns = $$('button', seg);
  function movePip(btn) {
    segPip.style.width = btn.offsetWidth + 'px';
    segPip.style.transform = 'translateX(' + (btn.offsetLeft - 4) + 'px)';
  }
  function applyMode(mode) {
    compare.classList.toggle('on', mode === 'on');
    compare.classList.toggle('off', mode === 'off');
    $$('.metric__v', compare).forEach(v => {
      const target = parseFloat(v.dataset[mode]);
      const suffix = v.dataset.suffix ?? '';
      const from = parseFloat(v.textContent) || 0;
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / 800, 0, 1);
        v.textContent = Math.round(lerp(from, target, easeOutExpo(p))) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    $$('.metric__bar i', compare).forEach(b => { b.style.width = b.dataset[mode] + '%'; });
  }
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.toggle('on', x === b));
    movePip(b);
    applyMode(b.dataset.seg);
  }));
  function zeroMetrics() {
    $$('.metric__v', compare).forEach(v => { v.textContent = '0' + (v.dataset.suffix ?? ''); });
    $$('.metric__bar i', compare).forEach(b => {
      b.style.transition = 'none';
      b.style.width = '0%';
      void b.offsetWidth;
      b.style.transition = '';
    });
  }

  const initSeg = () => movePip(btns[0]);
  requestAnimationFrame(initSeg);
  addEventListener('resize', () => movePip($('button.on', seg)));

  let cmpLive = false;
  new IntersectionObserver((e) => {
    if (!e[0].isIntersecting || cmpLive) return;
    cmpLive = true;
    applyMode(($('button.on', seg) || btns[0]).dataset.seg);
  }, { threshold: 0.4 }).observe(compare);

  new IntersectionObserver((e) => {
    if (e[0].isIntersecting || !cmpLive) return;
    cmpLive = false;
    zeroMetrics();                                  // armed for the next pass
  }, EXIT).observe(compare);
}

/* ============================================================
   11 · Apollo orbit nodes + circuit fan
   ============================================================ */
const nodes = $('#apolloNodes');
if (nodes) {
  let s = '';
  const orbits = [[130, 22, 0], [162, 31, -0.4], [196, 40, 0.8]];
  orbits.forEach(([r, dur, ph], i) => {
    s += '<g class="orbit" style="animation-duration:' + dur + 's;animation-delay:' + (ph * dur) + 's">' +
         '<circle cx="' + (180 + r) + '" cy="200" r="' + (3.4 - i * 0.6) + '" fill="#ffcaa8" opacity="' + (0.9 - i * 0.2) + '"/>' +
         '<circle cx="' + (180 - r) + '" cy="200" r="' + (2.6 - i * 0.4) + '" fill="#d06a48" opacity="' + (0.7 - i * 0.15) + '"/>' +
         '</g>';
    s += '<ellipse cx="180" cy="200" rx="' + r + '" ry="' + (r * 0.42) + '" stroke="#ffb085" stroke-opacity="' + (0.11 - i * 0.02) + '" stroke-width="1" fill="none"/>';
  });
  nodes.innerHTML = s;
}

const fan = $('#fanLines');
if (fan) {
  let s = '';
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    const r0 = 32, r1 = 32 + 14 + Math.abs(Math.sin(i * 1.7)) * 20;
    s += '<line x1="' + (280 + Math.cos(a) * r0).toFixed(1) + '" y1="' + (150 + Math.sin(a) * r0).toFixed(1) +
         '" x2="' + (280 + Math.cos(a) * r1).toFixed(1) + '" y2="' + (150 + Math.sin(a) * r1).toFixed(1) +
         '" style="animation:fanPulse 2.6s ' + (i * 0.07).toFixed(2) + 's ease-in-out infinite"/>';
  }
  fan.innerHTML = s;
}

/* ============================================================
   12 · HERO — silk field + torus  (2D canvas)
   ============================================================ */
const silk = $('#silk');
if (silk) {
  const ctx = silk.getContext('2d', { alpha: true });
  const fx = document.createElement('canvas');
  const fxc = fx.getContext('2d');

  const LINES = 84, SEG = 104;
  const buf = new Float32Array(LINES * SEG * 2);

  let W = 0, H = 0, DPR = 1, running = true;
  let ox = 0, oy = 0;            // eased pointer offset for the orb
  let orbY = 0, orbR = 40;       // measured from the reserved layout gap
  const orbSlot = $('.hero__orbspace');

  function size() {
    const r = silk.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { W = H = 0; return; }   // laid out yet?
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(r.width);
    H = Math.round(r.height);
    [silk, fx].forEach(c => { c.width = W * DPR; c.height = H * DPR; });
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fxc.setTransform(DPR, 0, 0, DPR, 0, 0);

    // the torus lives inside the gap the layout reserves for it, so it can
    // never sit on top of the sub-headline at any viewport size
    if (orbSlot) {
      const sr = orbSlot.getBoundingClientRect();
      orbY = (sr.top - r.top) + sr.height * 0.5;
      orbR = Math.min(sr.height * 0.40, W * 0.085);
    } else {
      orbY = H * 0.6; orbR = Math.min(W, H) * 0.085;
    }
  }
  size();
  addEventListener('resize', size);
  if (window.ResizeObserver) new ResizeObserver(size).observe(silk);

  new IntersectionObserver(e => { running = e[0].isIntersecting; }, { threshold: 0 }).observe(silk);

  function strokeField(c, color, width) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    for (let i = 0; i < LINES; i++) {
      const base = i * SEG * 2;
      c.moveTo(buf[base], buf[base + 1]);
      for (let s = 1; s < SEG; s++) {
        c.lineTo(buf[base + s * 2], buf[base + s * 2 + 1]);
      }
    }
    c.stroke();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!running) return;
    if (!W || !H) { size(); return; }

    const t = now * 0.001;

    // orb follows the pointer, gently
    const tx = ((mx / innerWidth) - 0.5) * W * 0.05;
    const ty = ((my / innerHeight) - 0.5) * H * 0.05;
    ox = lerp(ox, tx, 0.035);
    oy = lerp(oy, ty, 0.035);

    const cx = W * 0.5 + ox;
    const cy = orbY + oy;
    const R  = orbR * (1 + Math.sin(t * 0.7) * 0.02);
    const SW = Math.max(R * 3.6, Math.min(W, H) * 0.30);   // drape reach
    const SQUASH = 1.22;                    // wider than tall -> drape, not rings
    const inv2SW2 = 1 / (2 * SW * SW);

    /* --- build the point buffer --- */
    for (let i = 0; i < LINES; i++) {
      const p  = i / (LINES - 1);
      const q  = p - 0.5;
      const y0 = cy + Math.sign(q) * Math.pow(Math.abs(q) * 2, 1.42) * H * 0.92;
      const amp = 24 + 52 * (1 - Math.abs(q) * 2);
      const base = i * SEG * 2;

      for (let s = 0; s < SEG; s++) {
        const u = s / (SEG - 1);
        let x = -0.3 * W + u * 1.6 * W;
        let y = y0
              + Math.sin(u * 4.1 + t * 0.26 + p * 5.6) * amp
              + Math.sin(u * 9.3 - t * 0.41 + p * 11.4) * 10
              + Math.sin(u * 2.0 + t * 0.16 + p * 2.2) * 17;

        const dx = x - cx, dy = (y - cy) * SQUASH;
        const d  = Math.sqrt(dx * dx + dy * dy);
        const g  = Math.exp(-(d * d) * inv2SW2);
        const th = Math.atan2(dy, dx);
        const dir = 0.5 + 0.5 * Math.cos(th - 0.62 + Math.sin(t * 0.13) * 0.25);
        const ang = th + g * (1.25 + 1.15 * dir) + t * 0.05;
        const rr  = d * (1 + g * (0.38 + 0.34 * dir)) + g * R * 0.46;

        buf[base + s * 2]     = cx + Math.cos(ang) * rr;
        buf[base + s * 2 + 1] = cy + Math.sin(ang) * rr / SQUASH;
      }
    }

    /* --- pass A: the whole field, faint --- */
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineJoin = 'round';
    strokeField(ctx, 'rgba(112,136,112,0.21)', 0.8);

    /* --- pass B: the same field, bright, masked to the orb halo --- */
    fxc.setTransform(DPR, 0, 0, DPR, 0, 0);
    fxc.clearRect(0, 0, W, H);
    fxc.globalCompositeOperation = 'source-over';
    fxc.lineJoin = 'round';
    strokeField(fxc, 'rgba(22,44,30,0.50)', 1);

    fxc.globalCompositeOperation = 'destination-in';
    const mask = fxc.createRadialGradient(cx, cy, R * 0.4, cx, cy, R * 4.6);
    mask.addColorStop(0,   'rgba(0,0,0,1)');
    mask.addColorStop(0.40,'rgba(0,0,0,0.5)');
    mask.addColorStop(1,   'rgba(0,0,0,0)');
    fxc.fillStyle = mask;
    fxc.fillRect(0, 0, W, H);

    ctx.drawImage(fx, 0, 0, W, H);

    /* --- the torus: a ceramic ring on paper, so it casts instead of glows --- */
    ctx.globalCompositeOperation = 'source-over';

    // contact shadow
    const sh = ctx.createRadialGradient(cx, cy + R * 0.30, R * 0.2, cx, cy + R * 0.30, R * 2.1);
    sh.addColorStop(0,    'rgba(22,36,26,0.15)');
    sh.addColorStop(0.45, 'rgba(22,36,26,0.06)');
    sh.addColorStop(1,    'rgba(22,36,26,0)');
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(cx, cy + R * 0.30, R * 2.1, 0, TAU); ctx.fill();

    // the ring body — a conic run of glazes gives it form
    ctx.lineWidth = R * 0.23;
    let ring;
    if (ctx.createConicGradient) {
      ring = ctx.createConicGradient(t * 0.42, cx, cy);
      ring.addColorStop(0.00, '#1c4030');
      ring.addColorStop(0.12, '#2e6b4b');
      ring.addColorStop(0.26, '#5f9377');
      ring.addColorStop(0.38, '#b9cfbe');
      ring.addColorStop(0.50, '#c98462');
      ring.addColorStop(0.62, '#b0543a');
      ring.addColorStop(0.76, '#7d3d29');
      ring.addColorStop(0.88, '#25523a');
      ring.addColorStop(1.00, '#1c4030');
    } else {
      ring = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
      ring.addColorStop(0, '#b9cfbe');
      ring.addColorStop(1, '#1c4030');
    }
    ctx.strokeStyle = ring;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();

    // specular sweep along the outer edge
    ctx.lineWidth = Math.max(1, R * 0.045);
    const a0 = t * 0.85;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.085, a0, a0 + 1.35); ctx.stroke();
    ctx.strokeStyle = 'rgba(22,36,26,0.16)';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.905, a0 + 2.5, a0 + 4.3); ctx.stroke();

    // the hole is the page showing through, with the ring shading its inner wall
    ctx.fillStyle = '#fcfcfa';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.885, 0, TAU); ctx.fill();
    const inner = ctx.createRadialGradient(cx, cy, R * 0.42, cx, cy, R * 0.9);
    inner.addColorStop(0,    'rgba(22,36,26,0)');
    inner.addColorStop(0.72, 'rgba(22,36,26,0.05)');
    inner.addColorStop(1,    'rgba(22,36,26,0.22)');
    ctx.fillStyle = inner;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, TAU); ctx.fill();

    ctx.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   13 · Programme — glowing arch
   ============================================================ */
const arch = $('#arch');
if (arch) {
  const c = arch.getContext('2d');
  let W = 0, H = 0, DPR = 1, live = true;

  function size() {
    const r = arch.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { W = H = 0; return; }
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(r.width);
    H = Math.round(r.height);
    arch.width = W * DPR; arch.height = H * DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  addEventListener('resize', size);
  if (window.ResizeObserver) new ResizeObserver(size).observe(arch);
  new IntersectionObserver(e => { live = e[0].isIntersecting; }, { threshold: 0 }).observe(arch);

  const RIBS = 108;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!live) return;
    if (!W || !H) { size(); return; }
    const t = now * 0.001;

    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);
    c.globalCompositeOperation = 'source-over';

    const cx = W * 0.5, cy = H * 1.02;
    const RMAX = Math.min(W * 0.46, H * 0.92);

    // dome bloom
    const gl = c.createRadialGradient(cx, cy, 0, cx, cy, RMAX * 1.15);
    gl.addColorStop(0,   'rgba(46,107,75,0.10)');
    gl.addColorStop(0.4, 'rgba(46,107,75,0.045)');
    gl.addColorStop(1,   'rgba(46,107,75,0)');
    c.fillStyle = gl;
    c.beginPath(); c.arc(cx, cy, RMAX * 1.15, 0, TAU); c.fill();

    // radial ribs
    c.lineWidth = 1;
    for (let i = 0; i < RIBS; i++) {
      const p = i / (RIBS - 1);
      const a = Math.PI + p * Math.PI;                       // upper half
      const wob = Math.sin(p * 16 + t * 0.9) * 0.03 + Math.sin(p * 5 - t * 0.5) * 0.02;
      const r1 = RMAX * (0.42 + 0.58 * (0.5 + 0.5 * Math.sin(p * 9 + t * 0.75)));
      const alpha = 0.04 + 0.20 * Math.pow(Math.sin(p * Math.PI), 1.6) * (0.55 + 0.45 * Math.sin(p * 21 - t * 1.4));
      c.strokeStyle = 'rgba(46,107,75,' + Math.max(0, alpha).toFixed(3) + ')';
      c.beginPath();
      c.moveTo(cx + Math.cos(a + wob) * RMAX * 0.16, cy + Math.sin(a + wob) * RMAX * 0.16);
      c.lineTo(cx + Math.cos(a + wob) * r1, cy + Math.sin(a + wob) * r1);
      c.stroke();
    }

    // arc bands
    for (let k = 0; k < 5; k++) {
      const rr = Math.max(1, RMAX * (0.34 + k * 0.16) + Math.sin(t * 0.6 + k) * 6);
      c.strokeStyle = 'rgba(46,107,75,' + (0.11 - k * 0.016).toFixed(3) + ')';
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, rr, Math.PI, TAU); c.stroke();
    }
    c.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   14 · Apollo — the mind (rotating node sphere, canvas)
   ============================================================ */
const mind = $('#mind');
if (mind) {
  const c = mind.getContext('2d');
  let W = 0, H = 0, DPR = 1, live = true;

  // fibonacci sphere
  const N = 210, P = new Float32Array(N * 3);
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * GA;
    P[i * 3] = Math.cos(th) * r; P[i * 3 + 1] = y; P[i * 3 + 2] = Math.sin(th) * r;
  }
  // short-range edges only, so it reads as a mesh and not a hairball
  const E = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = P[i*3]-P[j*3], dy = P[i*3+1]-P[j*3+1], dz = P[i*3+2]-P[j*3+2];
      if (dx*dx + dy*dy + dz*dz < 0.075) E.push(i, j);
    }
  }
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);

  function size() {
    const r = mind.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { W = H = 0; return; }
    DPR = Math.min(devicePixelRatio || 1, 2);
    W = Math.round(r.width); H = Math.round(r.height);
    mind.width = W * DPR; mind.height = H * DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  size();
  addEventListener('resize', size);
  if (window.ResizeObserver) new ResizeObserver(size).observe(mind);
  new IntersectionObserver(e => { live = e[0].isIntersecting; }, { threshold: 0 }).observe(mind);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!live) return;
    if (!W || !H) { size(); return; }

    const t = now * 0.001;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);

    const cx = W * 0.5, cy = H * 0.5;
    const R  = Math.min(W, H) * 0.34;
    const ay = t * 0.22;                                  // yaw
    const ax = -0.32 + Math.sin(t * 0.31) * 0.1;          // gentle nod
    const ca = Math.cos(ay), sa = Math.sin(ay);
    const cb = Math.cos(ax), sb = Math.sin(ax);

    for (let i = 0; i < N; i++) {
      const x0 = P[i*3], y0 = P[i*3+1], z0 = P[i*3+2];
      const x1 =  x0 * ca + z0 * sa;
      const z1 = -x0 * sa + z0 * ca;
      const y2 =  y0 * cb - z1 * sb;
      const z2 =  y0 * sb + z1 * cb;
      const persp = 2.6 / (2.6 - z2);                     // mild perspective
      px[i] = cx + x1 * R * persp;
      py[i] = cy + y2 * R * persp;
      pz[i] = z2;
    }

    // a signal band sweeping back-to-front, like a thought crossing the mesh
    const phase = ((t * 0.34) % 1) * 2 - 1;

    c.globalCompositeOperation = 'source-over';

    // edges
    c.lineWidth = 1;
    for (let k = 0; k < E.length; k += 2) {
      const i = E[k], j = E[k + 1];
      const zm = (pz[i] + pz[j]) * 0.5;
      const depth = (zm + 1) * 0.5;                       // 0 back .. 1 front
      const dz = zm - phase;
      const pulse = Math.exp(-(dz * dz) / 0.012);
      const a = 0.06 + depth * 0.20 + pulse * 0.55;
      c.strokeStyle = 'rgba(' + Math.round(46 + pulse * 130) + ',' +
                                Math.round(107 - pulse * 23) + ',' +
                                Math.round(75 - pulse * 17) + ',' + a.toFixed(3) + ')';
      c.beginPath(); c.moveTo(px[i], py[i]); c.lineTo(px[j], py[j]); c.stroke();
    }

    // nodes
    for (let i = 0; i < N; i++) {
      const depth = (pz[i] + 1) * 0.5;
      const dz = pz[i] - phase;
      const pulse = Math.exp(-(dz * dz) / 0.012);
      const rad = 0.7 + depth * 1.5 + pulse * 1.7;
      c.fillStyle = 'rgba(' + Math.round(38 + pulse * 138) + ',' +
                    Math.round(88 + pulse * -4) + ',' +
                    Math.round(62 + pulse * -4) + ',' +
                    (0.20 + depth * 0.45 + pulse * 0.35).toFixed(3) + ')';
      c.beginPath(); c.arc(px[i], py[i], rad, 0, TAU); c.fill();
    }

    // core
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.85);
    core.addColorStop(0,   'rgba(46,107,75,0.14)');
    core.addColorStop(0.5, 'rgba(46,107,75,0.055)');
    core.addColorStop(1,   'rgba(46,107,75,0)');
    c.fillStyle = core;
    c.beginPath(); c.arc(cx, cy, R * 0.85, 0, TAU); c.fill();

    // two lazy orbit rings
    for (let k = 0; k < 2; k++) {
      const tilt = 0.34 + k * 0.5;
      const rr = R * (1.24 + k * 0.24);
      c.strokeStyle = 'rgba(46,107,75,' + (0.20 - k * 0.07) + ')';
      c.lineWidth = 1;
      c.save();
      c.translate(cx, cy);
      c.rotate(Math.sin(t * (0.12 + k * 0.05)) * 0.5 + k * 0.7);
      c.beginPath(); c.ellipse(0, 0, rr, rr * tilt, 0, 0, TAU); c.stroke();
      c.restore();
    }

    c.globalCompositeOperation = 'source-over';
  }
  requestAnimationFrame(frame);
}

/* ============================================================
   15 · Case study — the revenue report, drawn on reveal
   ============================================================ */
const growth = $('#growth');
if (growth) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const DATA   = [41, 44, 42, 47, 45, 49, 58, 67, 72, 79, 85, 93];
  const GO_LIVE = 6;                                 // clinicOS goes live in July

  // catmull-rom -> cubic bezier, so the curve stays smooth without overshoot
  function curve(pts) {
    let d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ',' +
                 c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ',' +
                 p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  // the SVG scales to its box, so label sizes must be chosen per breakpoint or
  // they end up 5px tall on a phone
  function build() {
    const narrow = innerWidth < 760;
    const VW = narrow ? 660 : 1200, VH = narrow ? 620 : 630;
    const L  = narrow ? 74 : 96,  RR = VW - (narrow ? 32 : 72);
    const T  = narrow ? 132 : 108, B = narrow ? 470 : 508;
    const FS = narrow ? 24 : 16, FT = narrow ? 30 : 26, FSUB = narrow ? 22 : 17;

    const xAt = i => L + (RR - L) * (i / (DATA.length - 1));
    const yAt = v => B - (B - T) * (v / 100);

    const pts  = DATA.map((v, i) => [xAt(i), yAt(v)]);
    const line = curve(pts);
    const area = line + 'L' + xAt(DATA.length - 1).toFixed(1) + ' ' + B + 'L' + L + ' ' + B + 'Z';

    let g = '';
    g += '<defs>' +
         '<linearGradient id="grArea" x1="0" y1="' + T + '" x2="0" y2="' + B + '" gradientUnits="userSpaceOnUse">' +
           '<stop offset="0" stop-color="#2e6b4b" stop-opacity=".28"/>' +
           '<stop offset="1" stop-color="#2e6b4b" stop-opacity="0"/></linearGradient>' +
         '<linearGradient id="grLine" x1="' + L + '" y1="0" x2="' + RR + '" y2="0" gradientUnits="userSpaceOnUse">' +
           '<stop offset="0" stop-color="#9db39a"/><stop offset=".48" stop-color="#2e6b4b"/>' +
           '<stop offset="1" stop-color="#b0543a"/></linearGradient>' +
         '</defs>';

    g += '<text x="' + L + '" y="' + (narrow ? 52 : 56) + '" fill="#16241a" font-size="' + FT +
         '" font-weight="500" font-family="Inter Tight, sans-serif">Monthly revenue</text>';
    g += '<text x="' + L + '" y="' + (narrow ? 84 : 82) + '" fill="#62775f" font-size="' + FSUB +
         '" font-family="Inter Tight, sans-serif">Apolonia Dental · PLN · 12 months to Dec 2025</text>';

    for (let k = 0; k <= 4; k++) {
      const y = T + (B - T) * (k / 4);
      g += '<line class="gGrid" x1="' + L + '" y1="' + y + '" x2="' + RR + '" y2="' + y +
           '" stroke="#16241a" stroke-opacity=".10" stroke-width="1" style="--gd:' + (k * 0.07) + 's"/>';
      g += '<text class="gLbl" x="' + (L - 14) + '" y="' + (y + FS * 0.36) + '" text-anchor="end" ' +
           'fill="#62775f" font-size="' + FS + '" font-family="Inter Tight, sans-serif">' +
           (100 - k * 25) + 'k</text>';
    }

    MONTHS.forEach((m, i) => {
      // thin the axis on phones, and never let Nov crowd Dec
      if (narrow && (i % 2 === 1 || i === DATA.length - 2) && i !== DATA.length - 1) return;
      g += '<text class="gLbl" x="' + xAt(i).toFixed(1) + '" y="' + (B + FS * 2.3) +
           '" text-anchor="middle" fill="' + (i >= GO_LIVE ? '#16241a' : '#62775f') +
           '" font-size="' + FS + '" font-family="Inter Tight, sans-serif" style="--gd:' +
           (0.5 + i * 0.04) + 's">' + m + '</text>';
    });

    g += '<line class="gLive" x1="' + xAt(GO_LIVE).toFixed(1) + '" y1="' + (T - 18) + '" x2="' +
         xAt(GO_LIVE).toFixed(1) + '" y2="' + B + '" stroke="#b0543a" stroke-opacity=".45" ' +
         'stroke-width="1" stroke-dasharray="5 6"/>';
    g += '<text class="gLbl" x="' + (narrow ? xAt(GO_LIVE) : xAt(GO_LIVE) + 14).toFixed(1) + '" y="' +
         (T - 24) + '" text-anchor="' + (narrow ? 'middle' : 'start') + '" fill="#b0543a" font-size="' +
         (narrow ? 22 : 17) + '" font-family="Inter Tight, sans-serif" style="--gd:1.15s">' +
         'clinicOS goes live</text>';

    g += '<path class="gArea" d="' + area + '" fill="url(#grArea)"/>';
    g += '<path class="gLine" d="' + line + '" fill="none" stroke="url(#grLine)" stroke-width="' +
         (narrow ? 4 : 3) + '" stroke-linecap="round" stroke-linejoin="round"/>';

    DATA.forEach((v, i) => {
      const r = i === DATA.length - 1 ? (narrow ? 9 : 7) : (narrow ? 5 : 4);
      g += '<circle class="gDot" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(v).toFixed(1) + '" r="' + r +
           '" fill="' + (i === DATA.length - 1 ? '#b0543a' : i >= GO_LIVE ? '#2e6b4b' : '#b3c4af') +
           '" style="--gd:' + (0.9 + i * 0.06) + 's"/>';
    });
    g += '<circle class="gPing" cx="' + xAt(DATA.length - 1).toFixed(1) + '" cy="' +
         yAt(DATA[DATA.length - 1]).toFixed(1) + '" r="' + (narrow ? 9 : 7) +
         '" fill="none" stroke="#b0543a" stroke-width="1.5"/>';

    growth.setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
    growth.innerHTML = g;
    return narrow;
  }

  let wasNarrow = build();
  addEventListener('resize', () => {
    const narrow = innerWidth < 760;
    if (narrow === wasNarrow) return;
    wasNarrow = narrow;
    const drawn = growth.classList.contains('drawn');
    build();
    if (drawn) requestAnimationFrame(() => growth.classList.add('drawn'));
  });

  let chartLive = false;
  new IntersectionObserver((e) => {
    if (!e[0].isIntersecting || chartLive) return;
    chartLive = true;
    growth.classList.add('drawn');
  }, { threshold: 0.25 }).observe(growth);

  new IntersectionObserver((e) => {
    if (e[0].isIntersecting || !chartLive) return;
    chartLive = false;
    growth.classList.add('no-anim');
    growth.classList.remove('drawn');               // snap back, don't rewind
    void document.body.offsetHeight;
    growth.classList.remove('no-anim');
  }, EXIT).observe(growth);
}

/* first paint */
onScroll();
})();
