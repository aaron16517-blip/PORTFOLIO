import gsap from 'gsap';

/* ============================================================
   MENU — the left panel behind DIVE IN.
   initMenu({ onOpen, onClose }) -> { open, close, toggle }
   ============================================================ */

export function initMenu({ onOpen = () => {}, onClose = () => {} } = {}) {
  const root    = document.getElementById('menu');
  const toggle  = document.getElementById('menuToggle');
  const label   = document.getElementById('menuToggleLabel');
  if (!root || !toggle) return { open() {}, close() {}, toggle() {} };

  const panel    = root.querySelector('.menu__panel');
  const backdrop = root.querySelector('.menu__backdrop');
  const words    = root.querySelectorAll('.menu__word');
  const indices  = root.querySelectorAll('.menu__index');
  const socials  = root.querySelectorAll('.menu__socials-label, .menu__socials-list li');

  let open = false;
  let tl;

  const build = () => {
    const timeline = gsap.timeline({
      paused: true,
      onReverseComplete: () => {
        /* only tear down if nothing re-opened it mid-reverse */
        if (!open) {
          root.classList.remove('is-open');
          onClose();
        }
      }
    });

    timeline
      .to(backdrop, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0)
      .to(panel, { x: '0%', duration: 0.8, ease: 'expo.out' }, 0)
      .from(words, {
        yPercent: 110,
        duration: 0.8,
        ease: 'expo.out',
        stagger: 0.07
      }, 0.18)
      .from(indices, {
        opacity: 0,
        duration: 0.5,
        stagger: 0.07
      }, 0.32)
      .from(socials, {
        opacity: 0,
        y: 12,
        duration: 0.5,
        stagger: 0.05
      }, 0.42);

    return timeline;
  };

  const setOpen = (next) => {
    if (next === open) return;
    open = next;

    toggle.setAttribute('aria-expanded', String(open));
    root.setAttribute('aria-hidden', String(!open));
    label.textContent = open ? 'CLOSE' : 'DIVE IN';

    if (open) {
      root.classList.add('is-open');
      onOpen();
    }

    if (!tl) tl = build();

    if (open) tl.play();
    else tl.reverse();
  };

  /* ---------- wiring ---------- */
  toggle.addEventListener('click', () => setOpen(!open));

  root.querySelectorAll('[data-menu-close]').forEach((el) =>
    el.addEventListener('click', () => setOpen(false))
  );

  /* a link both navigates and closes */
  root.querySelectorAll('.menu__link').forEach((link) =>
    link.addEventListener('click', () => setOpen(false))
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) setOpen(false);
  });

  return {
    open: () => setOpen(true),
    close: () => setOpen(false),
    toggle: () => setOpen(!open)
  };
}
