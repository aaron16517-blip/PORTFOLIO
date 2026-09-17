import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

import { isLowPower, isTouch } from './device.js';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   PROJECTS — the glassy bento grid.

   Two jobs: reveal the heading and cards on scroll, and track the
   cursor across each card so the sheen has something to follow.

   Like every section, this always runs the full motion.
   ============================================================ */

export function initProjects() {
  const section = document.getElementById('projects');
  if (!section) return;

  const rule  = section.querySelector('.projects__rule');
  const title = section.querySelector('.projects__title');
  const cards = gsap.utils.toArray('.card', section);

  /* ---------- heading ---------- */
  gsap.timeline({
    scrollTrigger: { trigger: '.projects__head', start: 'top 82%' },
    defaults: { ease: 'power3.out' }
  })
    .from(rule,  { scaleX: 0, duration: 0.7 }, 0)
    .from('.projects__eyebrow', { opacity: 0, duration: 0.6 }, 0)
    .from(title, { opacity: 0, y: 34, duration: 1.0, ease: 'expo.out' }, 0.1);

  /* ---------- the cards, out of focus into focus ---------- */
  gsap.from(cards, {
    scrollTrigger: { trigger: '.projects__grid', start: 'top 84%' },
    opacity: 0,
    y: 48,
    scale: 0.965,
    /* six blurred cards at once is a lot for a phone; they still rise */
    filter: isLowPower ? 'blur(0px)' : 'blur(12px)',
    duration: 1.1,
    ease: 'expo.out',
    stagger: 0.075,
    clearProps: 'filter,scale'
  });

  /* ---------- the sheen follows the pointer ----------
     Written to .card__sheen, never to the backdrop-filtered .card__inner,
     and coalesced into one write per frame — a property write per
     pointermove event repaints far more often than the screen refreshes. */
  /* a finger has no hover, and a drag across a card is a scroll */
  if (isTouch) return;

  cards.forEach((card) => {
    const sheen = card.querySelector('.card__sheen');
    if (!sheen) return;

    let queued = null;

    const paint = () => {
      const { clientX, clientY } = queued;
      queued = null;

      const { left, top, width, height } = card.getBoundingClientRect();
      sheen.style.setProperty('--mx', `${((clientX - left) / width) * 100}%`);
      sheen.style.setProperty('--my', `${((clientY - top) / height) * 100}%`);
    };

    card.addEventListener('pointermove', (e) => {
      const first = queued === null;
      queued = { clientX: e.clientX, clientY: e.clientY };
      if (first) requestAnimationFrame(paint);
    });
  });
}
