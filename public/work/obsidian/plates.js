/* ============================================================
   OBSIDIAN — plate cut-outs
   The hero's figure and rocks are not cut-out images. They are crops of one
   white-ground plate, dissolved into the wall with mix-blend-mode:multiply —
   which is what makes them sit ON the concrete instead of on top of it.

   The catch is that multiply is a function of what is BEHIND the plate. It
   cannot occlude anything: whatever is painted underneath comes through it.
   So the seam read as a line drawn ACROSS the rocks rather than passing
   behind them, and no amount of z-index fixes that — the plates simply are
   not opaque.

   This gives each plate an opaque cut-out to stand on. For every plate it
   inserts a sibling underneath, filled with wall colour, and masks it to the
   plate's own silhouette. The result:

     seam            painted at z-index -1
     cut-out         opaque wall, rock-shaped — hides the seam
     plate           multiplies against the wall, exactly as before

   Where the plate is rock, the cut-out is opaque, so the seam is hidden and
   the plate multiplies against clean wall — pixel for pixel what it did
   before. Where the plate is white ground, the cut-out is transparent, the
   plate multiplies to a no-op, and the seam shows through. Which is the
   whole point: the line goes behind the objects, not behind the wall.

   Degrades quietly. If the matte cannot be built the cut-outs stay hidden and
   the hero looks exactly as it did before this file existed.
   ============================================================ */
(function () {
  'use strict';

  var grid = document.querySelector('.hero__grid');
  if (!grid || !window.URL || !URL.createObjectURL) return;

  var PLATE = 'assets/models/model-01.png';

  /* the plates carry filter:brightness(1.45) contrast(1.02), which is what
     lifts the source's near-white ground to true white. The matte has to see
     the same pixels the eye does, so it gets the same filter. */
  var PLATE_FILTER = 'brightness(1.45) contrast(1.02)';

  /* luminance either side of the ground edge, 0-255. Above HI is ground and
     drops out; below LO is object and is kept; between the two is a ramp, so
     the cut-out's edge is as soft as the plate's own antialiasing. */
  var LO = 236, HI = 253;

  /* ---------- 1. the cut-outs, inserted synchronously ----------
     Before script.js runs, so its reveal observer picks them up with
     everything else and they rise on the same beat as the plate they back. */
  var pairs = [];

  function addCutout(plate) {
    var occ = document.createElement('i');
    /* same classes, so every rule that positions the plate positions this
       identically — no second copy of the geometry to keep in step */
    occ.className = plate.className + ' occ';
    occ.setAttribute('aria-hidden', 'true');
    plate.parentNode.insertBefore(occ, plate);
    pairs.push({ plate: plate, occ: occ });
    /* motion.js drives the pair together through this */
    plate.__occ = occ;
    return occ;
  }

  var model = grid.querySelector('.model');
  Array.prototype.forEach.call(grid.querySelectorAll('.rock'), addCutout);
  if (model) addCutout(model);

  /* ---------- 2. mask geometry ----------
     Each plate shows a different window onto the same source image. The rocks
     say so in background-size/background-position; the model says so through
     the offsets of its <img>. Read whichever applies and hand the same window
     to the mask, so the silhouette lands exactly over the pixels it came from. */
  function windowOf(plate) {
    if (plate === model) {
      var img = plate.querySelector('img');
      if (!img) return null;
      return {
        size: img.offsetWidth + 'px auto',
        pos: img.offsetLeft + 'px ' + img.offsetTop + 'px'
      };
    }
    var cs = getComputedStyle(plate);
    return { size: cs.backgroundSize, pos: cs.backgroundPosition };
  }

  /* .model carries four white patches that blank rock fragments its crop cut
     in half. Those areas read as plain wall in the finished plate, but the
     matte still sees rock there, so the cut-out would hide the seam behind
     four shapes that are not visibly there.

     They get their own matte with the patches cleared, rather than a
     mask-composite:subtract layer — subtract keeps the source where it falls
     OUTSIDE the destination, which is the reverse of cutting a hole and
     showed up as a pale rectangle across the figure. The patches and the
     plate are both placed by percentages of the model box, so their footprint
     in the source image never changes and this is a one-off. */
  function patchRects() {
    if (!model) return [];
    var img = model.querySelector('img');
    if (!img || !img.naturalWidth) return [];
    var scale = img.offsetWidth / img.naturalWidth;
    if (!(scale > 0)) return [];
    return Array.prototype.map.call(model.querySelectorAll('.mpatch'), function (r) {
      return {
        x: (r.offsetLeft - img.offsetLeft) / scale,
        y: (r.offsetTop - img.offsetTop) / scale,
        w: r.offsetWidth / scale,
        h: r.offsetHeight / scale
      };
    });
  }

  var matteUrl = null;
  var modelMatteUrl = null;

  function applyMask(pair) {
    var url = pair.plate === model ? (modelMatteUrl || matteUrl) : matteUrl;
    if (!url) return;
    var w = windowOf(pair.plate);
    if (!w) return;

    var st = pair.occ.style;
    st.maskImage = st.webkitMaskImage = 'url("' + url + '")';
    st.maskPosition = st.webkitMaskPosition = w.pos;
    st.maskSize = st.webkitMaskSize = w.size;
    st.maskRepeat = st.webkitMaskRepeat = 'no-repeat';
    pair.occ.classList.add('is-ready');
  }

  function applyAll() { pairs.forEach(applyMask); }

  /* ---------- 3. the matte ----------
     One pass over the source at load, the same shape of job wall.js does.
     Alpha only: CSS reads a PNG mask through its alpha channel, so the colour
     written here never matters. */
  function buildMatte() {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = PLATE;
    }).then(function (img) {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      var ctx = c.getContext('2d', { willReadFrequently: false });
      ctx.filter = PLATE_FILTER;
      ctx.drawImage(img, 0, 0);
      ctx.filter = 'none';

      var d = ctx.getImageData(0, 0, c.width, c.height);
      var p = d.data;
      for (var i = 0; i < p.length; i += 4) {
        var lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
        var a = lum >= HI ? 0 : lum <= LO ? 255 : Math.round(255 * (HI - lum) / (HI - LO));
        p[i] = p[i + 1] = p[i + 2] = 0;
        p[i + 3] = a;
      }
      ctx.putImageData(d, 0, 0);

      function toUrl(cv) {
        return new Promise(function (res) {
          cv.toBlob(function (b) { res(b ? URL.createObjectURL(b) : cv.toDataURL()); }, 'image/png');
        });
      }

      var holes = patchRects();
      if (!holes.length) return toUrl(c).then(function (u) { return [u, null]; });

      var m = document.createElement('canvas');
      m.width = c.width;
      m.height = c.height;
      m.getContext('2d').drawImage(c, 0, 0);
      var mctx = m.getContext('2d');
      holes.forEach(function (h) { mctx.clearRect(h.x, h.y, h.w, h.h); });

      return Promise.all([toUrl(c), toUrl(m)]);
    });
  }

  buildMatte().then(function (urls) {
    matteUrl = urls[0];
    modelMatteUrl = urls[1];
    applyAll();
  }).catch(function (err) {
    console.warn('[obsidian] plate cut-outs skipped, the seam will show through the hero plates —',
                 err && err.message);
  });

  /* the windows are in px and every one of them moves with the viewport */
  var t;
  addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(applyAll, 180);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyAll);
})();
