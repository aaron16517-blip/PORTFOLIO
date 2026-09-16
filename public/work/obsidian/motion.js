/* ============================================================
   OBSIDIAN — scroll motion
   Same stack and same approach as the reference project: Lenis
   smoothing the page, ScrollTrigger pinning a section, and every
   value derived from self.progress through lerp + mapRange.
   Loaded from a CDN because there is no bundler on this machine.
   ============================================================ */
(function () {
  'use strict';

  if (!window.gsap || !window.ScrollTrigger || !window.Lenis) {
    console.warn(
      '[obsidian] scroll animation OFF — a library failed to load from the CDN. ' +
      'gsap:' + typeof window.gsap +
      ' ScrollTrigger:' + typeof window.ScrollTrigger +
      ' Lenis:' + typeof window.Lenis +
      ' — check the Network tab for blocked requests to cdn.jsdelivr.net.'
    );
    return;
  }

  gsap.registerPlugin(ScrollTrigger);
  var hasSplit = !!window.SplitText;
  if (hasSplit) gsap.registerPlugin(SplitText);

  /* honour the OS setting — but allow ?motion=on to preview it regardless,
     because some embedded/preview browsers report "reduce" unconditionally */
  var forced = true;  /* hosted build: motion is always on — the OS
     'animation effects: off' setting reports prefers-reduced-motion and
     would otherwise kill the whole scroll animation. */
  if (matchMedia('(prefers-reduced-motion: reduce)').matches && !forced) {
    console.warn(
      '[obsidian] scroll animation OFF — this browser reports ' +
      'prefers-reduced-motion: reduce. Add ?motion=on to the URL to preview it anyway.'
    );
    return;
  }
  console.info('[obsidian] scroll animation ON' + (forced ? ' (forced via ?motion=on)' : ''));

  /* ---------- Lenis ----------
     ?lenis=off falls back to native scrolling while keeping the scrub, so a
     "does it feel smooth" problem can be told apart from a paint problem */
  var lenis = null;
  if (new URLSearchParams(location.search).get('lenis') !== 'off') {
    lenis = new Lenis();
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  } else {
    console.info('[obsidian] Lenis disabled — native scrolling, scrub still active');
  }

  /* Lenis owns the page scroll now, so anchors have to go through it */
  if (lenis) document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    var id = a.getAttribute('href');
    if (!id || id.length < 2) return;
    a.addEventListener('click', function (e) {
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -20 });
    });
  });

  /* ---------- helpers, straight from the reference ---------- */
  var lerp = function (from, to, t) { return from + (to - from) * t; };
  var mapRange = function (value, start, end) {
    return gsap.utils.clamp(0, 1, (value - start) / (end - start));
  };

  /* ---------- [01] hero — dolly in, hand off ----------
     A camera push rather than the construction section's pull-back. Everything
     scales about the figure's centre and accelerates by distance, so the type
     and rocks sweep past the lens while the figure holds — then the hero
     dissolves and the next section is already arriving underneath.

     Deliberately NOT pinned: pinning the first screen makes a page feel stuck
     on load, and letting the hero scroll away is what makes it "land".

     Same folded-transform trick as the cards — a group zoom is each child
     scaled and pushed out by its offset from the origin, so no parent scales
     and nothing leaves the compositor. */
  var heroGrid = document.querySelector('.hero__grid');
  if (heroGrid && window.innerWidth > 820) {
    /* plates.js inserts a cut-out beside each plate carrying the same
       classes, so these selectors collect the pairs together and every plate
       and its cut-out get one identical transform — which is the only way
       they stay registered while the dolly scales them. .model is split
       because the measurement below wants the real plate, not its shadow. */
    var heroModel = heroGrid.querySelector('.model:not(.occ)');
    var heroModels = gsap.utils.toArray('.hero__grid .model');
    var heroRocks = gsap.utils.toArray('.hero__grid .rock');
    var heroType = gsap.utils.toArray('.hero__grid .display');
    var heroMeta = gsap.utils.toArray(
      '.swatches, .hero__est, .hero__scroll, .hero__note, .hero__stat, .hero .badge'
    );

    var heroZoomEls = heroRocks.concat(heroType);

    function measureHero() {
      /* the figure is centred by its own translate, so the zoom origin is the
         grid's horizontal centre and the figure's optical centre vertically */
      var ox = heroGrid.offsetWidth * 0.5;
      var oy = heroGrid.offsetHeight * 0.5 +
               (heroModel ? heroModel.offsetHeight * 0.05 : 0);
      heroZoomEls.forEach(function (el) {
        el._dx = el.offsetLeft + el.offsetWidth / 2 - ox;
        el._dy = el.offsetTop + el.offsetHeight / 2 - oy;
      });
    }
    measureHero();
    ScrollTrigger.addEventListener('refreshInit', measureHero);

    /* These elements carry .rv, whose CSS sets `transition: transform 1s,
       opacity 1s` for the load-in reveal. Left in place it fights the scrub —
       every per-frame transform gets eased over a second, smearing the zoom
       into mush. Drop the transitions the moment the user actually scrolls,
       so the reveal still plays on load but the scrub is exact. */
    var freed = false;
    function freeTransitions() {
      if (freed) return;
      freed = true;
      [heroGrid].concat(heroModels, heroZoomEls, heroMeta).forEach(function (el) {
        if (el) el.style.transition = 'none';
      });
    }

    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      /* no scrub: Lenis already smooths the scroll, and a scrub tween on top
         of it double-smooths and reads as lag. progress tracks 1:1. */
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;
        if (p > 0) freeTransitions();

        /* The plate and the rocks dissolve individually rather than through a
           fade on their container. Dropping .hero__grid below opacity 1 makes
           it a stacking context, which ISOLATES the multiply on these
           children — they stop seeing the wall behind them and their white
           ground slams in as solid rectangles. An element's own opacity does
           not isolate its own blending, so fading each one is safe. */
        var exit = 1 - mapRange(p, 0.55, 0.92);

        /* The figure is what you push toward, so it grows least. Its centring
           now lives on the CSS `translate` property, which composes ahead of
           transform — so scale is all this needs to touch. */
        gsap.set(heroModels, { scale: lerp(1, 1.5, p), opacity: exit });

        /* rocks read as nearer the lens: bigger scale, thrown further out */
        var rz = lerp(1, 2.15, p);
        heroRocks.forEach(function (el) {
          gsap.set(el, {
            x: el._dx * (rz - 1), y: el._dy * (rz - 1), scale: rz, opacity: exit
          });
        });

        /* the headline passes the camera fastest and clears out first */
        var tz = lerp(1, 2.6, p);
        var typeFade = 1 - mapRange(p, 0.05, 0.5);
        heroType.forEach(function (el) {
          gsap.set(el, {
            x: el._dx * (tz - 1), y: el._dy * (tz - 1),
            scale: tz, opacity: typeFade
          });
        });

        /* the small print just steps aside */
        gsap.set(heroMeta, { opacity: 1 - mapRange(p, 0, 0.28) });
      }
    });
  }

  /* ---------- [02] atelier — depth parallax ----------
     A third idiom on purpose: the hero is a dolly-in, construction is a pinned
     stagger, so this one simply travels. Three elements move at three rates as
     the section crosses the viewport — the aside barely, the feature card
     more, the bleeding peek card most, with a little lateral drift so it
     opens off the right edge. No pin, no scrub: it just breathes past. */
  var atelier = document.querySelector('.statement');
  if (atelier && window.innerWidth > 820) {
    var atAside = atelier.querySelector('.statement__aside');
    var atFeature = atelier.querySelector('.feature:not(.feature--peek)');
    var atPeek = atelier.querySelector('.feature--peek');
    var atLayers = [atAside, atFeature, atPeek].filter(Boolean);

    /* .feature carries .rv, whose 1s transform transition would ease every
       per-frame write and smear the parallax — same trap as the hero */
    var atFreed = false;
    function atFree() {
      if (atFreed) return;
      atFreed = true;
      atLayers.forEach(function (el) { el.style.transition = 'none'; });
    }

    ScrollTrigger.create({
      trigger: '.statement',
      start: 'top bottom',
      end: 'bottom top',
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        /* -1 entering, 0 centred, +1 leaving — so the drift is symmetrical
           about the moment the section is squarely in view */
        var d = (self.progress - 0.5) * 2;
        if (d !== -1) atFree();

        if (atAside) gsap.set(atAside, { y: d * -28 });
        if (atFeature) gsap.set(atFeature, { y: d * -68 });
        if (atPeek) gsap.set(atPeek, { y: d * -124, x: d * 34 });
      }
    });
  }

  /* ---------- [03] index — masked line reveal ----------
     A fourth idiom on purpose. Nothing travels through space here: the
     section TYPESETS itself. Each hairline wipes in from the left and its
     name rises out from behind it, one row after the next, so the list
     appears to draw itself line by line — which is what an index should do.
     Distinct from the dolly, the drift and the pinned stagger, and it costs
     almost nothing: three transforms and four custom properties a frame.

     The hidden start state is set from JS, never from CSS. If this file bails
     out — reduced motion, a blocked CDN, a narrow viewport — the rows have to
     still be readable, and CSS that hides them would strand them. */
  var idxList = document.querySelector('.index__list');
  if (idxList && window.innerWidth > 820) {
    var idxRows = gsap.utils.toArray('.index__list .row');
    /* eased by hand rather than by a tween: the value is read straight off
       scroll progress, so the curve has to be applied to the progress itself */
    var outCurve = gsap.parseEase('power3.out');

    idxRows.forEach(function (row) {
      /* the rows keep .rv so the fallback paths — reduced motion, no CDN,
         mobile — still get the plain load reveal. On desktop this block owns
         them instead, and the two together would fade the row in as a slab
         while its name was still masked. script.js's observer has already
         captured these nodes, but .in on its own styles nothing. */
      row.classList.remove('rv', 'rv-1', 'rv-2', 'rv-3');
      row._name = row.querySelector('.row__name');
      row._meta = row.querySelectorAll('.row__n, .row__c');
    });

    gsap.set(idxList, { '--rule-t': 0 });
    idxRows.forEach(function (row) {
      gsap.set(row, { '--rule-t': 0 });
      gsap.set(row._name, { yPercent: 105 });
      gsap.set(row._meta, { opacity: 0 });
    });

    var ROW_STEP = 0.15;   /* offset from one row to the next */
    var ROW_RUN = 0.46;    /* how long a single row takes to set itself */

    function drawIndex(p) {
      /* beat zero — the top edge of the table, before any row */
      gsap.set(idxList, { '--rule-t': outCurve(mapRange(p, 0, 0.26)) });

      idxRows.forEach(function (row, i) {
        var start = 0.08 + i * ROW_STEP;
        /* the rule finishes first, so the name is always rising out from
           under a line that is already drawn */
        gsap.set(row, { '--rule-t': outCurve(mapRange(p, start, start + ROW_RUN * 0.62)) });
        gsap.set(row._name, { yPercent: lerp(105, 0, outCurve(mapRange(p, start, start + ROW_RUN))) });
        gsap.set(row._meta, { opacity: mapRange(p, start + 0.14, start + ROW_RUN) });
      });
    }

    var idxST = ScrollTrigger.create({
      trigger: '.index__list',
      start: 'top 88%',
      end: 'top 34%',
      invalidateOnRefresh: true,
      onUpdate: function (self) { drawIndex(self.progress); }
    });
    /* a reload part-way down the page restores scroll before this runs, and
       ScrollTrigger only fires onUpdate on a CHANGE — so seed it once */
    drawIndex(idxST.progress);
  }

  /* ---------- [05] construction ---------- */
  var section = document.querySelector('.construct');
  if (!section) return;

  var cardEls = gsap.utils.toArray('.ccard');
  var ctaEl = section.querySelector('.construct__cta');
  /* the CTA rides the same stagger as a fourth beat, so it arrives with the
     cards instead of popping in unanimated */
  var cards = cardEls.concat(ctaEl ? [ctaEl] : []);

  /* headline word-by-word, like the reference's hero header */
  var words = [];
  if (hasSplit) {
    words = SplitText.create('#construct-head', { type: 'words', wordsClass: 'word' }).words;
  }

  var fadeTargets = words.slice();
  gsap.set(fadeTargets, { opacity: 0 });
  gsap.set(cards, { opacity: 0 });

  var wordStep = fadeTargets.length ? (0.42 - 0.04) / fadeTargets.length : 0;
  var wordDuration = wordStep * 3;

  var stack = section.querySelector('.cstack');
  var inner = section.querySelector('.construct__inner');

  var CARD_START = 0.20;   /* first card begins once the headline has landed */
  var CARD_STEP = 0.14;    /* stagger between cards */
  var CARD_RUN = 0.30;     /* how long each card takes to arrive */

  /* The pull-back used to be a scale() on .cstack. That is expensive: the
     cards inside it are themselves animating every frame, so the browser had
     to re-rasterise the whole text-filled container at a NEW scale on every
     frame — glyphs and all. Instead, fold the group scale into each card's
     own transform. Scaling a group about a point is equivalent to scaling
     each child and translating it by its offset from that point, so this is
     visually identical but stays on the compositor.
     offsetLeft/offsetTop are layout values, unaffected by transforms. */
  function measureOffsets() {
    var ox = stack.offsetWidth * 0.5;
    var oy = stack.offsetHeight * 0.42;   /* matches .cstack transform-origin */
    cardEls.forEach(function (card) {
      var cx = (card.offsetLeft - stack.offsetLeft) + card.offsetWidth / 2;
      var cy = (card.offsetTop - stack.offsetTop) + card.offsetHeight / 2;
      card._dx = cx - ox;
      card._dy = cy - oy;
    });
  }
  measureOffsets();
  ScrollTrigger.addEventListener('refreshInit', measureOffsets);

  /* pinning a section on a phone fights the address-bar resize, so the
     scrubbed version is desktop-only and mobile just shows the content */
  var mm = gsap.matchMedia();

  mm.add('(min-width: 821px)', function () {
    ScrollTrigger.create({
      trigger: '.construct',
      start: 'top top',
      /* function form so the pin length re-measures on resize */
      end: function () { return '+=' + window.innerHeight * 2; },
      pin: true,
      invalidateOnRefresh: true,
      onUpdate: function (self) {
        var p = self.progress;

        /* 1 — headline, word by word */
        fadeTargets.forEach(function (target, i) {
          var start = 0.04 + i * wordStep;
          gsap.set(target, { opacity: mapRange(p, start, start + wordDuration) });
        });

        /* 2 + 3 — the group pull-back and each card's own arrival, composed
           into ONE transform per card. No blur: filtering three large cards
           every frame is the most expensive thing in this loop and reads as
           judder on slower GPUs. Opacity and transform alone stay on the
           compositor and never repaint. */
        var s = lerp(1.16, 1, mapRange(p, 0, 0.82));
        cardEls.forEach(function (card, i) {
          var start = CARD_START + i * CARD_STEP;
          var t = mapRange(p, start, start + CARD_RUN);
          gsap.set(card, {
            opacity: t,
            x: card._dx * (s - 1),
            y: card._dy * (s - 1) + lerp(90, 0, t),
            scale: s * lerp(0.94, 1, t)
          });
        });

        /* 4 — the CTA sits outside the stack, so no group scale on it */
        if (ctaEl) {
          var ct = mapRange(p, CARD_START + 3 * CARD_STEP, CARD_START + 3 * CARD_STEP + CARD_RUN);
          gsap.set(ctaEl, { opacity: ct, y: lerp(90, 0, ct), scale: lerp(0.94, 1, ct) });
        }
      }
    });

    /* hand-off: the section drifts up and dims as the next one arrives,
       mirroring the reference's second trigger on .studio */
    ScrollTrigger.create({
      trigger: '.manifesto',
      start: 'top bottom',
      end: 'top top',
      scrub: true,
      onUpdate: function (self) {
        gsap.set(inner, {
          y: -12 * self.progress + '%',
          opacity: lerp(1, 0.25, self.progress)
        });
      }
    });
  });

  mm.add('(max-width: 820px)', function () {
    gsap.set(fadeTargets, { opacity: 1 });
    gsap.set(cards, { opacity: 1, y: 0, scale: 1, filter: 'none' });
  });

  /* the pin changes document height; re-measure once webfonts land, since
     the display face shifts the headline's height */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
})();
