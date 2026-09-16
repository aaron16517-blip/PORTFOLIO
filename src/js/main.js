import '../styles/base.css';
import '../styles/preloader.css';
import '../styles/hero.css';
import '../styles/ghostCursor.css';
import '../styles/menu.css';
import '../styles/projects.css';
import '../styles/experience.css';
import '../styles/practice.css';
import '../styles/process.css';
import '../styles/contact.css';
import '../styles/footer.css';
import '../styles/vision.css';
import 'lenis/dist/lenis.css';

import gsap from 'gsap';
import Lenis from 'lenis';
import ScrollTrigger from 'gsap/ScrollTrigger';

import { initPreloader } from './preloader.js';
import { prepareHero, revealHero } from './hero.js';
import { initMenu } from './menu.js';
import { isTouch } from './device.js';
import { initVision } from './vision.js';
import { initProjects } from './projects.js';
import { initExperience } from './experience.js';
import { initPractice } from './practice.js';
import { initProcess } from './process.js';
import { initContact } from './contact.js';

/* ---------- smooth scroll, driven by GSAP's ticker ---------- */
const lenis = new Lenis({
  duration: 1.1,
  smoothWheel: true,
  touchMultiplier: 1.6
});

gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ScrollTrigger reads Lenis's scroll, not the native one */
gsap.registerPlugin(ScrollTrigger);
lenis.on('scroll', ScrollTrigger.update);

/* A phone's address bar showing and hiding is a resize. Without this every
   one of those remeasures every trigger mid-scroll, which is the stutter. */
ScrollTrigger.config({ ignoreMobileResize: true });

/* no scrolling while the counter runs */
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
  const [{ createGhostCursor }, { createHeroInk }] = await Promise.all([
    import('./ghostCursor.js'),
    import('./heroInk.js')
  ]);
  createGhostCursor(document.getElementById('ghostCursor'), {
    /* The reference values (brightness 1, bloom 0.1) assume a plain dark page;
       this hero is already full of bright red smoke, so the trail needs gain to
       read at all. But the canvas blends with 'screen', which only ever ADDS
       light — and white adds to all three channels at once, where a tint adds
       to one or two. So white needs far less gain than a colour does, or it
       stops looking like smoke and just blows the hero out. */
    color: '#ffffff',
    brightness: 0.5,
    radius: 0.5,
    edgeIntensity: 0,
    trailLength: 50,
    inertia: 0.5,
    grainIntensity: 0.05,
    bloomStrength: 0.08,
    bloomRadius: 0.8,
    bloomThreshold: 0.08,
    fadeDelayMs: 1000,
    fadeDurationMs: 1500,
    /* the small light type the smoke drifts behind goes black under it */
    onFrame: createHeroInk({
      split: [document.querySelector('.nav__tag'), document.querySelector('.hero__bio')],
      whole: [document.getElementById('menuToggle')]
    })
  });
}

initVision();
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
    revealHero();
    /* the curtain changed the layout height — remeasure the triggers */
    ScrollTrigger.refresh();
  }
});

/* ---------- in-page anchors go through Lenis, not the native jump ---------- */
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[href^="#"]');
  if (!link) return;

  const hash = link.getAttribute('href');

  /* a bare "#" is an unfilled placeholder — swallow it rather than let
     target="_blank" open a duplicate tab */
  if (hash.length < 2) return e.preventDefault();

  const target = document.querySelector(hash);
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
