import gsap from 'gsap';

/* ============================================================
   PRELOADER
   Counts 0 -> 100 against real page-load progress, then dissolves
   onto the Eden ice sheet, which has been drawing underneath.

   initPreloader({ onReveal })  ->  Promise (resolves when done)
   `onReveal` fires the instant the dissolve starts, so the ice
   settles in while the countdown is still fading.
   ============================================================ */


/* resolves once the browser has actually finished loading assets */
function whenAssetsReady() {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') return resolve();
    window.addEventListener('load', resolve, { once: true });
  });
}

export function initPreloader({ onReveal = () => {} } = {}) {
  const root    = document.getElementById('preloader');
  const valueEl = document.getElementById('counterValue');
  const brandEl = document.getElementById('brandText');
  const barFill = document.getElementById('barFill');
  const barEl   = root.querySelector('.bar');
  const ground  = root.querySelector('.preloader__ground');
  const grain   = root.querySelector('.preloader__grain');

  const state = { v: 0 };
  let last = 0;

  /* paint the current progress value */
  const render = () => {
    const v = state.v;
    valueEl.textContent = Math.round(v);
    barFill.style.transform = `scaleX(${v / 100})`;

    /* speed-linked motion blur: the faster it counts, the softer it reads */
    const speed = Math.abs(v - last);
    last = v;
    valueEl.style.filter = speed > 0.1 ? `blur(${Math.min(speed * 1.4, 1.6)}px)` : 'none';
  };

  /* track real readiness in parallel with the animation */
  let assetsReady = false;
  whenAssetsReady().then(() => { assetsReady = true; });

  const tl = gsap.timeline();

  /* ---------- 1. entrance ---------- */
  tl.from(ground, { opacity: 0, duration: 1.2, ease: 'power2.out' }, 0)
    .from(valueEl, { yPercent: 115, duration: 1.1, ease: 'expo.out' }, 0)
    .from(brandEl, { yPercent: 115, duration: 1.0, ease: 'expo.out' }, 0.25)
    .from(barEl,   { scaleX: 0, transformOrigin: 'left center', duration: 0.9, ease: 'expo.out' }, 0.45);

  /* ---------- 2. the count: uneven, like something real is loading ---------- */
  const step = (v, duration, ease) => ({ v, duration, ease, onUpdate: render });

  const countTl = gsap.timeline()
    .to(state, step(27, 0.55, 'power2.out'))
    .to(state, step(34, 0.28, 'power1.inOut'))
    .to(state, step(61, 0.58, 'power2.inOut'))
    .to(state, step(68, 0.30, 'power1.inOut'))
    .to(state, step(88, 0.50, 'power2.inOut'))
    .to(state, step(94, 0.45, 'power1.out'));

  tl.add(countTl, 0.3);

  /* ---------- 3. hold at 94 until the page is genuinely ready ---------- */
  tl.call(function holdForAssets() {
    if (assetsReady) return;
    tl.pause();
    whenAssetsReady().then(() => gsap.delayedCall(0.15, () => tl.play()));
  });

  /* ---------- 4. finish the count, then a beat on 100 ---------- */
  tl.to(state, step(100, 0.5, 'power2.out'))
    .call(() => { valueEl.style.filter = 'none'; })
    .to({}, { duration: 0.28 });

  /* ---------- 5. exit ---------- */
  tl.to(barFill, { scaleX: 0, transformOrigin: 'right center', duration: 0.45, ease: 'power3.inOut' })
    .to([valueEl, brandEl], {
      yPercent: -115,
      duration: 0.7,
      ease: 'power3.inOut',
      stagger: 0.06
    }, '-=0.35')
    .to(barEl, { opacity: 0, duration: 0.3 }, '<');

  /* ---------- 6. the dissolve onto the ice ---------- */
  tl.call(() => {
      root.classList.add('is-done');
      onReveal();
    }, null, '-=0.25')
    .to(root, { opacity: 0, duration: 1.1, ease: 'power2.inOut' }, '<')
    .to(grain, { opacity: 0, duration: 0.5 }, '<')
    .set(root, { display: 'none' });

  return tl.then();
}
