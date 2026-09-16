/* =====================================================================
   ARCO — motion runtime (desktop)
   ---------------------------------------------------------------------
   Reimplements the source site's Webflow IX2 interactions without the
   Webflow runtime or jQuery. Timings are the values read out of its
   ixData, not estimates:

     reveal    SCROLL_INTO_VIEW  -> translateY 15px + opacity, 1000ms
                                    `ease`, 100ms stagger  (CSS)
     parallax  SCROLLING_IN_VIEW -> translateY +70px to -70px, linear
     arch      SCROLLING_IN_VIEW -> width 50%->100%, opacity 0->1,
                                    between keyframes 5% and 50%
     hint      PAGE_SCROLL       -> opacity 1 to 0 between 12% and 13%
     slider    autoplay 2500ms, slide 700ms, active scale 1 / rest .85
   ===================================================================== */

(function () {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* Webflow's "scrolling in view" progress for an element:
     0 when its top edge sits at the bottom of the viewport,
     1 when its bottom edge sits at the top. */
  function traversal(rect, vh) {
    return clamp((vh - rect.top) / (vh + rect.height), 0, 1);
  }

  /* map t through [a,b] -> [0,1], holding at the ends (Webflow keyframes) */
  function between(t, a, b) {
    if (t <= a) return 0;
    if (t >= b) return 1;
    return (t - a) / (b - a);
  }

  /* ---- 1. reveal ---------------------------------------------------- */
  function initReveal() {
    var targets = document.querySelectorAll('[data-reveal]');

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });

    Array.prototype.forEach.call(targets, function (el) { io.observe(el); });
  }

  /* ---- 2. scroll-scrubbed group ------------------------------------- */
  function initScrub() {
    var parallax = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    var shape = document.querySelector('[data-shape]');
    var hint = document.querySelector('[data-page-fade]');
    var ticking = false;

    function frame() {
      var vh = window.innerHeight;

      // a-16 — translateY +70px -> -70px, linear across the traversal
      parallax.forEach(function (el) {
        var t = traversal(el.getBoundingClientRect(), vh);
        el.style.transform = 'translate3d(0,' + (70 - 140 * t).toFixed(2) + 'px,0)';
      });

      // a — width 50% -> 100%, opacity 0 -> 1, keyframes at 5% and 50%
      if (shape) {
        var st = traversal(shape.getBoundingClientRect(), vh);
        var k = between(st, 0.05, 0.50);
        shape.style.width = (50 + 50 * k).toFixed(2) + '%';
        shape.style.opacity = k.toFixed(3);
      }

      // a-43 — page scroll: opaque to 12%, transparent by 13%
      if (hint) {
        var max = document.documentElement.scrollHeight - vh;
        var p = max > 0 ? window.scrollY / max : 0;
        hint.style.opacity = (1 - between(p, 0.12, 0.13)).toFixed(3);
      }

      ticking = false;
    }

    function request() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    request();
  }

  /* ---- 3. slider ---------------------------------------------------- */
  function initSlider() {
    var root = document.querySelector('[data-slider]');
    if (!root) return;

    var track = root.querySelector('.slider__track');
    var slides = Array.prototype.slice.call(root.querySelectorAll('.slide'));
    if (!track || !slides.length) return;

    var delay = parseInt(root.dataset.autoplay, 10) || 2500;
    var index = 0;
    var timer = null;

    function render() {
      // layout width, not getBoundingClientRect — that would return the
      // scaled (.85) width and drift the track a little further each step
      var w = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--slide-w'));
      // centre the active slide, so neighbours flank it at .85 scale
      var offset = root.clientWidth / 2 - (index * w + w / 2);
      track.style.transform = 'translate3d(' + offset.toFixed(2) + 'px,0,0)';
      slides.forEach(function (s, i) { s.classList.toggle('is-active', i === index); });
    }

    function go(n) {
      index = (n + slides.length) % slides.length;
      render();
    }

    function play() {
      stop();
      timer = setInterval(function () { go(index + 1); }, delay);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    var next = root.querySelector('[data-slider-next]');
    var prev = root.querySelector('[data-slider-prev]');
    if (next) next.addEventListener('click', function () { go(index + 1); play(); });
    if (prev) prev.addEventListener('click', function () { go(index - 1); play(); });

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);
    window.addEventListener('resize', render, { passive: true });

    render();
    play();
  }

  /* ---- 4. nav ------------------------------------------------------- */
  function initNav() {
    var btn = document.querySelector('.nav__menu');
    var panel = document.querySelector('.nav__panel');
    if (!btn || !panel) return;

    function setOpen(open) {
      btn.setAttribute('aria-expanded', String(open));
      panel.hidden = !open;
    }

    btn.addEventListener('click', function () {
      setOpen(btn.getAttribute('aria-expanded') !== 'true');
    });
    panel.addEventListener('click', function (e) {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  function init() {
    initReveal();
    initScrub();
    initSlider();
    initNav();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
