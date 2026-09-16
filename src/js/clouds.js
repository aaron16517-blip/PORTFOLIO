import gsap from 'gsap';
import { isLowPower, isTouch } from './device.js';

/* ============================================================
   Interactive red smoke — a single full-screen WebGL quad.

   Domain-warped fBm noise (the Inigo Quilez pattern) drifting
   upward. Rendered at a fraction of device resolution because smoke
   is soft — the browser's own scaling does the rest and it costs
   almost nothing.

   Deliberately NOT cursor-reactive: the hooks are marked below if
   pointer interaction gets added back later.

   createClouds(canvas) -> { ignite, destroy }
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

  /* --- colour: near-black -> ember -> hot core --- */
  vec3 deep  = vec3(0.026, 0.025, 0.026);
  vec3 ember = vec3(0.52, 0.055, 0.035);
  vec3 hot   = vec3(1.0, 0.33, 0.10);

  vec3 pale  = vec3(1.0, 0.94, 0.90);

  vec3 col = mix(deep, ember, smoothstep(0.0, 0.62, d));
  col = mix(col, hot, smoothstep(0.62, 1.0, d) * 0.55);
  /* just a breath of white where the smoke burns hottest */
  col = mix(col, pale, smoothstep(0.86, 1.0, d) * 0.2);
  col += vec3(0.2, 0.04, 0.018) * pow(length(q), 2.0) * 0.22 * mask;

  /* --- vignette + dither so the gradients don't band --- */
  float vig = smoothstep(1.6, 0.15, length((uv - 0.5) * vec2(1.08, 1.0)) * 1.65);
  col *= vig;
  col += (hash(gl_FragCoord.xy + uTime) - 0.5) * 0.014;

  gl_FragColor = vec4(col * uIntro, 1.0);
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
    alpha: false,
    powerPreference: 'high-performance'
  });

  /* no WebGL: the CSS gradient underneath is the fallback */
  if (!gl) {
    canvas.style.display = 'none';
    return { ignite() {}, destroy() {} };
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
    return { ignite() {}, destroy() {} };
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

  /* the smoke drifts slowly, so phones draw every other frame */
  const FRAME_MS = isLowPower ? 1000 / 30 : 0;
  let sinceDraw = 0;

  const state = { intro: 0 };
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
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  gsap.ticker.add(render);

  return {
    /* fade the smoke up — called when the curtain lifts */
    ignite(duration = 2.4) {
      gsap.to(state, { intro: 1, duration, ease: 'power2.out' });
    },
    destroy() {
      gsap.ticker.remove(render);
      window.removeEventListener('resize', resize);
    }
  };
}
