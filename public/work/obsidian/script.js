/* OBSIDIAN — step 1 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* the house mark: a six-point asterisk, three rotated bars */
  function mark() {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'mark');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    [0, 60, 120].forEach(function (deg) {
      var r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', '10.6');
      r.setAttribute('y', '0');
      r.setAttribute('width', '2.8');
      r.setAttribute('height', '24');
      r.setAttribute('rx', '1.4');
      r.setAttribute('fill', 'currentColor');
      if (deg) r.setAttribute('transform', 'rotate(' + deg + ' 12 12)');
      svg.appendChild(r);
    });
    return svg;
  }

  /* marquee: separate every item with a mark, then clone the set so the
     -50% keyframe lands exactly on the seam */
  ['strip-track', 'name-track'].forEach(function (id) {
    var track = document.getElementById(id);
    if (!track) return;
    var set = track.firstElementChild;
    set.querySelectorAll('span').forEach(function (s) {
      set.insertBefore(mark(), s.nextSibling);
    });
    track.appendChild(set.cloneNode(true));
  });

  /* index: the stage shows whichever category the cursor is on */
  var list = document.getElementById('index-list');
  var stage = document.getElementById('index-stage');
  if (list && stage) {
    var shots = stage.children;
    var show = function (i) {
      for (var n = 0; n < shots.length; n++) {
        shots[n].classList.toggle('is-on', n === i);
      }
    };
    list.querySelectorAll('a[data-i]').forEach(function (a) {
      var i = parseInt(a.dataset.i, 10);
      a.addEventListener('mouseenter', function () { show(i); });
      a.addEventListener('focus', function () { show(i); });
    });
  }

  /* image slots: fall back to a sized placeholder until the real file lands */
  document.querySelectorAll('[data-slot] img').forEach(function (img) {
    var slot = img.closest('[data-slot]');
    var fail = function () { slot.classList.add('is-empty'); };
    if (img.complete && img.naturalWidth === 0) fail();
    img.addEventListener('error', fail);
  });

  /* the closing wordmark is set to fill the measure exactly. a vw guess is
     always slightly wrong — the real width depends on the loaded font — so
     measure at a known size and scale from that. */
  var markEl = document.querySelector('.footer__mark');
  var LS = 0.02; /* must match .footer__mark letter-spacing, in em */
  function fitMark() {
    if (!markEl) return;
    var p = markEl.parentElement;
    var cs = getComputedStyle(p);
    /* clientWidth includes the container's padding — take it off */
    var avail = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    markEl.style.fontSize = '100px';
    /* the element is width:max-content, so this is the text, not the column.
       drop the trailing letter-space so the glyphs land on the edge. */
    var ink = markEl.getBoundingClientRect().width - LS * 100;
    if (ink > 0 && avail > 0) markEl.style.fontSize = (100 * avail / ink) + 'px';
  }
  fitMark();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitMark);
  var fitTimer;
  addEventListener('resize', function () {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(fitMark, 120);
  });

  /* collection carousel: the bar shows how much of the row is in view and
     where you are in it. Next steps one card, then wraps back to the start. */
  var row = document.getElementById('cards-row');
  var fill = document.getElementById('cards-fill');
  var next = document.getElementById('cards-next');
  if (row && fill && next) {
    var atEnd = function () { return row.scrollLeft >= row.scrollWidth - row.clientWidth - 2; };
    var sync = function () {
      var span = row.scrollWidth - row.clientWidth;
      var seen = row.clientWidth / row.scrollWidth;
      fill.style.width = (seen * 100) + '%';
      fill.style.left = (span > 0 ? (row.scrollLeft / span) * (100 - seen * 100) : 0) + '%';
      next.classList.toggle('is-wrap', atEnd());
    };
    row.addEventListener('scroll', sync, { passive: true });
    addEventListener('resize', sync);
    sync();

    next.addEventListener('click', function () {
      var card = row.querySelector('.card');
      if (!card) return;
      var gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      var step = card.getBoundingClientRect().width + gap;
      row.scrollBy({ left: atEnd() ? -row.scrollWidth : step, behavior: 'smooth' });
    });
  }

  /* year */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* signup — front end only; needs a real endpoint before launch */
  var signup = document.getElementById('signup');
  if (signup) {
    signup.addEventListener('submit', function (e) {
      e.preventDefault();
      var field = signup.querySelector('input');
      var msg = signup.querySelector('.signup__msg');
      var ok = field.value && field.checkValidity();
      msg.textContent = ok ? 'On the list. We write rarely.' : 'That address does not look right.';
      if (ok) field.value = '';
    });
  }

  /* gentle reveal on scroll */
  var items = document.querySelectorAll('.rv');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  items.forEach(function (el) { io.observe(el); });
  /* seam.js takes these over when the thread is running, and needs to call
     this off so the two do not both try to reveal the same element */
  window.__revealIO = io;
})();
