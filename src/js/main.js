import '../styles/base.css';
import '../styles/preloader.css';
import '../styles/eden.css';
import '../styles/hero.css';
import '../styles/ghostCursor.css';
import '../styles/menu.css';
import '../styles/projects.css';
import '../styles/experience.css';
import '../styles/practice.css';
import '../styles/process.css';
import '../styles/contact.css';
import '../styles/footer.css';
import 'lenis/dist/lenis.css';

import gsap from 'gsap';
import Lenis from 'lenis';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { inject } from '@vercel/analytics';

import { initPreloader } from './preloader.js';
import { prepareHero, revealHero, igniteSmoke, setSmokeRise } from './hero.js';
import { initMenu } from './menu.js';
import { isTouch } from './device.js';
import { initEden } from './eden.js';
import { initProjects } from './projects.js';
import { initExperience } from './experience.js';
import { initPractice } from './practice.js';
import { initProcess } from './process.js';
import { initContact } from './contact.js';

/* ---------- analytics ----------
   Vercel Web Analytics: page views, referrers, countries, devices — no
   cookies. The script is served by Vercel itself once Analytics is enabled
   on the project, so it is only injected on the deployed site. */
if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
  inject({ mode: 'production' });
}

/* ---------- smooth scroll, driven by GSAP's ticker ---------- */
const lenis = new Lenis({
  duration: 1.1,
  smoothWheel: true,
  touchMultiplier: 1.6,
  /* Lenis otherwise turns every scripted scroll into a jump when the
     browser reports reduced motion, and the Eden dive is one */
  respectReducedMotion: false
});

gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ScrollTrigger reads Lenis's scroll, not the native one */
gsap.registerPlugin(ScrollTrigger);
lenis.on('scroll', ScrollTrigger.update);

/* A phone's address bar showing and hiding is a resize. Without this every
   one of those remeasures every trigger mid-scroll, which is the stutter. */
ScrollTrigger.config({ ignoreMobileResize: true });

/* no scrolling while the counter runs. The intro always starts at the top:
   without 'manual' a refresh restores the old position after this scrollTo,
   and the hero plays out of sight. */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
lenis.stop();
window.scrollTo(0, 0);

/* ---------- boot ---------- */
prepareHero();

/* the pointer smear over the hero smoke. Its own loop stops itself once the
   trail has faded, so it costs nothing while the page sits idle.

   Touch screens have no pointer to follow, so they never download it —
   it is the only thing that pulls in three.js, most of the bundle. */
if (!isTouch) initGhostCursor();

async function initGhostCursor() {
  const { createGhostCursor } = await import('./ghostCursor.js');
  createGhostCursor(document.getElementById('ghostCursor'), {
    /* The hero is light now, so a 'screen' trail (which only adds light)
       would vanish into it. The trail multiplies instead: it can only
       deepen what is behind it, like breath fogging ice. `color` still
       drives how much smoke there is (white = full coverage); `tint` is the
       colour that coverage is painted in. */
    color: '#ffffff',
    tint: '#a3d6ca',
    mixBlendMode: 'multiply',
    brightness: 0.22,
    radius: 0.5,
    edgeIntensity: 0,
    trailLength: 50,
    inertia: 0.5,
    grainIntensity: 0.05,
    bloomStrength: 0.08,
    bloomRadius: 0.8,
    bloomThreshold: 0.08,
    fadeDelayMs: 1000,
    fadeDurationMs: 1500
    /* heroInk.js (light type turning black under the trail) is not wired in:
       the hero type is already dark, and a multiplied trail only darkens
       the ground behind it, so the type stays readable on its own */
  });
}

/* the opening scene, drawn under the countdown from the start */
const eden = initEden({ lenis });

initProjects();
initExperience();
initPractice();
initProcess();
initContact();

/* the menu owns the scroll lock while it is open */
initMenu({
  onOpen:  () => lenis.stop(),
  onClose: () => lenis.start()
});

initPreloader({
  onReveal: () => {
    document.body.classList.remove('is-loading');
    lenis.start();
    eden.reveal();
    /* the curtain changed the layout height — remeasure the triggers */
    ScrollTrigger.refresh();

    /* DIVE IN stays out of the opening: the ice and Eden are a scene, not a
       page yet. It arrives with the hero and leaves again if the visitor
       scrolls back into Eden. autoAlpha also takes it out of the tab order. */
    const toggle = document.getElementById('menuToggle');
    const showToggle = (on) => gsap.to(toggle, {
      autoAlpha: on ? 1 : 0,
      y: on ? 0 : -12,
      duration: on ? 0.9 : 0.4,
      ease: on ? 'power3.out' : 'power2.in',
      overwrite: true
    });
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top 40%',
      onEnter: () => showToggle(true),
      onLeaveBack: () => showToggle(false)
    });

    /* The hero slides up over the last screen of Eden's dive (hero.css
       pulls it up by a viewport). Over that scroll its smoke rises from the
       bottom and swallows the light; by the time it reaches the top it is
       the solid hero again. */
    setSmokeRise(0);
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top bottom',
      end: 'top top',
      onEnter: () => igniteSmoke(),
      onUpdate: (self) => setSmokeRise(self.progress)
    });

    /* The Michael hero now follows the Eden scene, so its intro plays when
       the dive into the light lands on it, not when the countdown ends. */
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top 45%',
      once: true,
      onEnter: () => revealHero()
    });
  }
});

/* the Eden hold lifts the wall at the end of the page — remeasure */
window.addEventListener('eden:connect', () => ScrollTrigger.refresh());

/* ---------- in-page anchors go through Lenis, not the native jump ---------- */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;

  const hash = link.getAttribute('href');

  /* a bare "#" is an unfilled placeholder — swallow it rather than let
     target="_blank" open a duplicate tab */
  if (hash.length < 2) return e.preventDefault();

  /* by id, not querySelector — an id starting with a digit is not a valid
     selector and would throw */
  const target = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!target) return;

  e.preventDefault();
  /* a menu link fires this while the menu still holds the scroll lock */
  lenis.start();
  lenis.scrollTo(target, { duration: 1.3 });
});

/* dev convenience: hot reloads replay the intro from the top */
if (import.meta.hot) {
  import.meta.hot.on('vite:beforeUpdate', () => window.scrollTo(0, 0));
}
