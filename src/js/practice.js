import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import { initMind } from './mind.js';

gsap.registerPlugin(ScrollTrigger);


/* ============================================================
   HOW I WORK

   Two scrubbed moves, both hanging off the same line:

     1. the opening — the thread that fell out of the section above is
        picked up at the same x, carried a few lines further down, and the
        section parts along it;
     2. the spine — that line then runs on through the four steps, and each
        step arrives as the line reaches its node.

   Like the rest of the site, this always runs the full motion.
   ============================================================ */

export function initPractice() {
  const section = document.getElementById('practice');
  if (!section) return;

  /* ---------- 1. the opening ---------- */
  const curtain = section.querySelector('.practice__curtain');
  const left  = section.querySelector('.practice__half--l');
  const right = section.querySelector('.practice__half--r');
  const seam  = section.querySelector('.practice__seam');
  const mind  = section.querySelector('.mind');

  initMind(section.querySelector('#practiceMind'));

  if (curtain) {
    /* close it — the CSS leaves the halves open so the section still shows
       on a page where this script never runs */
    gsap.set([left, right], { xPercent: 0 });
    gsap.set(seam, { opacity: 1, scaleY: 0, transformOrigin: 'top center' });
    if (mind) gsap.set(mind, { opacity: 0, scale: 0.92 });

    gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        /* 'top bottom' is exact here, not approximate: the section's top hits
           the viewport's bottom on the same scroll frame the thread above
           finishes its fall on that same edge. The seam picks up where the
           thread stopped, and after this both scroll together, so the join
           holds for the rest of the way down. */
        trigger: section,
        start: 'top bottom',
        end: 'top 18%',
        scrub: 0.8
      }
    })
      /* the line carries on falling, in the colour it arrived in... */
      .to(seam, { scaleY: 1, duration: 0.56 }, 0)
      /* ...and where it stops, the section opens along it */
      .to(left,  { xPercent: -100, duration: 0.52, ease: 'power2.inOut' }, 0.5)
      .to(right, { xPercent: 100,  duration: 0.52, ease: 'power2.inOut' }, 0.5)
      /* and the sphere comes up in the gap it opened. The seam is not faded
         out afterwards — it is the line, and the line has to stay. */
      .to(mind,  { opacity: 1, scale: 1, duration: 0.42, ease: 'power2.out' }, 0.58);
  }

  /* ---------- 2. the spine and the steps ---------- */
  const spine = section.querySelector('.practice__spine');
  const list  = section.querySelector('.practice__steps');
  const steps = gsap.utils.toArray('.pstep', section);
  const terms = section.querySelector('.practice__terms');
  if (!spine || !list || !steps.length) return;

  /* the spine is a plain absolute box — it spans whatever the steps measure,
     remeasured whenever ScrollTrigger remeasures everything else */
  const placeSpine = () => {
    spine.style.top = list.offsetTop + 'px';
    spine.style.height = list.offsetHeight + 'px';
  };
  placeSpine();
  ScrollTrigger.addEventListener('refresh', placeSpine);

  gsap.set(spine, { scaleY: 0 });
  gsap.set(steps, { opacity: 0, y: 28 });
  if (terms) gsap.set(terms, { opacity: 0, y: 24 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: list,
      start: 'top 78%',
      end: 'bottom 62%',
      scrub: 0.7
    }
  });

  tl.to(spine, { scaleY: 1, duration: 1 }, 0);

  /* each step lands as the line reaches its node */
  steps.forEach((step, i) => {
    tl.to(step, {
      opacity: 1,
      y: 0,
      duration: 0.26,
      ease: 'power2.out'
    }, 0.04 + i * 0.235);
  });

  if (terms) tl.to(terms, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out' }, 0.95);

  return tl;
}
