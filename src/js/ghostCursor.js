import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

/* ============================================================
   GHOST CURSOR

   A vanilla port of the React Bits GhostCursor component — same
   approach as textPressure.js, because there is no React in this
   project. The React version's refs become closure variables and
   its effect body becomes the body of this factory; the shaders,
   the trail ring buffer and the pass chain are unchanged.

   createGhostCursor(host, options) -> { destroy }

   `host` is an absolutely-positioned element inside the section the
   cursor should track. The pointer is read on window and tested against
   host.parentElement's rect, so the trail follows it across the whole
   section — including over fixed UI that sits above the section but
   lives outside it in the DOM.

   Cost control, all inherited from the original:
     - the render loop only runs while the pointer is active or the
       trail is still fading; once it is invisible the loop stops
       dead rather than idling at 60fps;
     - devicePixelRatio is capped, and resolution is scaled down
       further to stay under a pixel budget.

   Like the rest of the site, this always runs the full motion.
   ============================================================ */

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG = `
  uniform float iTime;
  uniform vec3  iResolution;
  uniform vec2  iMouse;
  uniform vec2  iPrevMouse[MAX_TRAIL_LENGTH];
  uniform float iOpacity;
  uniform float iScale;
  uniform float iRadius;
  uniform vec3  iBaseColor;
  uniform float iBrightness;
  uniform float iEdgeIntensity;
  varying vec2  vUv;

  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453123); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f *= f * (3. - 2. * f);
    return mix(mix(hash(i + vec2(0.,0.)), hash(i + vec2(1.,0.)), f.x),
               mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0;
    float a = 0.5;
    mat2 m = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for(int i=0;i<5;i++){
      v += a * noise(p);
      p = m * p * 2.0;
      a *= 0.5;
    }
    return v;
  }
  vec3 tint1(vec3 base){ return mix(base, vec3(1.0), 0.15); }
  vec3 tint2(vec3 base){ return mix(base, vec3(1.0), 0.25); }

  vec4 blob(vec2 p, vec2 mousePos, float intensity, float activity) {
    vec2 q = vec2(fbm(p * iScale + iTime * 0.1), fbm(p * iScale + vec2(5.2,1.3) + iTime * 0.1));
    vec2 r = vec2(fbm(p * iScale + q * 1.5 + iTime * 0.15), fbm(p * iScale + q * 1.5 + vec2(8.3,2.8) + iTime * 0.15));

    float smoke = fbm(p * iScale + r * 0.8);
    float radius = (0.5 + 0.3 * (1.0 / iScale)) * iRadius;
    float distFactor = 1.0 - smoothstep(0.0, radius * activity, length(p - mousePos));
    float alpha = pow(smoke, 2.5) * distFactor;

    vec3 c1 = tint1(iBaseColor);
    vec3 c2 = tint2(iBaseColor);
    vec3 color = mix(c1, c2, sin(iTime * 0.5) * 0.5 + 0.5);

    return vec4(color * alpha * intensity, alpha * intensity);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
    vec2 mouse = (iMouse * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);

    vec3 colorAcc = vec3(0.0);
    float alphaAcc = 0.0;

    vec4 b = blob(uv, mouse, 1.0, iOpacity);
    colorAcc += b.rgb;
    alphaAcc += b.a;

    for (int i = 0; i < MAX_TRAIL_LENGTH; i++) {
      vec2 pm = (iPrevMouse[i] * 2.0 - 1.0) * vec2(iResolution.x / iResolution.y, 1.0);
      float t = 1.0 - float(i) / float(MAX_TRAIL_LENGTH);
      t = pow(t, 2.0);
      if (t > 0.01) {
        vec4 bt = blob(uv, pm, t * 0.8, iOpacity);
        colorAcc += bt.rgb;
        alphaAcc += bt.a;
      }
    }

    colorAcc *= iBrightness;

    vec2 uv01 = gl_FragCoord.xy / iResolution.xy;
    float edgeDist = min(min(uv01.x, 1.0 - uv01.x), min(uv01.y, 1.0 - uv01.y));
    float distFromEdge = clamp(edgeDist * 2.0, 0.0, 1.0);
    float k = clamp(iEdgeIntensity, 0.0, 1.0);
    float edgeMask = mix(1.0 - k, 1.0, distFromEdge);

    float outAlpha = clamp(alphaAcc * iOpacity * edgeMask, 0.0, 1.0);
    gl_FragColor = vec4(colorAcc, outAlpha);
  }
`;

const GRAIN_SHADER = (intensity) => ({
  uniforms: {
    tDiffuse: { value: null },
    iTime: { value: 0 },
    intensity: { value: intensity }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float iTime;
    uniform float intensity;
    varying vec2 vUv;

    float hash1(float n){ return fract(sin(n)*43758.5453); }

    void main(){
      vec4 color = texture2D(tDiffuse, vUv);
      float n = hash1(vUv.x*1000.0 + vUv.y*2000.0 + iTime) * 2.0 - 1.0;
      color.rgb += n * intensity * color.rgb;
      gl_FragColor = color;
    }
  `
});

/* the composer works in premultiplied alpha; this puts it back to straight
   alpha so the canvas composites correctly against the page behind it */
const UNPREMULTIPLY_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTint: { value: new THREE.Vector3(1, 1, 1) },
    uUseTint: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uTint;
    uniform float uUseTint;
    varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float coverage = clamp(max(c.r, max(c.g, c.b)), 0.0, 1.0);
      vec3 straight = coverage > 1e-5 ? c.rgb / coverage : vec3(0.0);
      straight = mix(straight, uTint, uUseTint);
      gl_FragColor = vec4(clamp(straight, 0.0, 1.0), coverage);
    }
  `
};

function calculateScale(el) {
  const r = el.getBoundingClientRect();
  const base = 600;
  const current = Math.min(Math.max(1, r.width), Math.max(1, r.height));
  return Math.max(0.5, Math.min(2.0, current / base));
}

export function createGhostCursor(host, options = {}) {
  if (!host) return null;
  const parent = host.parentElement;
  if (!parent) return null;

  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  const {
    trailLength = 50,
    inertia = 0.5,
    grainIntensity = 0.05,
    bloomStrength = 0.1,
    bloomRadius = 1.0,
    bloomThreshold = 0.025,
    brightness = 1,
    color = '#B497CF',
    /* when set, the smoke's coverage is painted in this one colour instead
       of the (normalised) accumulated hue — what a 'multiply' trail wants */
    tint = null,
    mixBlendMode = 'screen',
    edgeIntensity = 0,
    maxDevicePixelRatio = 0.5,
    targetPixels,
    fadeDelayMs,
    fadeDurationMs,
    /* multiplier on the smoke's reach; 1 is the upstream size */
    radius = 1,
    /* called right after every rendered frame with { opacity, sample }, so
       the page can react to where the smoke really is (see heroInk.js) */
    onFrame = null
  } = options;

  const pixelBudget = targetPixels ?? (isTouch ? 0.9e6 : 1.3e6);
  const fadeDelay = fadeDelayMs ?? (isTouch ? 500 : 1000);
  const fadeDuration = fadeDurationMs ?? (isTouch ? 1000 : 1500);

  /* no WebGL, no ghost — the hero is fine without it */
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: !isTouch,
      alpha: true,
      depth: false,
      stencil: false,
      powerPreference: isTouch ? 'low-power' : 'high-performance',
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    });
  } catch (err) {
    return null;
  }

  let active = true;
  let hasValidSize = false;
  let running = false;
  let raf = null;

  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.pointerEvents = 'none';
  if (mixBlendMode) renderer.domElement.style.mixBlendMode = String(mixBlendMode);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geom = new THREE.PlaneGeometry(2, 2);

  const maxTrail = Math.max(1, Math.floor(trailLength));
  /* ring buffer of past pointer positions; the head walks forward and the
     uniform array is rebuilt newest-first each frame */
  const trail = Array.from({ length: maxTrail }, () => new THREE.Vector2(0.5, 0.5));
  let head = 0;

  const baseColor = new THREE.Color(color);

  const material = new THREE.ShaderMaterial({
    defines: { MAX_TRAIL_LENGTH: maxTrail },
    uniforms: {
      iTime: { value: 0 },
      iResolution: { value: new THREE.Vector3(1, 1, 1) },
      iMouse: { value: new THREE.Vector2(0.5, 0.5) },
      iPrevMouse: { value: trail.map((v) => v.clone()) },
      iOpacity: { value: 1.0 },
      iScale: { value: 1.0 },
      iRadius: { value: radius },
      iBaseColor: { value: new THREE.Vector3(baseColor.r, baseColor.g, baseColor.b) },
      iBrightness: { value: brightness },
      iEdgeIntensity: { value: edgeIntensity }
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });

  scene.add(new THREE.Mesh(geom, material));

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), bloomStrength, bloomRadius, bloomThreshold);
  composer.addPass(bloomPass);

  const filmPass = new ShaderPass(GRAIN_SHADER(grainIntensity));
  composer.addPass(filmPass);
  const unpremultiply = new ShaderPass(UNPREMULTIPLY_SHADER);
  if (tint) {
    const t = new THREE.Color(tint);
    unpremultiply.uniforms.uTint.value.set(t.r, t.g, t.b);
    unpremultiply.uniforms.uUseTint.value = 1;
  }
  composer.addPass(unpremultiply);

  /* ---------- sizing ---------- */
  function resize() {
    if (!active) return;

    const rect = host.getBoundingClientRect();
    const cssW = Math.floor(rect.width);
    const cssH = Math.floor(rect.height);
    if (cssW <= 0 || cssH <= 0) {
      hasValidSize = false;
      return;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, maxDevicePixelRatio);
    const need = cssW * cssH * dpr * dpr;
    const scale = need <= pixelBudget ? 1 : Math.max(0.5, Math.min(1, Math.sqrt(pixelBudget / Math.max(1, need))));
    const pixelRatio = dpr * scale;

    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(cssW, cssH, false);
    composer.setPixelRatio?.(pixelRatio);
    composer.setSize(cssW, cssH);

    const wpx = Math.max(1, Math.floor(cssW * pixelRatio));
    const hpx = Math.max(1, Math.floor(cssH * pixelRatio));
    material.uniforms.iResolution.value.set(wpx, hpx, 1);
    material.uniforms.iScale.value = calculateScale(host);
    bloomPass.setSize(wpx, hpx);

    hasValidSize = true;
  }

  resize();
  const ro = new ResizeObserver(() => resize());
  ro.observe(parent);
  ro.observe(host);

  /* ---------- the loop ---------- */
  const currentMouse = new THREE.Vector2(0.5, 0.5);
  const velocity = new THREE.Vector2(0, 0);
  let fadeOpacity = 1.0;
  let lastMoveTime = performance.now();
  let pointerActive = false;
  let reportTick = 0;

  const start = performance.now();

  function frame() {
    if (!active) return;

    if (!hasValidSize) {
      raf = requestAnimationFrame(frame);
      return;
    }

    const now = performance.now();
    const t = (now - start) / 1000;

    /* Idle means "the pointer has not MOVED for fadeDelay", not "the pointer
       has left". The upstream component only clears its active flag on
       pointerleave and does the fade in the else branch, so a cursor resting
       inside the element never fades: you get a full-strength blob parked on
       the hero and the bloom composer running at 60fps for as long as the tab
       is open. Its own prop docs say the trail fades after the pointer
       "leaves/stops", so this is the documented behaviour, not a new one. */
    const idleFor = now - lastMoveTime;
    const idle = idleFor > fadeDelay;

    if (pointerActive && !idle) {
      velocity.set(currentMouse.x - material.uniforms.iMouse.value.x, currentMouse.y - material.uniforms.iMouse.value.y);
      material.uniforms.iMouse.value.copy(currentMouse);
      fadeOpacity = 1.0;
    } else {
      /* the pointer left or went still, so the ghost keeps gliding on its
         last velocity and then fades — that drift is the whole character */
      velocity.multiplyScalar(inertia);
      if (velocity.lengthSq() > 1e-6) material.uniforms.iMouse.value.add(velocity);

      if (idle) {
        fadeOpacity = Math.max(0, 1 - Math.min(1, (idleFor - fadeDelay) / fadeDuration));
      }
    }

    const n = trail.length;
    head = (head + 1) % n;
    trail[head].copy(material.uniforms.iMouse.value);
    const arr = material.uniforms.iPrevMouse.value;
    for (let i = 0; i < n; i++) arr[i].copy(trail[(head - i + n) % n]);

    material.uniforms.iOpacity.value = fadeOpacity;
    material.uniforms.iTime.value = t;
    if (filmPass.uniforms?.iTime) filmPass.uniforms.iTime.value = t;

    composer.render();
    /* Reading pixels back makes the CPU wait for the GPU, so the ink is
       sampled every other frame — plenty for type flipping between two
       colours. The last, faded frame always reports, to reset the type. */
    reportTick++;
    if (onFrame && (reportTick % 2 === 0 || fadeOpacity <= 0.001)) report(fadeOpacity);

    /* fully faded — stop dead. onPointerMove calls ensureLoop(), so the next
       movement restarts it; there is nothing to keep spinning for. */
    if (fadeOpacity <= 0.001) {
      running = false;
      raf = null;
      return;
    }

    raf = requestAnimationFrame(frame);
  }

  function ensureLoop() {
    if (running) return;
    running = true;
    raf = requestAnimationFrame(frame);
  }

  /* ---------- pointer ---------- */
  /* Below roughly a pixel of travel does not count as movement. The hero
     re-lays out its own letters every frame (textPressure widens the glyph
     nearest the cursor), and when the element under a stationary pointer
     changes the browser re-dispatches pointermove — about four times a
     second here. Taking those at face value resets the idle timer forever,
     so the trail never fades and the composer never stops. Compare the
     position instead of trusting the event. */
  const MOVE_EPSILON_SQ = 1.5e-6;

  /* Listened for on window, not on the section. Fixed UI that sits over the
     hero but lives outside it in the DOM (DIVE IN) would otherwise fire a
     pointerleave the moment you touch it, and the smoke would stop short of
     it. Inside/outside is decided by the section's rect instead. */
  let inside = false;

  const onPointerMove = (e) => {
    const rect = parent.getBoundingClientRect();
    const within =
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top && e.clientY <= rect.bottom;

    if (!within) {
      if (inside) { inside = false; onPointerLeave(); }
      return;
    }
    if (!inside) { inside = true; onPointerEnter(); }

    const x = THREE.MathUtils.clamp((e.clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    const y = THREE.MathUtils.clamp(1 - (e.clientY - rect.top) / Math.max(1, rect.height), 0, 1);

    const dx = x - currentMouse.x;
    const dy = y - currentMouse.y;
    if (dx * dx + dy * dy < MOVE_EPSILON_SQ) return;

    currentMouse.set(x, y);
    pointerActive = true;
    lastMoveTime = performance.now();
    ensureLoop();
  };
  const onPointerEnter = () => { pointerActive = true; ensureLoop(); };
  const onPointerLeave = () => { pointerActive = false; lastMoveTime = performance.now(); ensureLoop(); };

  const onDocLeave = () => { if (inside) { inside = false; onPointerLeave(); } };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onDocLeave, { passive: true });

  /* ---------- reporting ----------
     Hands the page a way to read how much smoke is actually on screen at a
     given spot. Estimating that from the pointer and the radius overshoots
     badly — the smoke is patchy noise, not a disc — so this reads the frame
     that was just rendered instead.

     sample(left, top, right, bottom) takes a box in client px, reads only
     that region of the drawing buffer (it has to be called inside onFrame,
     before the browser presents and clears it), and returns a lookup:
       coverage(left, top, right, bottom) -> 0..1
     for any sub-box, e.g. one letter. Coverage is the alpha the unpremultiply
     pass writes, which is the smoke's brightness, fade included. */
  const gl = renderer.getContext();
  const buffers = new Map();

  /* The buffer is read before CSS masks it: ghostCursor.css fades the
     canvas out over its bottom --ghost-fade px. Coverage there is scaled
     by the same ramp so type in that strip is not inked for smoke that
     is not visible. */
  const fadePx = parseFloat(getComputedStyle(host).getPropertyValue('--ghost-fade')) || 0;

  function sample(l, t, r, b) {
    const hostRect = host.getBoundingClientRect();
    const W = renderer.domElement.width;
    const H = renderer.domElement.height;
    if (!W || !H || !hostRect.width || !hostRect.height) return null;
    const sx = W / hostRect.width;
    const sy = H / hostRect.height;

    const x0 = Math.max(0, Math.floor((l - hostRect.left) * sx));
    const x1 = Math.min(W, Math.ceil((r - hostRect.left) * sx));
    const y0 = Math.max(0, Math.floor((t - hostRect.top) * sy));
    const y1 = Math.min(H, Math.ceil((b - hostRect.top) * sy));
    const w = x1 - x0;
    const h = y1 - y0;
    if (w <= 0 || h <= 0) return null;

    const size = w * h * 4;
    let buf = buffers.get(size);
    if (!buf) { buf = new Uint8Array(size); buffers.set(size, buf); }

    renderer.setRenderTarget(null);
    /* GL rows count up from the bottom */
    gl.readPixels(x0, H - y1, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);

    return function coverage(bl, bt, br, bb) {
      const cx0 = Math.max(x0, Math.floor((bl - hostRect.left) * sx));
      const cx1 = Math.min(x1, Math.ceil((br - hostRect.left) * sx));
      const cy0 = Math.max(y0, Math.floor((bt - hostRect.top) * sy));
      const cy1 = Math.min(y1, Math.ceil((bb - hostRect.top) * sy));
      if (cx1 <= cx0 || cy1 <= cy0) return 0;

      let sum = 0;
      let peak = 0;
      let count = 0;
      for (let y = cy0; y < cy1; y++) {
        const row = (h - 1 - (y - y0)) * w;
        const fromBottom = (H - y - 0.5) / sy;
        const fade = fadePx ? Math.min(1, fromBottom / fadePx) : 1;
        for (let x = cx0; x < cx1; x++) {
          const a = buf[(row + (x - x0)) * 4 + 3] * fade;
          sum += a;
          if (a > peak) peak = a;
          count++;
        }
      }
      /* between mean and peak: a letter half-covered by a bright wisp is
         as unreadable as one sitting in an even haze */
      return (sum / count + peak) / 2 / 255;
    };
  }

  function report(opacity) {
    onFrame({ opacity, sample });
  }

  ensureLoop();

  return {
    destroy() {
      active = false;
      hasValidSize = false;
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = null;

      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onDocLeave);
      if (onFrame) onFrame({ opacity: 0, sample: () => null });
      ro.disconnect();

      scene.clear();
      geom.dispose();
      material.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.parentElement?.removeChild(renderer.domElement);
    }
  };
}
