import gsap from 'gsap';

/* ============================================================
   QUALITY — a frame-time governor for the full-screen shaders.

   There are no frame caps anywhere: every loop runs at the panel's own
   rate. What keeps that rate is this. It watches the real frame interval
   on the device and, when frames start dropping, lowers the resolution
   the WebGL layers (ice sheet, hero smoke) render at; when there is
   headroom again it raises it back. Both are soft images, so a lower
   buffer is far less visible than a stutter.

   quality() -> 1 (full) ... 0.5 (floor). Consumers read it at draw time
   and resize their buffer right before drawing, so a change never shows
   a cleared frame.
   ============================================================ */

const LEVELS = [1, 0.85, 0.72, 0.6, 0.5];
let step = 0;

/* the panel's frame interval, estimated from the fastest recent frames —
   60, 90, 120 or 144Hz, whatever this screen and browser actually give */
const hist = new Float32Array(90);
let hi = 0;
let filled = 0;
let interval = 1000 / 60;

/* dropped-frame pressure, and how long it has been calm */
let slowEMA = 0;
let calmMs = 0;
let coolMs = 0;
const BASE_WAIT = 1500;
let upWait = BASE_WAIT;
let sinceUp = Infinity;

export const quality = () => LEVELS[step];

gsap.ticker.add((_t, dt) => {
  /* tab switches, hidden pages and the first frames after them say
     nothing about rendering cost */
  if (!dt || dt > 250 || document.hidden) return;

  hist[hi] = dt;
  hi = (hi + 1) % hist.length;
  if (filled < hist.length) { filled++; return; }
  if (hi % 30 === 0) {
    const s = Array.from(hist).sort((a, b) => a - b);
    interval = s[Math.floor(s.length * 0.1)];
  }

  /* a frame that took 1.5 intervals or more is a dropped frame */
  const slow = dt > interval * 1.5 ? 1 : 0;
  slowEMA += (slow - slowEMA) * 0.06;
  coolMs = Math.max(0, coolMs - dt);

  sinceUp += dt;
  if (slowEMA > 0.25 && coolMs === 0 && step < LEVELS.length - 1) {
    step++;
    slowEMA = 0.1;
    calmMs = 0;
    /* give the new size a moment to show its effect before judging it.
       A level that fails right after being restored really is too much
       for this phone, so wait longer before trying it again; a one-off
       hitch (a load, a tab switch) doesn't count against it. */
    coolMs = 600;
    upWait = sinceUp < 3000 ? Math.min(upWait * 2, 20000) : BASE_WAIT;
    return;
  }

  calmMs = slowEMA < 0.02 ? calmMs + dt : 0;
  if (calmMs > upWait && step > 0) {
    step--;
    calmMs = 0;
    coolMs = 600;
    sinceUp = 0;
  }
});
