/* ============================================================
   THE MIND — a slowly turning sphere of connected nodes.

   Ported from the Apollo canvas on the ClinicOS case study and recoloured
   for this site: the mesh is the same near-white as the experience thread,
   and the signal that sweeps through it is the same red as the dot that
   rides that thread. Same two colours as everything else, so it reads as
   part of the page rather than as a widget dropped onto it.

   Pure canvas, no library. It stops drawing when it is off screen.
   ============================================================ */

import { isLowPower } from './device.js';

const TAU = Math.PI * 2;

export function initMind(canvas) {
  if (!canvas) return;
  const c = canvas.getContext('2d');
  if (!c) return;

  let W = 0, H = 0, DPR = 1, live = true, lastDraw = 0;

  /* ---------- a fibonacci sphere, so the nodes sit evenly ---------- */
  const N = 200;
  const P = new Float32Array(N * 3);
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * GA;
    P[i * 3]     = Math.cos(th) * r;
    P[i * 3 + 1] = y;
    P[i * 3 + 2] = Math.sin(th) * r;
  }

  /* short-range edges only, so it reads as a mesh and not a hairball */
  const E = [];
  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      const dx = P[i*3] - P[j*3];
      const dy = P[i*3+1] - P[j*3+1];
      const dz = P[i*3+2] - P[j*3+2];
      if (dx*dx + dy*dy + dz*dz < 0.078) E.push(i, j);
    }
  }

  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);

  const size = () => {
    const r = canvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { W = H = 0; return; }
    /* ~1000 hairline strokes a frame; at 3x a phone fills 9x the pixels
       for lines that are already a pixel wide */
    DPR = Math.min(window.devicePixelRatio || 1, isLowPower ? 1.5 : 2);
    W = Math.round(r.width);
    H = Math.round(r.height);
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
  };
  size();
  /* the observer already catches every size change that matters, and the
     window resize also fires for a phone's address bar */
  if (window.ResizeObserver) new ResizeObserver(size).observe(canvas);
  else window.addEventListener('resize', size);
  new IntersectionObserver((e) => { live = e[0].isIntersecting; }, { threshold: 0 }).observe(canvas);

  function frame(now) {
    requestAnimationFrame(frame);
    if (!live) return;
    if (!W || !H) { size(); return; }
    /* it turns at a fifth of a radian a second — 30fps is indistinguishable
       and halves the work while the phone is also scrolling */
    if (isLowPower && now - lastDraw < 31) return;
    lastDraw = now;

    const t = now * 0.001;
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    c.clearRect(0, 0, W, H);

    const cx = W * 0.5, cy = H * 0.5;
    const R  = Math.min(W, H) * 0.34;
    const ay = t * 0.20;                          /* yaw */
    const ax = -0.30 + Math.sin(t * 0.29) * 0.1;  /* a gentle nod */
    const ca = Math.cos(ay), sa = Math.sin(ay);
    const cb = Math.cos(ax), sb = Math.sin(ax);

    for (let i = 0; i < N; i++) {
      const x0 = P[i*3], y0 = P[i*3+1], z0 = P[i*3+2];
      const x1 =  x0 * ca + z0 * sa;
      const z1 = -x0 * sa + z0 * ca;
      const y2 =  y0 * cb - z1 * sb;
      const z2 =  y0 * sb + z1 * cb;
      const persp = 2.6 / (2.6 - z2);
      px[i] = cx + x1 * R * persp;
      py[i] = cy + y2 * R * persp;
      pz[i] = z2;
    }

    /* a signal sweeping back to front, like a thought crossing the mesh */
    const phase = ((t * 0.30) % 1) * 2 - 1;

    /* ---------- edges ---------- */
    c.lineWidth = 1;
    for (let k = 0; k < E.length; k += 2) {
      const i = E[k], j = E[k + 1];
      const zm = (pz[i] + pz[j]) * 0.5;
      const depth = (zm + 1) * 0.5;               /* 0 back .. 1 front */
      const dz = zm - phase;
      const pulse = Math.exp(-(dz * dz) / 0.012);
      const a = 0.025 + depth * 0.075 + pulse * 0.30;
      /* near-white at rest, the accent red where the signal is */
      c.strokeStyle = 'rgba(' + Math.round(243 - pulse * 19) + ','
                              + Math.round(244 - pulse * 187) + ','
                              + Math.round(246 - pulse * 183) + ','
                              + a.toFixed(3) + ')';
      c.beginPath();
      c.moveTo(px[i], py[i]);
      c.lineTo(px[j], py[j]);
      c.stroke();
    }

    /* ---------- nodes ---------- */
    for (let i = 0; i < N; i++) {
      const depth = (pz[i] + 1) * 0.5;
      const dz = pz[i] - phase;
      const pulse = Math.exp(-(dz * dz) / 0.012);
      const rad = 0.6 + depth * 1.3 + pulse * 1.6;
      c.fillStyle = 'rgba(' + Math.round(243 - pulse * 19) + ','
                            + Math.round(244 - pulse * 187) + ','
                            + Math.round(246 - pulse * 183) + ','
                            + (0.09 + depth * 0.22 + pulse * 0.42).toFixed(3) + ')';
      c.beginPath();
      c.arc(px[i], py[i], rad, 0, TAU);
      c.fill();
    }

    /* ---------- the core ---------- */
    const core = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9);
    core.addColorStop(0,   'rgba(224,57,63,0.13)');
    core.addColorStop(0.5, 'rgba(224,57,63,0.05)');
    core.addColorStop(1,   'rgba(224,57,63,0)');
    c.fillStyle = core;
    c.beginPath();
    c.arc(cx, cy, R * 0.9, 0, TAU);
    c.fill();

    /* ---------- two lazy orbit rings ---------- */
    for (let k = 0; k < 2; k++) {
      const tilt = 0.34 + k * 0.5;
      const rr = R * (1.26 + k * 0.24);
      c.strokeStyle = 'rgba(243,244,246,' + (0.09 - k * 0.035) + ')';
      c.lineWidth = 1;
      c.save();
      c.translate(cx, cy);
      c.rotate(Math.sin(t * (0.11 + k * 0.05)) * 0.5 + k * 0.7);
      c.beginPath();
      c.ellipse(0, 0, rr, rr * tilt, 0, 0, TAU);
      c.stroke();
      c.restore();
    }
  }

  requestAnimationFrame(frame);
}
