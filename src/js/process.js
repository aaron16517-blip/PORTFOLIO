import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* ============================================================
   PROCESS — the four-step index and its panel

   The stepper advances on its own while the section is on screen, and
   hands control over the moment you touch it: hovering a step pauses the
   clock, clicking one takes you straight there and restarts it from that
   step. The active step's rail fills as its time runs out, so the change
   is never a surprise and the section never looks frozen. It stops
   entirely once the section leaves the viewport.

   Like the rest of the site, this always runs the full motion.
   ============================================================ */

/* ms a step holds before the next one takes over — long enough for each
   pane's own motion (bubbles, deploy grid) to finish, no longer */
const DWELL = 3000;

export function initProcess() {
  const section = document.getElementById('process');
  if (!section) return;

  const steps = [...section.querySelectorAll('.pr-step')];
  const panes = [...section.querySelectorAll('.pr-pane')];
  if (!steps.length) return;

  /* ---------- the deploy grid (pane 03) ---------- */
  const ship = section.querySelector('#processShip');
  /* 6 weeks x 12 columns of working days, with the deploys marked. Fixed,
     not random — a chart that reshuffles every reload reads as decoration. */
  const HITS = [3, 7, 9, 14, 16, 17, 22, 25, 26, 30, 31, 33, 38, 40, 41, 44, 45, 46];
  if (ship) {
    ship.innerHTML = Array.from({ length: 48 }, () => '<i></i>').join('');
  }
  const cells = ship ? [...ship.children] : [];
  let shipCalls = [];

  function runShip() {
    /* a replay cancels the last run, or its late calls light cells early */
    shipCalls.forEach((c) => c.kill());
    cells.forEach((c) => c.classList.remove('is-hit'));
    shipCalls = HITS.map((n, i) =>
      gsap.delayedCall(0.25 + i * 0.07, () => cells[n] && cells[n].classList.add('is-hit'))
    );
  }

  /* ---------- the stepper ---------- */
  let index = 0;
  let elapsed = 0;
  let paused = false;
  let live = false;

  /* the rail fill is its own element, moved with a transform — writing a
     custom property every frame restyled the whole step */
  const fills = steps.map((s) => {
    const f = document.createElement('span');
    f.className = 'pr-step__fill';
    f.setAttribute('aria-hidden', 'true');
    s.prepend(f);
    return f;
  });

  /* Phones: the list is one column above the panel, so a step opening and
     another closing moved everything below it, re-laying out the page for
     half a second every few seconds. The list is held at the height of its
     tallest state and contained, so the work stays inside it and nothing
     below moves. */
  const list = section.querySelector('.process__list');
  const narrow = window.matchMedia('(max-width: 900px)');
  let lockedW = 0;
  function lockHeight(force) {
    if (!list) return;
    if (!narrow.matches) {
      list.style.height = '';
      list.style.contain = '';
      lockedW = 0;
      return;
    }
    if (!force && lockedW === window.innerWidth) return;
    lockedW = window.innerWidth;
    list.style.height = '';
    list.style.contain = '';
    list.classList.add('is-measuring');
    let tallest = 0;
    steps.forEach((_, k) => {
      steps.forEach((t, j) => t.classList.toggle('is-on', j === k));
      tallest = Math.max(tallest, list.offsetHeight);
    });
    steps.forEach((t, j) => t.classList.toggle('is-on', j === index));
    list.style.height = Math.ceil(tallest) + 'px';
    list.style.contain = 'size layout';
    void list.offsetHeight;
    list.classList.remove('is-measuring');
  }
  lockHeight(true);
  window.addEventListener('resize', () => lockHeight(false));
  if (document.fonts?.ready) document.fonts.ready.then(() => { lockHeight(true); ScrollTrigger.refresh(); });

  function show(i) {
    index = ((i % steps.length) + steps.length) % steps.length;
    elapsed = 0;
    steps.forEach((s, k) => s.classList.toggle('is-on', k === index));
    fills.forEach((f) => { f.style.transform = 'scaleY(0)'; });
    panes.forEach((p, k) => p.classList.toggle('is-on', k === index));
    if (index === 2) runShip();
  }

  /* one clock on the shared ticker: it only runs while the section is on
     screen and nobody is hovering a step, and it drives the rail fill, so
     the bar and the switch can never drift apart */
  const tick = (_t, deltaMs) => {
    if (!live || paused || document.hidden) return;
    elapsed += deltaMs || 16;
    if (elapsed >= DWELL) { show(index + 1); return; }
    fills[index].style.transform = `scaleY(${(elapsed / DWELL).toFixed(4)})`;
  };
  const start = () => { if (!live) { live = true; gsap.ticker.add(tick); } };
  const stop = () => { live = false; gsap.ticker.remove(tick); };

  steps.forEach((step, i) => {
    step.addEventListener('click', () => show(i));
    step.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') paused = true; });
    step.addEventListener('pointerleave', () => { paused = false; });
  });

  /* ---------- only while it is on screen ---------- */
  ScrollTrigger.create({
    trigger: section,
    start: 'top 75%',
    end: 'bottom 25%',
    onEnter: () => { show(0); start(); },
    onEnterBack: start,
    onLeave: stop,
    onLeaveBack: stop
  });

  /* ---------- the head and index arrive on scroll ---------- */
  gsap.from(section.querySelectorAll('.process__eyebrow, .process__title, .process__lede'), {
    y: 26,
    opacity: 0,
    filter: 'blur(7px)',
    duration: 1,
    ease: 'power3.out',
    stagger: 0.09,
    clearProps: 'filter',
    scrollTrigger: { trigger: section, start: 'top 72%' }
  });

  gsap.from(steps, {
    y: 22,
    opacity: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.07,
    scrollTrigger: { trigger: section.querySelector('.process__body'), start: 'top 80%' }
  });

  gsap.from(section.querySelector('.process__screen'), {
    y: 34,
    opacity: 0,
    scale: 0.97,
    duration: 1.15,
    ease: 'power3.out',
    scrollTrigger: { trigger: section.querySelector('.process__body'), start: 'top 80%' }
  });
}
