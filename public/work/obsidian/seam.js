/* ============================================================
   OBSIDIAN — the seam
   Same technique as the reference: one long SVG path behind the content,
   stroke-dasharray set to its own length, and stroke-dashoffset scrubbed to
   zero by scroll — so the line draws itself down the page.

   What is different is the reading. The reference draws a 200px orange
   ribbon; on a monochrome wall that would be the loudest thing on the site.
   Here the same path carries two strokes: a wide, very soft band that reads
   as a fold catching light off the concrete, and a hairline down its centre
   that reads as the stitch. A small pin marker rides the leading tip so the eye
   has one moving object to follow, which is what makes the line read as being
   DRAWN rather than simply appearing.

   The `d` is generated from the live page box rather than hard-coded, so the
   route survives a resize, a font swap, or a section being added.
   ============================================================ */
(function () {
  'use strict';

  var svg = document.querySelector('.seam');
  if (!svg) return;

  var band = svg.querySelector('.seam__band');
  var line = svg.querySelector('.seam__line');
  var pin = svg.querySelector('.seam__pin');
  var ripple = svg.querySelector('.seam__ripple');
  if (!band || !line || !pin) return;

  /* Where the line sits at a given depth, as fractions of the page box.
     Sides alternate so it sweeps rather than wanders — about one sweep every
     screen and a half, which stays calm over a page this long. The first and
     last points sit outside the page so the line runs off both ends instead
     of starting and stopping in mid-air.

     It runs through the hero as well. The figure and rocks there are
     white-ground plates dissolved into the wall with mix-blend-mode:multiply,
     which is a function of what is BEHIND the plate — so left alone they let
     the line show through as if it were drawn ON them. plates.js puts an
     opaque wall-textured cut-out under each one so they occlude properly. */
  var ANCHORS = [
    [0.62, -0.012],  /* enters just above the fold, right of centre */
    [0.16,  0.062],  /* out past the hero's left edge */
    [0.86,  0.150],
    [0.12,  0.250],  /* atelier */
    [0.84,  0.352],
    [0.18,  0.455],  /* index — under the category list */
    [0.86,  0.560],  /* across the collection row */
    [0.14,  0.672],  /* the long pinned stretch */
    [0.80,  0.782],
    [0.22,  0.888],  /* manifesto */
    [0.66,  1.020]   /* out through the footer */
  ];

  /* Where the drawing tip sits in the viewport, as a fraction of its height.
     The line is drawn exactly as far down the PAGE as you have scrolled, not
     as far along its own length — so the tip always sits just below what you
     are reading. It still moves, and moves in the interesting direction: at a
     fixed height on screen the path's x is what changes, so the tip sweeps
     left and right across the viewport as the curve does. */
  var LEAD = 0.66;

  /* A hidden pane, a background tab, an orientation change: all can report a
     zero-height viewport for a frame or two. Zero would put the drawing tip
     at the top of the screen instead of below the reader, so hold the last
     real height until a real one comes back. */
  var vhLast = 800;
  function viewportH() {
    var v = window.innerHeight || document.documentElement.clientHeight;
    if (v > 0) vhLast = v;
    return vhLast;
  }

  /* Catmull-Rom through the anchors, emitted as cubic Béziers. The curve
     passes through every point, which is what makes it possible to aim the
     line at real gaps in the layout instead of guessing control handles. */
  function pathThrough(pts) {
    var d = 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i];
      var p1 = pts[i];
      var p2 = pts[i + 1];
      var p3 = pts[i + 2] || pts[i + 1];
      d += 'C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' +
                 (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) + ',' +
                 (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' +
                 (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) + ',' +
                 p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    return d;
  }

  var len = 0;

  /* Depth-to-length table. The path is one long curve, so "how far along the
     stroke is document y?" has no closed form — but it only has to be solved
     once per layout. 320 samples over a page this tall is a rung every ~28px,
     and the gaps are interpolated, so the tip lands within a pixel.
     Clamped to be non-decreasing: the curve can nose upward by a hair at a
     turn, and a table that goes backwards breaks the search. */
  var SAMPLES = 320;
  var ys = new Float64Array(SAMPLES + 1);

  function measureDepth() {
    var peak = -Infinity;
    for (var i = 0; i <= SAMPLES; i++) {
      var y = line.getPointAtLength(len * i / SAMPLES).y;
      if (y < peak) y = peak; else peak = y;
      ys[i] = y;
    }
  }

  function lengthAtDepth(y) {
    if (y <= ys[0]) return 0;
    if (y >= ys[SAMPLES]) return 1;
    var lo = 0, hi = SAMPLES;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ys[mid] <= y) lo = mid; else hi = mid;
    }
    var span = ys[hi] - ys[lo];
    return (lo + (span > 0 ? (y - ys[lo]) / span : 0)) / SAMPLES;
  }

  /* ---------- the stitch ----------
     The reveal is not "this element entered the viewport". It is "the thread
     reached it". Content is dealt into place by the seam as the tip passes:
     each piece starts pushed off the line and settles back onto it, and how
     long it waits is set by how far it sits from the thread at its own depth.

     Because the seam sweeps side to side down the page, the cascade turns
     with it — the right column leads where the line swings right, the left
     column leads where it swings left. That ordering falls out of the
     composition instead of being hand-assigned, and it is the reason this
     reads as one idea rather than a page of separate reveals.

     Everything is measured and written up front, at layout time. Nothing here
     touches the DOM during a scroll except adding one class. */
  var SPREAD = 0.34;    /* s of extra wait for content furthest from the line */
  var CAP = 0.7;        /* nothing waits longer than this, however far out */
  var pending = [];
  /* off until the thread is definitely running. build() happens before the
     bail-outs below, and an ungated stitch there would reveal the whole page
     at once on the reduced-motion and blocked-CDN paths, where script.js's
     observer is still the one in charge. */
  var stitching = false;

  function docPos(el) {
    /* the offset chain again: layout position, blind to the transforms that
       the dolly and the parallax are writing over the top */
    if (typeof el.offsetTop === 'number') {
      var x = 0, y = 0;
      for (var n = el; n; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      return { x: x + el.offsetWidth / 2, y: y };
    }
    /* an <svg> is not an HTMLElement and has none of that geometry — offsetTop
       is undefined, which would have poisoned the whole measurement with NaN.
       A rect is correct for these: nothing in the page transforms them. */
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + window.scrollY };
  }

  function measureStitch() {
    if (!stitching) return;
    /* .model/.rock/.occ are the hero plates — they belong to the dolly and
       must not be dealt sideways. .in is anything already revealed. */
    pending = Array.prototype.slice.call(
      document.querySelectorAll('.rv:not(.in):not(.model):not(.rock):not(.occ)')
    );
    var w = Math.max(document.documentElement.clientWidth, 320);
    pending.forEach(function (el) {
      var p = docPos(el);
      el._sy = p.y;
      /* where the thread crosses this element's own depth */
      var tx = line.getPointAtLength(len * lengthAtDepth(p.y)).x;
      var far = Math.min(1, Math.abs(p.x - tx) / (w * 0.6));
      /* the group cascade the .rv-N classes already encode, kept so a header
         and its heading still arrive in order, plus the spatial one */
      /* getAttribute, not .className: on an <svg> that property is an
         SVGAnimatedString with no .match, and the throw took out every
         element after the first one in the list. */
      var m = (el.getAttribute('class') || '').match(/\brv-(\d)\b/);
      var base = m ? 0.06 + (+m[1] - 1) * 0.08 : 0;
      el.style.transitionDelay = Math.min(CAP, base + far * SPREAD).toFixed(3) + 's';
      el.style.setProperty('--rv-x', ((p.x < tx ? -1 : 1) * (6 + far * 12)).toFixed(1) + 'px');
    });
  }

  function tick() {
    if (!ripple || !ripple.animate) return;
    ripple.animate(
      [{ transform: 'scale(1)', opacity: 0.85 }, { transform: 'scale(3.4)', opacity: 0 }],
      { duration: 560, easing: 'cubic-bezier(.22,1,.36,1)' }
    );
  }

  function stitch(depth) {
    if (!stitching || !pending.length) return;
    var hit = false;
    for (var i = pending.length - 1; i >= 0; i--) {
      if (depth < pending[i]._sy) continue;
      pending[i].classList.add('in');
      pending.splice(i, 1);
      hit = true;
    }
    if (hit) tick();
  }

  /* set once, when there is nothing driving the scroll: the seam is part of
     the layout, not just an effect, so it has to be there in full rather than
     stranded as a stub */
  var stat = false;
  var lastT = -1;

  function draw(force) {
    var depth = window.scrollY + viewportH() * LEAD;
    stitch(stat ? Infinity : depth);
    var t = stat ? 1 : lengthAtDepth(depth);
    /* this runs off the ticker, so it is called on every frame whether or not
       the page moved. bailing on an unchanged value keeps an idle page from
       repainting the stroke sixty times a second for nothing. */
    if (!force && t === lastT) return;
    lastT = t;

    /* both strokes share one offset, so the hairline is always exactly as
       long as the band it sits in */
    var off = len * (1 - t);
    band.style.strokeDashoffset = off;
    line.style.strokeDashoffset = off;

    /* one transform on the group rather than a coordinate pair per circle */
    var pt = line.getPointAtLength(len * t);
    pin.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ')');
    /* off at both ends so the pin never sits parked on a finished line */
    pin.style.opacity = Math.min(1, t / 0.03) * (1 - Math.min(1, Math.max(0, (t - 0.95) / 0.05)));
  }

  function build() {
    var doc = document.documentElement;
    /* floored: a collapsed pane or a hidden iframe lays the page out at zero
       width, and a zero-width path has no length to divide the depth table
       by. The observer below rebuilds as soon as a real width arrives. */
    var w = Math.max(doc.clientWidth, 320);
    var h = Math.max(doc.scrollHeight, viewportH(), 320);

    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.style.width = w + 'px';
    svg.style.height = h + 'px';

    var d = pathThrough(ANCHORS.map(function (a) { return [a[0] * w, a[1] * h]; }));
    band.setAttribute('d', d);
    line.setAttribute('d', d);

    /* the band is a proportion of the page, not a fixed slab, so it does not
       swallow a narrow viewport */
    svg.style.setProperty('--seam-band', Math.round(Math.min(w * 0.062, 104)) + 'px');

    len = line.getTotalLength();
    band.style.strokeDasharray = len;
    line.style.strokeDasharray = len;
    measureDepth();
    measureStitch();
    draw(true);
  }

  build();

  /* The page also changes height without a resize or a ScrollTrigger refresh:
     a late image, the marquee cloning itself, the carousel wrapping. One
     observer on the body catches all of them. The guard matters — build()
     writes to the DOM, and an unguarded rebuild would re-enter forever. */
  if (window.ResizeObserver) {
    var lastH = 0, lastW = 0;
    new ResizeObserver(function () {
      var doc = document.documentElement;
      if (doc.scrollHeight === lastH && doc.clientWidth === lastW) return;
      lastH = doc.scrollHeight;
      lastW = doc.clientWidth;
      build();
    }).observe(document.body);
  }

  /* ---------- driver ----------
     Anything that stops the scroll animation elsewhere on the site stops it
     here too, and leaves the seam fully drawn: it is part of the layout, not
     just an effect, so it must not vanish when motion is off. */
  var forced = true;  /* hosted build: motion is always on — the OS
     'animation effects: off' setting reports prefers-reduced-motion and
     would otherwise kill the whole scroll animation. */
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && !forced;

  if (!window.gsap || !window.ScrollTrigger || reduced) {
    stat = true;
    draw(true);
    var t;
    addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(build, 200);
    });
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  /* Only now, past every bail-out above: the thread is definitely going to
     run, so it takes the reveal off script.js. Left connected, that observer
     fires at the viewport edge — well before the tip reaches anything — and
     would reveal each element out from under the stitch. */
  stitching = true;
  if (window.__revealIO) window.__revealIO.disconnect();
  measureStitch();
  draw(true);

  /* Read straight off the scroll position on the shared ticker rather than
     through a ScrollTrigger of its own. A trigger spanning the whole document
     gets its range shortened by the pinned section inside it — measured end
     5884 against a real scroll max of 7780 — so the draw froze a screen and a
     half before the footer. The ticker has no such range, and it is the same
     clock Lenis runs on. Cost when nothing moves is one binary search and an
     early return.

     THIS FILE MUST LOAD AFTER motion.js. The ticker calls its listeners in
     the order they were added, and motion.js is what hands Lenis the ticker.
     Registered first, this reads window.scrollY BEFORE Lenis has moved the
     page, so the seam renders one frame stale — everything else travels with
     the scroll and the line trails it, measured at up to 97px at speed, with
     the gap pulsing as the scroll accelerates. No frame is late; it just
     reads as stutter. Registering after Lenis puts the read on the far side
     of the move, and the error measures 0.

     Deferring the add into a requestAnimationFrame would order it correctly
     too, but a tab loaded in the background never gets that frame and the
     seam would then never animate at all. Script order is the safe version. */
  gsap.ticker.add(function () { draw(); });

  /* the construction section is pinned, which adds its spacer to the document
     AFTER this file has run — so the page is taller than it was when the
     route was laid out. Re-measuring on every refresh covers that, the fonts
     landing, and any resize, all through one path. */
  ScrollTrigger.addEventListener('refresh', build);
})();
