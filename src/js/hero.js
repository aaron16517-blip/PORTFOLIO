import gsap from 'gsap';
import { createTextPressure } from './textPressure.js';
import { createClouds } from './clouds.js';
import { isLowPower } from './device.js';

/* a blur per letter on top of the smoke's first frames is the heaviest
   moment of the load on a phone; the rise and fade carry it alone there */
const LETTER_BLUR = isLowPower ? 0 : 14;

/* ============================================================
   HERO — builds the smoke and the pressure-sensitive name, then
   reveals them while the preloader curtain is still lifting.
   ============================================================ */

let clouds;
let pressure;

export function prepareHero() {
  clouds = createClouds(document.getElementById('clouds'));

  pressure = createTextPressure(document.getElementById('pressure'), {
    text: 'MICHAEL',

    flex:   true,
    alpha:  false,   // letters stay fully opaque
    stroke: true,    // outline behind keeps the thin far letters readable
    width:  true,
    weight: true,
    italic: true,

    textColor:   '#ffffff',
    /* red-on-red smoke is invisible; the reference's outlines read light */
    strokeColor: '#ffffff',
    minFontSize: 36,
    maxFontSize: 300
  });

  /* hide everything so nothing shows through the curtain */
  gsap.set(pressure.chars, { opacity: 0, y: 60, filter: `blur(${LETTER_BLUR}px)` });
  gsap.set('.js-reveal',   { opacity: 0, y: 22 });
}

export function revealHero() {
  clouds.ignite(2.6);

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  /* letters land one after another, out of focus into focus */
  tl.to(pressure.chars, {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.4,
      ease: 'expo.out',
      stagger: 0.07,
      clearProps: 'filter',
      /* now the cursor takes over the letters' opacity */
      onComplete: () => pressure.setAlphaActive(true)
    }, 0)
    .to('.js-reveal', {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.07
    }, 0.35);

  return tl;
}
