import gsap from 'gsap';
import { isLowPower, isTouch } from './device.js';

/* ============================================================
   Ice smoke — a single full-screen WebGL quad, teal on frost white.

   Domain-warped fBm noise (the Inigo Quilez pattern) drifting
   upward. Rendered at a fraction of device resolution because smoke
   is soft — the browser's own scaling does the rest and it costs
   almost nothing.

   Deliberately NOT cursor-reactive: the hooks are marked below if
   pointer interaction gets added back later.

   createClouds(canvas) -> { ignite, setRise, destroy }

   setRise(0..1) is scroll-driven. The hero slides up over the last screen
   of Eden's dive, and while it does the canvas is see-through above a
   turbulent front: a wall of frost and smoke billows up from the bottom
   and swallows the dive. At 1 the canvas is fully opaque, as before.
   ============================================================ */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;

uniform vec2  uRes;
uniform float uTime;
uniform float uIntro;
uniform float uRise;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < OCTAVES; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;

  vec2 p = uv;
  p.x *= aspect;

  float t = uTime * 0.042;

  /* while rising, the whole field is carried up with the scroll */
  float lift = (1.0 - uRise) * 0.9;
  p.y -= lift;

  /* --- domain warp, drifting upward --- */
  vec2 q = vec2(fbm(p * 2.1 - vec2(0.0, t * 2.2)),
                fbm(p * 2.1 + vec2(5.2, 1.3) - vec2(0.0, t * 1.7)));

  vec2 r = vec2(fbm(p * 2.1 + 3.0 * q + vec2(1.7, 9.2) + t * 0.9),
                fbm(p * 2.1 + 3.0 * q + vec2(8.3, 2.8) + t * 0.7));

  float f = fbm(p * 2.1 + 3.2 * r);

  /* --- gather it into a rising plume, thin at the edges --- */
  float column = exp(-pow((uv.x - 0.5) * 2.0, 2.0) * 2.2);
  float rise   = smoothstep(-0.15, 0.95, uv.y);

  /* the floors keep the edges and corners alive instead of pure black */
  float mask = mix(0.18, 1.0, column) * mix(0.12, 1.0, rise);
  float density = f * mask;

  float d = clamp(density * 2.4 - 0.34, 0.0, 1.0);

  /* --- colour: frost white -> pale ice -> lake teal -> deep sea-glass ---
     GROUND must match --bg in base.css, or the hero shows its edge */
  vec3 ground = vec3(0.969, 0.980, 0.976);
  vec3 pale   = vec3(0.839, 0.929, 0.906);
  vec3 ice    = vec3(0.498, 0.769, 0.710);
  vec3 deep   = vec3(0.235, 0.545, 0.498);

  vec3 col = mix(ground, pale, smoothstep(0.0, 0.34, d));
  col = mix(col, ice,  smoothstep(0.22, 0.78, d));
  col = mix(col, deep, smoothstep(0.72, 1.0, d) * 0.6);

  /* the cracks: a thin contour of the same field, so the veins bend with
     the smoke instead of sitting on it like a texture. Only inside the ice —
     white lines on the white ground would just be noise. */
  float vein = pow(1.0 - abs(f * 2.0 - 1.0), 22.0) * smoothstep(0.18, 0.6, d);
  col = mix(col, vec3(1.0), vein * 0.6);
  /* light caught in the warp, as the reference's frosted streaks */
  col = mix(col, vec3(1.0), pow(length(q), 3.0) * 0.08 * mask);

  /* --- vignette falls off to the ground, not to black; dither so the
     gradients don't band --- */
  float vig = smoothstep(1.6, 0.15, length((uv - 0.5) * vec2(1.08, 1.0)) * 1.65);
  col = mix(ground, col, vig);

  /* the rising front: a line that climbs with uRise, pushed around by the
     smoke's own density so it arrives as billows, not a wipe */
  float front = mix(0.0, 1.9, uRise);
  float edge  = uv.y - (f - 0.5) * 1.1 - (q.x - 0.5) * 0.3;
  float shown = 1.0 - smoothstep(front - 0.34, front + 0.02, edge);
  /* the billows run thicker while they climb, then settle */
  float surge = sin(uRise * 3.14159) * 0.45;
  float body  = smoothstep(0.0, 0.8, d + surge * shown);
  col = mix(col, mix(pale, ice, body), surge * 0.8 * smoothstep(0.05, 0.4, d + surge * 0.3));
  /* a pale ice lip glows where the smoke meets the light */
  float lip = exp(-pow((edge - front + 0.1) / 0.08, 2.0)) * (1.0 - uRise * uRise);
  col = mix(col, ice, lip * 0.35);

  col = mix(ground, col, uIntro);
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.012;

  /* premultiplied: see-through above the front, solid once risen */
  /* and the top edge stays feathered until the hero has fully arrived,
     so its border never shows against the light it rises into */
  float feather = max(0.0, 0.6 * (1.0 - uRise));
  float top = 1.0 - smoothstep(1.0 - feather, 1.0, uv.y);
  float a = uRise > 0.999 ? 1.0 : clamp(shown * top, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}
`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createClouds(canvas) {
  const gl = canvas.getContext('webgl', {
    antialias: false,
    /* see-through while it rises over the end of Eden */
    alpha: true,
    powerPreference: 'high-performance'
  });

  /* no WebGL: the CSS gradient underneath is the fallback */
  if (!gl) {
    canvas.style.display = 'none';
    return { ok: false, ignite() {}, setRise() {}, destroy() {} };
  }

  /* fbm runs five times a pixel; the top octave is detail a phone's
     small, low-res buffer can't show anyway */
  const octaves = isLowPower ? 4 : 6;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, `#define OCTAVES ${octaves}\n` + FRAG);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    canvas.style.display = 'none';
    return { ok: false, ignite() {}, setRise() {}, destroy() {} };
  }
  gl.useProgram(program);

  /* one full-screen triangle pair */
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes   = gl.getUniformLocation(program, 'uRes');
  const uTime  = gl.getUniformLocation(program, 'uTime');
  const uIntro = gl.getUniformLocation(program, 'uIntro');
  const uRise  = gl.getUniformLocation(program, 'uRise');

  /* the ground colour, for any frame the shader has not drawn yet */
  gl.clearColor(0.969, 0.980, 0.976, 1);

  /* smoke is soft — render at a fraction of the real pixels.
     Phones: about half a CSS pixel, which on a 3x screen is a sixth of
     the real resolution and still reads the same once it's stretched. */
  const RENDER_SCALE = isLowPower ? 0.5 : 0.55;
  const DPR_CAP = isLowPower ? 1 : 2;
  let w = 0;
  let h = 0;
  let lastCssW = -1;
  let lastCssH = -1;

  const resize = () => {
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    /* A phone's address bar changes the height by a few percent on every
       scroll direction change. Reallocating the buffer for that drops a
       frame and changes nothing visible, so only a real resize counts. */
    if (isTouch && cssW === lastCssW && Math.abs(cssH - lastCssH) < cssH * 0.2) return;
    lastCssW = cssW;
    lastCssH = cssH;

    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP) * RENDER_SCALE;
    w = Math.max(1, Math.floor(cssW * dpr));
    h = Math.max(1, Math.floor(cssH * dpr));
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    /* a resized buffer is black until the next draw — paint it the ground
       so a paused (off-screen) hero never comes back as a black frame */
    gl.clear(gl.COLOR_BUFFER_BIT);
  };
  resize();
  window.addEventListener('resize', resize);

  /* pointer hook goes here if the smoke becomes interactive again */

  /* Nothing to draw once the hero has scrolled away or the tab is hidden.
     This used to run for the whole visit, a full-screen shader every frame
     behind sections that cover it. */
  let onScreen = true;
  new IntersectionObserver((entries) => {
    onScreen = entries[0].isIntersecting;
  }).observe(canvas);

  /* the smoke drifts slowly, so phones draw every other frame, and
     high-refresh desktop screens (120–165Hz) stop at 60 — the drift looks
     the same and the full-screen shader runs half as often or less */
  const FRAME_MS = isLowPower ? 1000 / 30 : 1000 / 60;
  let sinceDraw = 0;

  const state = { intro: 0, rise: 1 };
  let time = 0;

  const render = (_t, deltaMs) => {
    const dt = deltaMs || 16;
    time += dt / 1000;

    if (!onScreen || document.hidden) return;
    sinceDraw += dt;
    if (sinceDraw < FRAME_MS - 2) return;
    sinceDraw = 0;

    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, time);
    gl.uniform1f(uIntro, state.intro);
    gl.uniform1f(uRise, state.rise);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  gsap.ticker.add(render);

  return {
    ok: true,
    /* fade the smoke up — called when the curtain lifts */
    ignite(duration = 2.4) {
      gsap.to(state, { intro: 1, duration, ease: 'power2.out' });
    },
    /* scroll-linked: 0 = bare frost, 1 = the full plume */
    setRise(v) {
      state.rise = Math.min(1, Math.max(0, v));
    },
    destroy() {
      gsap.ticker.remove(render);
      window.removeEventListener('resize', resize);
    }
  };
}
