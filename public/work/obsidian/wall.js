/* ============================================================
   OBSIDIAN — wall baker
   The concrete wall is six background layers, two of them large SVG noise
   tiles composited through `overlay` and `soft-light`. That is correct but
   expensive: every time the layer is invalidated the browser re-runs all six
   layers and both blend modes across the whole viewport, which measurably
   drops frames while scrolling.

   Nothing about it is dynamic, so it only ever needs computing once. This
   draws the identical stack into a canvas — canvas supports the same two
   blend modes natively — and swaps the result in as ONE flat bitmap. Same
   pixels, one layer, no per-frame blending.

   Falls back silently to the CSS version if anything goes wrong.
   ============================================================ */
(function () {
  'use strict';

  var wall = document.querySelector('.wall');
  if (!wall || !window.URL || !URL.createObjectURL) return;

  var css = getComputedStyle(document.documentElement);
  function urlOf(prop) {
    var m = css.getPropertyValue(prop).trim().match(/url\((['"]?)(.*?)\1\)/);
    return m ? m[2] : null;
  }
  function load(src) {
    return new Promise(function (res, rej) {
      var img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = src;
    });
  }

  function bake() {
    var w = Math.max(320, window.innerWidth);
    var h = Math.max(320, window.innerHeight);
    /* the wall is soft noise, so 1.5x is visually identical to 2x but the
       GPU texture is ~44% smaller — less compositor memory pressure, which
       is where smoothness lives once the main thread is already clean */
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

    return Promise.all([urlOf('--grain'), urlOf('--speckle'), urlOf('--blotch')].map(function (u) {
      return u ? load(u) : Promise.reject(new Error('missing noise layer'));
    })).then(function (imgs) {
      var grain = imgs[0], speckle = imgs[1], blotch = imgs[2];
      var c = document.createElement('canvas');
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      var ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);

      /* bottom-up, mirroring the CSS stack (last-listed layer paints first) */
      ctx.fillStyle = css.getPropertyValue('--wall-base').trim() || '#8f8d88';
      ctx.fillRect(0, 0, w, h);

      function tile(img, size, mode) {
        ctx.globalCompositeOperation = mode;
        var p = ctx.createPattern(img, 'repeat');
        ctx.save();
        /* CSS positions these tiles centred, so match the phase */
        var ox = (w % size) / 2 - size, oy = (h % size) / 2 - size;
        ctx.translate(ox, oy);
        ctx.fillStyle = p;
        ctx.fillRect(0, 0, w + size * 2, h + size * 2);
        ctx.restore();
      }
      tile(blotch, 1600, 'soft-light');
      tile(speckle, 600, 'soft-light');
      tile(grain, 200, 'overlay');

      ctx.globalCompositeOperation = 'source-over';

      /* the board-form seam lines */
      ctx.fillStyle = 'rgba(0,0,0,.05)';
      for (var x = 372; x < w; x += 374) ctx.fillRect(x, 0, 2, h);

      /* the two lighting gradients — CSS radial-gradient is an ellipse,
         canvas gradients are circular, so squash the context to match */
      ctx.save();
      ctx.translate(w * 0.5, h * 1.16);
      ctx.scale(1, (h * 0.98) / (w * 1.35));
      var gd = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.35);
      gd.addColorStop(0, 'rgba(0,0,0,.46)');
      gd.addColorStop(0.62, 'rgba(0,0,0,0)');
      gd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gd;
      ctx.fillRect(-w * 2, -h * 4, w * 4, h * 8);
      ctx.restore();

      ctx.save();
      ctx.translate(w * 0.5, h * -0.10);
      ctx.scale(1, (h * 0.74) / (w * 1.12));
      var gl = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 1.12);
      gl.addColorStop(0, 'rgba(255,255,255,.24)');
      gl.addColorStop(0.56, 'rgba(255,255,255,0)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(-w * 2, -h * 4, w * 4, h * 8);
      ctx.restore();

      return new Promise(function (res) {
        c.toBlob(function (blob) { res(blob ? URL.createObjectURL(blob) : c.toDataURL()); }, 'image/png');
      });
    });
  }

  var current = null;
  function apply() {
    bake().then(function (url) {
      if (current) URL.revokeObjectURL(current);
      current = url;
      /* one flat layer, no blending — both the wall and the badge cut-out
         patch read from the same variable so they stay in register */
      document.documentElement.style.setProperty('--wall-baked', 'url("' + url + '")');
      document.documentElement.classList.add('wall-baked');
    }).catch(function (err) {
      console.warn('[obsidian] wall bake skipped, keeping the CSS version —', err && err.message);
    });
  }

  apply();

  var t;
  addEventListener('resize', function () {
    clearTimeout(t);
    t = setTimeout(apply, 250);
  });
})();
