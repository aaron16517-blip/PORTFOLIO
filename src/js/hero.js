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

    /* deep sea-ink letters with a frost outline behind them — the outline
       is what keeps the hairline far letters readable over the teal */
    textColor:   '#0f2220',
    strokeColor: '#f7faf9',
    minFontSize: 36,
    maxFontSize: 300,

    /* touch: the whole middle band of the hero answers a finger, not just
       the letters' own box — the name is tall and thin, a hard target */
    touchArea: document.querySelector('.hero__centre')
  });

  /* hide everything so nothing shows through the curtain. Phones skip the
     filter entirely — even blur(0px) keeps a filter layer on every letter
     for the whole reveal */
  gsap.set(pressure.chars, LETTER_BLUR
    ? { opacity: 0, y: 60, filter: `blur(${LETTER_BLUR}px)` }
    : { opacity: 0, y: 60 });
  gsap.set('.js-reveal',   { opacity: 0, y: 22 });
}

/* the smoke comes up as the hero rises out of Eden's light */
export function igniteSmoke(duration = 1.6) {
  clouds.ignite(duration);
}
/* 0..1 while the hero rises over Eden. The frost ground and veil behind
   the canvas would cover the dive, so they wait for the smoke, unless
   there is no WebGL smoke, when they are all there is. */
export function setSmokeRise(v) {
  clouds.setRise(v);
  const hero = document.getElementById('hero');
  hero.style.setProperty('--hero-solid', !clouds.ok || v > 0.999 ? '1' : '0');
  hero.style.setProperty('--hero-veil', clouds.ok ? (v * v).toFixed(3) : '1');
  /* the type waits for the smoke to reach it, so none of it floats over
     the meadow when the visitor scrolls back up */
  const c = Math.min(1, Math.max(0, (v - 0.35) / 0.4));
  hero.style.setProperty('--hero-content', (c * c * (3 - 2 * c)).toFixed(3));
}

export function revealHero() {
  clouds.ignite(2.6);

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  /* letters land one after another, out of focus into focus */
  tl.to(pressure.chars, {
      opacity: 1,
      y: 0,
      ...(LETTER_BLUR ? { filter: 'blur(0px)' } : {}),
      duration: 1.4,
      ease: 'expo.out',
      stagger: 0.07,
      ...(LETTER_BLUR ? { clearProps: 'filter' } : {}),
      onComplete: () => {
        /* now the cursor takes over the letters' opacity */
        pressure.setAlphaActive(true);
        /* on touch, one swell rolls across the name so people find out
           it answers a finger (no-op with a mouse). It waits for the smoke
           to finish fading up, so the two heaviest moments of the load
           don't land on the same frames. */
        gsap.delayedCall(isLowPower ? 0.9 : 0, () => pressure.hint());
      }
    }, 0)
    .to('.hero .js-reveal', {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.07,
      /* a leftover inline transform outranks the buttons' :hover lift */
      clearProps: 'transform'
    }, 0.35);

  return tl;
}
