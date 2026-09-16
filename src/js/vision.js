import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

import { isLowPower } from './device.js';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   VISION — one scrubbed timeline over a 280vh runway:
     a small, blurred card fades in and grows to full bleed,
     sharpening as it opens,
     "THE VISION" rides on top of it and hands off to the small
     "VISION" label, then the statement fades up.

   The full scrub always runs — this section is not reduced.
   ============================================================ */

/* the image's resting look; blur is appended so GSAP can tween the
   whole filter string at once (same function list on both ends) */
const BASE_FILTER = 'grayscale(0.5) contrast(1.12) brightness(0.46)';
const filterAt = (blur) => `${BASE_FILTER} blur(${blur}px)`;

/* the card is scaled to 0.34 while it's blurred, and a filter is
   computed before the transform — so the radius has to start big to
   read as blurred on screen */
const BLUR_START = 30;

/* Phones skip the sharpen. A filter blur that changes every scroll frame
   re-rasterises the full-bleed image each time — the single most expensive
   thing on the page on a mobile GPU. The card still fades in and opens. */
const SCRUB_BLUR = !isLowPower;

export function initVision() {
  const media = document.getElementById('visionMedia');
  const image = media?.querySelector('img');
  const title = document.getElementById('visionTitle');
  const label = document.getElementById('visionLabel');
  const copy  = document.getElementById('visionCopy');
  if (!media || !title) return;

  /* closed state: a small, soft, invisible card */
  gsap.set(media, { scale: 0.34, opacity: 0, transformOrigin: 'center center' });
  gsap.set(title, { opacity: 0 });
  if (image) gsap.set(image, { filter: SCRUB_BLUR ? filterAt(BLUR_START) : BASE_FILTER });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: '.vision',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.8
    }
  });

  /* ---------- 1. fade in, then open ---------- */
  tl.to(media, { opacity: 1, duration: 0.10 }, 0)
    .to(title, { opacity: 1, duration: 0.12 }, 0.02)
    .to(media, { scale: 1, duration: 0.55 }, 0);

  /* ---------- 2. sharpen as it opens ---------- */
  if (image && SCRUB_BLUR) tl.to(image, { filter: filterAt(0), duration: 0.45 }, 0.02);

  /* ---------- 3. THE VISION hands off to the VISION header ---------- */
  tl.to(title, { scale: 1.08, opacity: 0, duration: 0.20 }, 0.52)
    .to(label, { opacity: 1, duration: 0.14 }, 0.66)
    .fromTo(copy, { y: 30 }, { opacity: 1, y: 0, duration: 0.24 }, 0.72);

  return tl;
}
