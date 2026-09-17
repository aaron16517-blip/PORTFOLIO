import gsap from 'gsap';
import { isTouch, isLowPower } from './device.js';

/* ============================================================
   EDEN — the opening scene, after the countdown.

   Ported from the standalone eden-scroll page:
     1. an ice sheet (WebGL, the photo in /eden/ice.webp) that the first
        OPEN screens of scroll crack open into a portal,
     2. a meadow the camera dollies into while two hands reach for each
        other, with a press-and-hold that makes them touch,
     3. a dive into the light, which lands on the Michael hero.

   Differences from the original:
     - it runs on the site's shared Lenis and GSAP ticker (one rAF loop),
       instead of creating its own of each,
     - the ice sheet is drawn from the start, underneath the countdown,
       so the preloader can simply dissolve onto it,
     - it stops working once the page is past the scene.

   initEden({ lenis }) -> { reveal() }
   Fires `eden:connect` on window when the hold completes.

   The hold is a gate: scrolling down stops at GATE until the visitor
   connects. Scrolling back up stays free.
   ============================================================ */

const $ = (s) => document.querySelector(s);
/* Phones pay for every style write, even an unchanged one — this scene
   writes a lot of them each frame, so each goes through a cache. */
const put = (el, prop, v) => {
  const k = '_' + prop;
  if (el[k] === v) return;
  el[k] = v;
  el.style[prop] = v;
};
const putVar = (el, name, v) => {
  const k = '_v' + name;
  if (el[k] === v) return;
  el[k] = v;
  el.style.setProperty(name, v);
};
/* scrubbed blurs re-rasterise every frame; a phone GPU drops frames on them */
const BLUR = !isLowPower;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (p, a, b) => clamp((p - a) / (b - a));
const E = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  smooth: (t) => t * t * (3 - 2 * t)
};

/* scroll distance, in viewport heights, spent opening the ice sheet.
   The rest of the runway is .eden's height in eden.css (1300vh) — both were
   raised so the scene reads at a walking pace, not a sprint. */
const OPEN = 2.2;

/* scene progress where scrolling down stops until the hold completes —
   the last sentence and the control are both fully in by here */
const GATE = 0.72;
/* hold arc circumference (r = 44) */
const ARC = 276.46;

/* ---------- the ice sheet ---------- */
const ICE_SRC = '/eden/ice.webp';
const ICE_ASP = 1376 / 768;

const ICE_VS = `attribute vec2 p;varying vec2 vUv;void main(){vUv=p*.5+.5;gl_Position=vec4(p,0.,1.);}`;
const ICE_FS = `precision highp float;
uniform vec2 uRes;uniform float uTime,uPortal,uGlow,uWash,uAlpha,uZoom,uImgAsp,uReady,uCrack,uRest;uniform vec2 uMouse;
uniform sampler2D uTex;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
float E(float x){return 1.-pow(1.-x,3.);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<ICE_OCT;i++){v+=a*noise(p);p=m*p;a*=.5;}return v;}
// hairline fractures radiating from the centre; len = reach in screen-heights
float cracks(vec2 p,float len,float rays,float seed){
  float d=length(p);
  float a=atan(p.y,p.x)/6.2831853+.5;
  float kd=d*9.; float k0=floor(kd);
  float kink=mix(hash(vec2(k0,seed+floor(a*rays))),hash(vec2(k0+1.,seed+floor(a*rays))),fract(kd))-.5;
  a+=kink*.9/rays*min(1.,d*6.);
  float f=a*rays, cell=floor(f);
  float rl=len*(.35+.65*hash(vec2(cell,seed)));
  float jit=(hash(vec2(cell,seed+3.))-.5)*.5;
  float dist=abs(fract(f)-.5-jit*.6)/rays*6.2831853*d;
  float w=mix(.0032,.0008,clamp(d/max(rl,.001),0.,1.));
  return (1.-smoothstep(w*.4,w,dist))*(1.-smoothstep(rl*.6,rl,d))*smoothstep(.004,.02,d);
}
void main(){
  float asp=uRes.x/uRes.y;
  vec2 p=(vUv-.5)*vec2(asp,1.);
  float t=uTime;
  float d=length(p);
  float on=step(.001,uPortal);
  vec2 q=vUv-.5;
  if(asp>uImgAsp) q.y*=uImgAsp/asp; else q.x*=asp/uImgAsp;
  q/=uZoom;
  q+=(vec2(fbm(p*3.+t*.08),fbm(p*3.-t*.07+4.))-.5)*.006;
  q+=p/(d+1e-4)*exp(-(d-uPortal)*(d-uPortal)/.02)*.02*on;
  vec3 col=mix(vec3(.44,.70,.64),texture2D(uTex,q+.5).rgb,uReady);
  float md=length(p-uMouse);
  col+=exp(-md*md*7.)*.07*vec3(.85,1.,.95);
  col*=1.-smoothstep(.45,1.2,d)*.12;
  float ang=atan(p.y,p.x);
  float wob=(fbm(vec2(ang*2.2+t*.3,t*.6))-.5)*(.05+.16*uPortal)+(noise(vec2(ang*14.,t*1.5))-.5)*.035*(.3+uPortal);
  float rr=uPortal+wob;
  float inside=(1.-smoothstep(rr-.035,rr+.004,d))*on;
  float thick=.014+.038*uPortal;
  float dd=d-rr;
  float ring=exp(-dd*dd/(thick*thick))*on;
  float halo=exp(-dd*dd/((thick*4.)*(thick*4.)))*.3*on;
  float outA=uAlpha*(1.-inside);
  vec3 rgb=col*outA;
  float a=outA;
  float wash=inside*uWash*(.55+.45*smoothstep(0.,rr,d));
  vec3 washc=mix(vec3(.80,.95,.89),vec3(.40,.70,.61),smoothstep(0.,.32,d));
  rgb+=washc*wash; a+=wash;
  float cr=(cracks(p,uCrack,11.,1.)+cracks(p*1.07,uCrack*.6,19.,5.)*.6)*(1.-inside)*uAlpha;
  float crGlow=cr*(.55+.45*exp(-d*d/(.02+uCrack*.1)));
  float core=exp(-d*d/.00006)*1.1+exp(-d*d/(.0016+.004*uPortal))*.45;
  float ga=t*.15; vec2 g=mat2(cos(ga),-sin(ga),sin(ga),cos(ga))*p;
  float glint=(exp(-abs(g.y)*260.)*exp(-abs(g.x)*9.)+exp(-abs(g.x)*260.)*exp(-abs(g.y)*9.))*.55;
  float pw=fract(t/2.8);
  float pr=mix(.02,.2,E(pw));
  float pulse=exp(-(d-pr)*(d-pr)/.00005)*(1.-pw)*(1.-pw)*.5*uRest;
  float bloom=(core+glint)*uGlow+pulse;
  float lit=(ring*1.15+halo)*uAlpha+bloom+crGlow;
  rgb+=vec3(1.)*(ring*1.15+halo)*uAlpha+vec3(1.,1.,.96)*bloom+vec3(.9,1.,.97)*crGlow;
  a=clamp(a+lit,0.,1.);
  gl_FragColor=vec4(min(rgb,vec3(a)),a);
}`;

function createIce(canvas) {
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
  if (!gl) return null;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
    return s;
  };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, ICE_VS));
  /* the fbm only nudges UVs and the portal rim — three octaves read the
     same on a phone and cost far less per pixel */
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, ICE_FS.replace('precision highp float;',
    `precision highp float;\n#define ICE_OCT ${isLowPower ? 3 : 5}`)));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = {};
  ['uRes', 'uTime', 'uPortal', 'uGlow', 'uWash', 'uAlpha', 'uZoom', 'uImgAsp', 'uReady', 'uCrack', 'uRest', 'uMouse', 'uTex']
    .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
  const st = { portal: 0, glow: 0, wash: 0, alpha: 1, zoom: 1, crack: 0.2, rest: 1, mx: 0, my: 0, tmx: 0, tmy: 0 };

  /* a flat ice colour until the photo lands, then a short fade to it */
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([111, 179, 162, 255]));
  [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
   [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]
    .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
  gl.uniform1i(U.uTex, 0);

  let onFail = () => {};
  let readyT = 0;
  const img = new Image();
  img.onload = () => {
    try {
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      readyT = performance.now();
    } catch (e) { onFail(); }
  };
  img.onerror = () => onFail();
  img.src = ICE_SRC;

  let lastW = 0;
  function resize() {
    /* a phone's address bar changes only the height; the buffer simply
       stretches a few percent — reallocating it blanked the frame */
    if (isTouch && lastW === innerWidth && canvas.width) return;
    lastW = innerWidth;
    /* phones draw it at one buffer pixel per CSS pixel: the shader is heavy
       and this is the very first thing on screen */
    const scale = isLowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
    const w = innerWidth * scale;
    const h = innerHeight * scale;
    const k = Math.min(1, Math.sqrt(3e6 / (w * h)));
    canvas.width = Math.round(w * k);
    canvas.height = Math.round(h * k);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(t) {
    st.mx = lerp(st.mx, st.tmx, 0.06);
    st.my = lerp(st.my, st.tmy, 0.06);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    gl.uniform1f(U.uTime, t);
    gl.uniform1f(U.uPortal, st.portal);
    gl.uniform1f(U.uGlow, st.glow);
    gl.uniform1f(U.uWash, st.wash);
    gl.uniform1f(U.uAlpha, st.alpha);
    gl.uniform1f(U.uZoom, st.zoom);
    gl.uniform1f(U.uCrack, st.crack);
    gl.uniform1f(U.uRest, st.rest);
    gl.uniform1f(U.uImgAsp, ICE_ASP);
    gl.uniform1f(U.uReady, readyT ? clamp((performance.now() - readyT) / 400) : 0);
    gl.uniform2f(U.uMouse, st.mx, st.my);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  addEventListener('pointermove', (e) => {
    st.tmx = (e.clientX / innerWidth - 0.5) * (innerWidth / innerHeight);
    st.tmy = 0.5 - e.clientY / innerHeight;
  });
  resize();
  return { st, resize, draw, setFail: (fn) => { onFail = fn; } };
}

/* ---------- petals ---------- */
function makeSprite(kind, blur) {
  const S = 128;
  const pad = Math.ceil(blur * 3);
  const c = document.createElement('canvas');
  c.width = c.height = S + pad * 2;
  const x = c.getContext('2d');
  if (blur) x.filter = `blur(${blur}px)`;
  x.translate(c.width / 2, c.height / 2);
  if (kind === 'pink') {
    const g = x.createLinearGradient(-20, -54, 20, 54);
    g.addColorStop(0, '#ffe0ee'); g.addColorStop(0.4, '#f9aecf'); g.addColorStop(1, '#e8679f');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -56);
    x.bezierCurveTo(36, -44, 42, 18, 8, 54); x.bezierCurveTo(0, 60, -8, 58, -13, 50);
    x.bezierCurveTo(-42, 12, -32, -42, 0, -56); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.45)'; x.lineWidth = 2.2;
    x.beginPath(); x.moveTo(-2, -48); x.quadraticCurveTo(10, 0, 0, 50); x.stroke();
  } else {
    const g = x.createLinearGradient(-30, -56, 30, 56);
    g.addColorStop(0, '#dcffc6'); g.addColorStop(0.45, '#8fdd7c'); g.addColorStop(1, '#42ad5a');
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, -58); x.quadraticCurveTo(38, -4, 0, 58); x.quadraticCurveTo(-38, -4, 0, -58); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.4)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -50); x.lineTo(0, 50); x.stroke();
  }
  return c;
}

function petalField(canvas, opts, SPR) {
  const ctx = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  let dpr = 1;
  const list = [];

  const spawn = (p, fresh) => {
    const z = lerp(opts.z[0], opts.z[1], Math.random());
    p.z = z;
    p.kind = Math.random() < opts.green ? 'green' : 'pink';
    p.size = lerp(opts.size[0], opts.size[1], Math.random()) * (W / 1600 + 0.35);
    p.x = Math.random() * (W + 200) - 100;
    p.y = fresh ? Math.random() * H : -p.size - Math.random() * 120;
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 1.4;
    p.flip = Math.random() * 6.28; p.flipV = 0.8 + Math.random() * 2.2;
    p.sway = Math.random() * 6.28; p.vy = lerp(26, 62, Math.random());
    p.vx = 0; p.vy2 = 0; p.life = -1;
    p.blur = opts.blur(z);
    p.alpha = opts.alpha(z);
    return p;
  };

  function resize(w, h) {
    dpr = Math.min(window.devicePixelRatio || 1, isLowPower ? 1.25 : 2);
    W = w; H = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const n = Math.round(opts.count * (isLowPower ? 0.4 : w < 700 ? 0.55 : 1));
    list.length = 0;
    for (let i = 0; i < n; i++) list.push(spawn({}, true));
  }

  function burst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const p = spawn({}, true);
      const a = Math.random() * 6.28;
      const s = lerp(160, 620, Math.random());
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy2 = Math.sin(a) * s - 120;
      p.life = lerp(2.2, 4, Math.random());
      p.size *= 0.8; p.blur = 1; p.alpha = 1;
      list.push(p);
    }
  }

  function step(dt, wind, vel) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.sway += dt * 0.9;
      p.flip += dt * p.flipV;
      p.rot += dt * p.spin;
      const drift = (wind + Math.sin(p.sway) * 26) * p.z;
      p.vx *= Math.pow(0.25, dt); p.vy2 *= Math.pow(0.3, dt);
      p.x += (drift + p.vx) * dt;
      p.y += (p.vy * p.z + p.vy2 - vel * 0.35 * p.z) * dt;
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
      } else if (p.y > H + p.size * 2 || p.x > W + 160 || p.x < -160 || p.y < -H * 0.6) {
        spawn(p, false);
        if (p.x > W) p.x -= W;
      }
      const cf = Math.cos(p.flip);
      const sx = (0.22 + 0.78 * Math.abs(cf)) * p.size / 128;
      const sy = p.size / 128;
      const cr = Math.cos(p.rot);
      const sr = Math.sin(p.rot);
      const spr = SPR[p.kind][p.blur];
      ctx.globalAlpha = p.alpha * (0.72 + 0.28 * Math.abs(cf)) * (p.life > 0 ? clamp(p.life) : 1);
      ctx.setTransform(cr * sx * dpr, sr * sx * dpr, -sr * sy * dpr, cr * sy * dpr, p.x * dpr, p.y * dpr);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
    }
  }

  return { resize, step, burst };
}

/* split a line into word spans, keeping <em> words emphasised */
function splitWords(el) {
  const out = [];
  [...el.childNodes].forEach((node) => {
    const isEm = node.nodeType === 1;
    node.textContent.split(/\s+/).filter(Boolean).forEach((w) => {
      const s = document.createElement('span');
      s.className = 'eden-w';
      if (isEm) {
        const em = document.createElement('em');
        em.textContent = w;
        s.append(em);
      } else s.textContent = w;
      out.push(s);
    });
  });
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  el.textContent = '';
  out.forEach((s, i) => {
    s.setAttribute('aria-hidden', 'true');
    el.append(s);
    if (i < out.length - 1) el.append(' ');
  });
  return out;
}

/* hand cutouts (the gilded pair, with forearms): 1x size + fingertip
   position as a fraction of the image. Both share one scale, 1.224 units per
   source px, which keeps the hands the size the earlier hands-only cut had
   (its hands were 1.55x larger in pixels); the arms simply run on outward. */
const IMG = {
  L: { w: 745.6, h: 388.1, tx: 0.995, ty: 0.44 },
  R: { w: 713.8, h: 372.2, tx: 0.003, ty: 0.446 }
};

/* hand poses — fingertip offsets from centre, in U */
function makePoses() {
  const P = {
    /* the right hand now reaches in from the side, level with the left */
    enter: { lx: -0.62, ly: -0.1, lr: -8, rx: 0.62, ry: -0.16, rr: 8 },
    far:   { lx: -0.09, ly: 0, lr: -2, rx: 0.09, ry: -0.02, rr: 2 },
    far2:  { lx: -0.075, ly: 0.002, lr: 0, rx: 0.075, ry: -0.015, rr: 0 },
    near:  { lx: -0.042, ly: 0.004, lr: 3, rx: 0.042, ry: -0.004, rr: -3 },
    touch: { lx: -0.01, ly: 0.006, lr: 5, rx: 0.01, ry: 0.004, rr: -4 }
  };
  if (innerWidth / innerHeight < 1) {
    Object.assign(P.far,   { lx: -0.17, ly: -0.02, rx: 0.17, ry: -0.05 });
    Object.assign(P.far2,  { lx: -0.15, ly: -0.015, rx: 0.15, ry: -0.04 });
    Object.assign(P.near,  { lx: -0.08, ly: 0, rx: 0.08, ry: -0.025 });
    Object.assign(P.touch, { lx: -0.012, ly: 0.008, rx: 0.012, ry: 0.004 });
  }
  return P;
}
const mixPose = (a, b, t) => {
  const o = {};
  for (const k in a) o[k] = lerp(a[k], b[k], t);
  return o;
};

export function initEden({ lenis } = {}) {
  const hero = $('#eden');
  if (!hero) return { reveal() {} };
  document.documentElement.classList.toggle('is-lowpower', isLowPower);

  const introEl = $('#edenIntro');
  const stage = $('#edenStage');
  const world = $('#edenWorld');
  const sky = $('#edenSky');
  const meadow = $('#edenMeadow');
  const handL = $('#edenHandL');
  const handR = $('#edenHandR');
  const jobWrap = hero.querySelector('.eden-job-wrap');
  const job = $('#edenJob');
  const jobLetters = [...job.children];
  const holdLbl = $('#edenHoldLbl');
  const holdTicks = $('#edenHoldTicks');
  const hold = $('#edenHold');
  const holdArc = $('#edenHoldArc');
  const spark = $('#edenSpark');
  const flash = $('#edenFlash');
  const copyEls = [...hero.querySelectorAll('.eden-copy')];
  const scrollHint = $('#edenHint');

  /* ice */
  const ice = createIce($('#edenIce'));
  let iceGL = !!ice;
  const iceFallback = () => {
    iceGL = false;
    introEl.classList.remove('is-gl');
    introEl.classList.add('is-fallback');
    $('#edenIce').style.display = 'none';
  };
  if (ice) { introEl.classList.add('is-gl'); ice.setFail(iceFallback); } else iceFallback();

  /* petals */
  const SPR = {};
  ['pink', 'green'].forEach((k) => { SPR[k] = [0, 2.5, 8].map((b) => makeSprite(k, b)); });
  const back = petalField($('#edenPetalsBack'),
    { count: 46, z: [0.35, 1], size: [10, 26], green: 0.22, blur: (z) => (z < 0.55 ? 1 : 0), alpha: (z) => 0.55 + 0.45 * z }, SPR);
  const front = petalField($('#edenPetalsFront'),
    { count: 12, z: [1.3, 2.3], size: [38, 90], green: 0.25, blur: (z) => (z > 1.8 ? 2 : 1), alpha: () => 0.9 }, SPR);

  /* phones move each sentence as one piece: per-word motion was ~45 layers */
  const s1 = $('#edenS1'), s2 = $('#edenS2'), s3 = $('#edenS3');
  const w1 = isLowPower ? null : splitWords(s1);
  const w2 = isLowPower ? null : splitWords(s2);
  const w3 = isLowPower ? null : splitWords(s3);
  const P = makePoses();

  /* ---------- layout ---------- */
  let W = 0, H = 0, U = 1, HS = 1;
  let C = { x: 0, y: 0 };

  function layout() {
    W = stage.clientWidth;
    H = stage.clientHeight;
    const portrait = W / H < 1;
    /* meadow-wide is 2006×823 at 1x, horizon at y≈200 */
    const S = portrait ? Math.max(W / 1000, H / 1500) : Math.max(W / 2006 * 1.04, H / 1050);
    const mW = 2006 * S;
    const mH = 823 * S;
    const mTop = Math.max(H * 0.5 - 200.5 * S, H - 800 * S);
    Object.assign(meadow.style, { width: mW + 'px', height: mH + 'px', left: (W - mW) / 2 + 'px', top: mTop + 'px' });
    const horizon = mTop + 200.5 * S;
    const need = (horizon + H * 0.08) / 0.76;
    const sW = Math.max(W * 1.12, need * 1.4131);
    const sH = sW / 1.4131;
    Object.assign(sky.style, { width: sW + 'px', height: sH + 'px', left: (W - sW) / 2 + 'px', top: horizon - sH * 0.76 + 'px' });
    C = { x: W / 2, y: portrait ? H * 0.47 : H * 0.5 };
    U = Math.min(W, H * 1.78);
    /* The gilded pair is a supporting element, not the subject: each hand
       is ~27% of the width on desktop (capped by the height, so a tall
       window can't inflate it) and ~48% of a phone's, leaving the columns,
       sky and copy their room. */
    HS = (portrait ? W * 0.48 : Math.min(W * 0.27, H * 0.46)) / 500;
    [[handL, IMG.L], [handR, IMG.R]].forEach(([el, m]) => {
      el.style.width = m.w * HS + 'px';
      el.style.height = m.h * HS + 'px';
      el.style.transformOrigin = `${m.tx * 100}% ${m.ty * 100}%`;
    });
    sky.style.transformOrigin = `${C.x - parseFloat(sky.style.left)}px ${C.y - parseFloat(sky.style.top)}px`;
    meadow.style.transformOrigin = `${C.x - parseFloat(meadow.style.left)}px ${C.y - parseFloat(meadow.style.top)}px`;
    back.resize(W, H);
    front.resize(W, H);
    if (ice) ice.resize();
  }

  /* ---------- state ---------- */
  let introZoom = 1.3, introT = 0, uiOn = false, oS = 0;
  let pS = 0, lastY = 0, vel = 0;
  let holdV = 0, pressing = false, connected = false, touchS = 0, sparkPulse = 0;
  let tickA = 0, holdE = 0, nudgeT = 0, lblText = '';
  /* the cursor, -1..1 from the centre; a mouse only (a finger has no hover) */
  let mX = 0, mY = 0, tmX = 0, tmY = 0, releaseT = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    tmX = e.clientX / innerWidth * 2 - 1;
    tmY = e.clientY / innerHeight * 2 - 1;
  }, { passive: true });
  document.documentElement.addEventListener('mouseleave', () => { tmX = 0; tmY = 0; });

  function setPose(el, m, x, y, r, sc) {
    const tx = x - m.tx * m.w * HS;
    const ty = y - m.ty * m.h * HS;
    el.style.transform = `translate3d(${tx.toFixed(2)}px,${ty.toFixed(2)}px,0) rotate(${r.toFixed(3)}deg) scale(${sc.toFixed(4)})`;
  }

  function line(el, p, a, b, c, d) {
    const inn = E.out(seg(p, a, b + (b - a) * 0.6));
    const out = E.in(seg(p, c, d));
    const o = inn * (1 - out);
    put(el, 'opacity', o.toFixed(3));
    if (o > 0.001) put(el, 'transform', `translate3d(-50%,${((1 - inn) * 26 - out * 24).toFixed(1)}px,0)`);
  }

  function words(list, p, a, b, c, d, el) {
    if (!list) { line(el, p, a, b, c, d); return; }
    const n = list.length;
    list.forEach((el, i) => {
      const off = i / Math.max(1, n) * (b - a) * 0.9;
      const inn = E.out(seg(p, a + off, b + off * 0.2));
      const out = E.in(seg(p, c + off * 0.4, d));
      const o = inn * (1 - out);
      put(el, 'opacity', o.toFixed(3));
      /* hidden words keep their last position — nothing to see moving */
      if (o > 0.001) put(el, 'transform', `translate3d(0,${((1 - inn) * 34 - out * 30).toFixed(1)}px,0)`);
      if (BLUR) put(el, 'filter', o < 0.995 && o > 0.001 ? `blur(${((1 - inn) * 12 + out * 10).toFixed(1)}px)` : '');
    });
  }

  function update(dt, t) {
    /* a tab that boots hidden measures a 0px stage; every progress below
       divides by it, and a NaN in the smoothed values would stick forever */
    if (!H) { layout(); if (!H) return; setWall(); }
    const y = window.scrollY;
    vel = lerp(vel, (y - lastY) / Math.max(dt, 1 / 240), 0.15);
    lastY = y;

    /* opening: the ice sheet parts over the first OPEN screens of scroll */
    const oRaw = clamp((y - hero.offsetTop) / (OPEN * H));
    oS = Number.isFinite(oS) ? lerp(oS, oRaw, 1 - Math.exp(-dt * 12)) : oRaw;
    if (Math.abs(oS - oRaw) < 0.0005) oS = oRaw;
    const o = oS;
    introZoom = lerp(1.3, 1, E.out(seg(o, 0.1, 1)));
    introT = E.out(seg(o, 0.3, 1));
    uiOn = o > 0.85;
    const asp = W / H;
    const rEnd = 0.5 * Math.sqrt(asp * asp + 1) * 1.25 + 0.35;
    /* cracks race out first, then the centre gives way */
    const portal = seg(o, 0.07, 0.13) * 0.12 + (rEnd - 0.12) * E.inOut(seg(o, 0.13, 1));
    const sheetA = 1 - seg(o, 0.9, 1);
    introEl.style.visibility = o >= 1 ? 'hidden' : '';
    if (ice && iceGL) {
      Object.assign(ice.st, {
        portal,
        glow: (0.7 + 0.6 * E.out(seg(o, 0, 0.1))) * (1 - E.smooth(seg(o, 0.3, 0.85))) * (0.88 + 0.12 * Math.sin(t * 2.2)),
        crack: (0.16 + 0.02 * Math.sin(t * 1.3)) + 0.9 * E.out(seg(o, 0, 0.12)),
        rest: 1 - seg(o, 0, 0.04),
        wash: 0.45 * (1 - E.smooth(seg(o, 0.1, 0.32))),
        alpha: sheetA,
        zoom: 1 + 0.35 * E.in(o)
      });
    } else {
      introEl.style.setProperty('--r', (portal * H).toFixed(1) + 'px');
      introEl.style.opacity = sheetA;
    }
    put(scrollHint, 'opacity', (hintOn * (1 - seg(oRaw, 0.01, 0.08))).toFixed(3));
    put(jobWrap, 'opacity', E.smooth(seg(o, 0.5, 0.9)).toFixed(3));

    const pRaw = clamp((y - hero.offsetTop - OPEN * H) / (hero.offsetHeight - H - OPEN * H));
    /* a softer follow than the wheel itself, so each beat glides in */
    pS = Number.isFinite(pS) ? lerp(pS, pRaw, 1 - Math.exp(-dt * 9)) : pRaw;
    const p = pS;

    /* camera dolly, then the dive into the light */
    const k = E.inOut(seg(p, 0, 0.84));
    const dive = E.in(seg(p, 0.84, 1));
    /* holding pushes the camera in a touch, as if leaning towards it */
    holdE = lerp(holdE, connected ? 0 : holdV, 1 - Math.exp(-dt * 8));
    /* phones skip the lean: rescaling the whole world every frame is a
       full re-raster there */
    const zoom = introZoom * (isLowPower ? 1 : 1 + 0.035 * E.out(holdE));
    put(world, 'transform', Math.abs(zoom - 1) > 0.0001 ? `scale(${zoom.toFixed(4)})` : '');
    /* under the dive's full light nothing of the world shows — free it */
    world.classList.toggle('is-gone', p > 0.965);
    const DV = isLowPower ? 0.35 : 1;
    /* the scene leans after the cursor, a little: the far sky least, the
       meadow more, the hands and copy most — depth, not a slide */
    mX = lerp(mX, tmX, 1 - Math.exp(-dt * 3.5));
    mY = lerp(mY, tmY, 1 - Math.exp(-dt * 3.5));
    sky.style.transform = `translate3d(${(-mX * 10).toFixed(2)}px,${(H * 0.025 * k + H * 0.05 * dive - mY * 6).toFixed(2)}px,0) scale(${(1 + 0.07 * k + 0.5 * dive * DV).toFixed(4)})`;
    meadow.style.transform = `translate3d(${(-mX * 8).toFixed(2)}px,${(-H * 0.06 * k - mY * 5).toFixed(2)}px,0) scale(${(1.01 + 0.2 * k + 1.3 * dive * DV).toFixed(4)})`;
    copyEls.forEach((el, i) => {
      el.style.transform = `translate3d(${(mX * (6 + i * 4)).toFixed(2)}px,${(mY * (4 + i * 2)).toFixed(2)}px,0)`;
    });

    /* press & hold */
    if (pressing && !connected) holdV = Math.min(1, holdV + dt / 1.35);
    else if (!connected) holdV = Math.max(0, holdV - dt / 0.55);
    if (!connected && holdV >= 1) connect();
    const auto = E.inOut(seg(p, 0.82, 0.88));
    const touchT = connected ? 1 : Math.max(E.inOut(holdV) * 0.92, auto);
    touchS = lerp(touchS, touchT, 1 - Math.exp(-dt * (connected ? 6 : 10)));
    holdArc.style.strokeDashoffset = (ARC * (1 - (connected ? 1 : holdV))).toFixed(2);
    putVar(hold, '--hv', (connected ? 1 : holdE).toFixed(2));
    nudgeT = Math.max(0, nudgeT - dt);
    const lbl = connected ? 'Connected'
      : pressing ? 'Keep holding'
      : nudgeT > 0 ? 'Hold to continue'
      : 'Press & hold';
    if (lbl !== lblText) { holdLbl.textContent = lbl; lblText = lbl; }

    /* hands */
    let pose = mixPose(P.far, P.far2, E.smooth(seg(p, 0, 0.16)));
    pose = mixPose(pose, P.near, E.inOut(seg(p, 0.44, 0.62)));
    pose = mixPose(pose, P.touch, touchS);
    /* after the touch the hands don't fade: they draw back the way they
       came, receding a little, while the light rises */
    /* after a hold it runs on its own clock — linger on the touch, then a
       slow withdrawal as the glide starts — so the fast middle of the glide
       can't swallow it; scrolling by hand still drives it too */
    if (connected) releaseT += dt;
    const byTime = connected && p > GATE - 0.05 ? E.inOut(seg(releaseT, 1.1, 3.3)) : 0;
    const retreat = Math.max(E.inOut(seg(p, 0.8, 0.96)), byTime);
    pose = mixPose(pose, P.enter, retreat);
    pose = mixPose(P.enter, pose, introT);
    const idle = 1 - touchS * 0.8;
    const sc = (1 + 0.12 * k) * (1 - 0.16 * retreat);
    /* the hands are nearest, so they follow the cursor the most */
    const hx = mX * 18;
    const hy = mY * 10;
    setPose(handL, IMG.L, C.x + pose.lx * U + hx, C.y + pose.ly * U + Math.sin(t * 0.9) * 5 * idle + hy, pose.lr + Math.sin(t * 0.6) * 0.6 * idle + mX * 1.2, sc);
    setPose(handR, IMG.R, C.x + pose.rx * U + hx, C.y + pose.ry * U + Math.sin(t * 0.75 + 1.3) * 6 * idle + hy, pose.rr + Math.sin(t * 0.55 + 2) * 0.7 * idle + mX * 1.2, sc);
    const handO = clamp(introT * 3).toFixed(3);
    put(handL, 'opacity', handO);
    put(handR, 'opacity', handO);

    /* contact glow */
    const cx = C.x + (pose.lx + pose.rx) / 2 * U + hx;
    const cy = C.y + (pose.ly + pose.ry) / 2 * U + U * 0.004 + hy;
    sparkPulse = Math.max(0, sparkPulse - dt * 0.9);
    const glow = Math.pow(touchS, 4) * (0.75 + 0.25 * Math.sin(t * 3)) + sparkPulse * 1.2;
    put(spark, 'opacity', clamp(glow * (1 - retreat)).toFixed(3));
    if (glow * (1 - retreat) > 0.001) spark.style.transform = `translate3d(${cx}px,${cy}px,0) scale(${(0.32 + glow * 0.5 + dive * 3).toFixed(3)})`;

    /* hold control — blooms in from small, a touch past full size, and
       settles, so the eye is pulled to it before the copy asks */
    const holdIn = seg(p, 0.6, 0.66);
    const holdVis = holdIn * (1 - seg(p, 0.8, 0.84)) * (connected ? 0 : 1) * (uiOn ? 1 : 0);
    const bloom = holdIn < 1 ? 0.55 + 0.45 * E.out(holdIn) + 0.08 * Math.sin(holdIn * Math.PI) : 1;
    put(hold, 'opacity', E.out(holdVis).toFixed(3));
    if (holdVis > 0) {
      put(hold, 'transform', `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0) scale(${bloom.toFixed(3)})`);
      /* the tick ring turns on its own compositor layer */
      tickA = (tickA + dt * (14 + 260 * holdE * holdE)) % 360;
      holdTicks.style.transform = `rotate(${tickA.toFixed(1)}deg)`;
    }
    hold.classList.toggle('is-live', holdVis > 0.5);
    if (holdVis < 0.5 && pressing) endPress();

    /* copy — the title holds a beat, then the belief reads in three
       lines, the last one staying up through the hold */
    const jobOut = seg(p, 0.08, 0.2);
    put(job, 'opacity', (1 - E.smooth(jobOut)).toFixed(3));
    if (BLUR) put(job, 'filter', jobOut > 0.001 && jobOut < 0.999 ? `blur(${(jobOut * 14).toFixed(1)}px)` : '');
    if (isLowPower) {
      if (jobOut < 1) put(job, 'transform', `translate3d(0,${(-jobOut * 40).toFixed(1)}px,0) scale(${(1 + jobOut * 0.2).toFixed(3)})`);
    } else if (jobOut < 1) {
      jobLetters.forEach((l, i) => {
        const off = i - (jobLetters.length - 1) / 2;
        put(l, 'transform', `translate3d(${(off * jobOut * 60).toFixed(1)}px,${(-jobOut * 40 - Math.abs(off) * jobOut * 10).toFixed(1)}px,0) scale(${(1 + jobOut * 0.25).toFixed(3)})`);
      });
    }
    words(w1, p, 0.2, 0.28, 0.37, 0.42, s1);
    words(w2, p, 0.42, 0.5, 0.56, 0.6, s2);
    words(w3, p, 0.6, 0.68, 0.8, 0.85, s3);
    /* the light: a white bloom first, then it settles to the hero's flat
       frost ground, which is what the hero's smoke rises out of */
    put(flash, 'opacity', E.smooth(seg(p, 0.86, 0.96)).toFixed(3));
    putVar(flash, '--bloom', (1 - E.smooth(seg(p, 0.95, 1))).toFixed(3));

    /* petals */
    /* petals live inside the world — nothing to draw once it is hidden */
    if (p <= 0.965) {
      back.step(dt, 18 + k * 10, vel * 0.5);
      front.step(dt, 22, vel * 0.8);
    }
  }

  /* ---------- hold interaction ---------- */
  function startPress(e) {
    if (connected || !hold.classList.contains('is-live')) return;
    if (e) e.preventDefault();
    pressing = true;
    hold.classList.add('is-pressing');
    if (e && e.pointerId != null) {
      try { hold.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ }
    }
  }
  function endPress() {
    pressing = false;
    hold.classList.remove('is-pressing');
  }
  /* A finger on the lens may mean "hold" or "scroll", and the lens can't
     let the browser decide: a browser-owned swipe cancels the pointer, so a
     wobbly thumb would break a real hold. So the lens keeps the gesture and
     reads it — still for a beat means hold; moving first means scroll, and
     the page follows the finger (the gate still stops it going down). */
  const g = { mode: '', id: -1, y0: 0, y: 0, t: 0, v: 0, timer: 0 };
  function releaseGesture() {
    clearTimeout(g.timer);
    if (g.mode === 'scroll' && Math.abs(g.v) > 0.25) {
      const to = window.scrollY + g.v * 320;
      if (lenis) lenis.scrollTo(to, { duration: 0.9, easing: E.out });
      else window.scrollTo({ top: to, behavior: 'smooth' });
    }
    g.mode = '';
    g.id = -1;
    endPress();
  }
  hold.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') { startPress(e); return; }
    if (connected || !hold.classList.contains('is-live')) return;
    e.preventDefault();
    try { hold.setPointerCapture(e.pointerId); } catch (_) { /* not capturable */ }
    Object.assign(g, { mode: 'pending', id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0 });
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
      if (g.mode !== 'pending') return;
      g.mode = 'press';
      pressing = true;
      hold.classList.add('is-pressing');
    }, 120);
  });
  hold.addEventListener('pointermove', (e) => {
    if (e.pointerId !== g.id || !g.mode) return;
    const total = e.clientY - g.y0;
    if (g.mode === 'pending' && Math.abs(total) > 10) { clearTimeout(g.timer); g.mode = 'scroll'; }
    else if (g.mode === 'press' && Math.abs(total) > 28) { endPress(); g.mode = 'scroll'; }
    const dy = e.clientY - g.y;
    const dt = Math.max(1, e.timeStamp - g.t);
    g.y = e.clientY;
    g.t = e.timeStamp;
    if (g.mode !== 'scroll') return;
    window.scrollBy(0, -dy);
    g.v = g.v * 0.6 + (-dy / dt) * 0.4;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => hold.addEventListener(ev, (e) => {
    if (e.pointerType === 'mouse') { endPress(); return; }
    if (e.pointerId === g.id) releaseGesture();
  }));
  hold.addEventListener('contextmenu', (e) => e.preventDefault());
  hold.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) startPress(e); });
  hold.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') endPress(); });

  /* ---------- the gate ---------- */
  const gateY = () => hero.offsetTop + OPEN * H + GATE * (hero.offsetHeight - H - OPEN * H);
  let nudgeClass = 0;
  function nudge() {
    if (nudgeT > 0.35) return;
    nudgeT = 1.6;
    hold.classList.remove('is-nudge');
    void hold.offsetWidth;
    hold.classList.add('is-nudge');
    clearTimeout(nudgeClass);
    nudgeClass = setTimeout(() => hold.classList.remove('is-nudge'), 600);
  }
  /* The wall: until the hold completes, the page itself ends at the gate
     (html.eden-gated clips .site to --eden-wall and hides the footer, see
     eden.css). Every kind of scroll stops there on its own — a finger's
     momentum on a phone, the wheel, keys, the scrollbar — with the
     browser's own bounce, and nothing has to fight it. Layout is
     untouched, so every section keeps its real position. */
  const root = document.documentElement;
  const setWall = () => {
    if (!connected) root.style.setProperty('--eden-wall', Math.ceil(gateY() + H) + 'px');
  };
  root.classList.add('eden-gated');

  /* wheel and touch arrive here before Lenis moves */
  if (lenis) {
    lenis.options.virtualScroll = ({ deltaY, event }) => {
      if (connected || deltaY <= 0) return true;
      const g = gateY();
      /* a finger scrolls natively: the wall stops it, this only answers */
      if (event.type.includes('touch')) {
        if (window.scrollY >= g - 4) nudge();
        return true;
      }
      /* a wheel that would carry past lands exactly on the gate */
      const from = Math.max(lenis.targetScroll, window.scrollY);
      if (from + deltaY <= g) return true;
      if (event.cancelable) event.preventDefault();
      if (from < g - 1) lenis.scrollTo(g, { duration: 0.9, easing: E.out });
      else nudge();
      return false;
    };
  }
  /* keys scroll natively, past Lenis — the wall stops them, this answers */
  const DOWN_KEYS = new Set(['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar']);
  addEventListener('keydown', (e) => {
    if (connected || e.target === hold || !DOWN_KEYS.has(e.key)) return;
    if (e.key === ' ' && e.target.closest?.('input, textarea, button, select')) return;
    if (window.scrollY >= gateY() - 2) {
      e.preventDefault();
      nudge();
    }
  });
  function connect() {
    connected = true;
    endPress();
    /* the wall comes down; main.js remeasures the page on eden:connect */
    root.classList.remove('eden-gated');
    if (lenis) lenis.resize();
    sparkPulse = 1;
    const r = hold.getBoundingClientRect();
    back.burst(r.left + r.width / 2, r.top + r.height / 2, 26);
    front.burst(r.left + r.width / 2, r.top + r.height / 2, 5);
    /* Chrome refuses (and logs) a vibrate before any real tap */
    if (navigator.vibrate && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate([12, 40, 20]);
    window.dispatchEvent(new CustomEvent('eden:connect'));
    /* let the burst land, then carry the visitor through the dive and onto
       the Michael hero */
    setTimeout(() => {
      /* the Michael hero. It overlaps the scene's last screen, so this is
         its own top, not the end of the scene */
      const end = document.getElementById('hero').offsetTop;
      if (lenis) lenis.scrollTo(end, { duration: 5.6, easing: E.inOut, lock: true, force: true });
      else window.scrollTo({ top: end, behavior: 'smooth' });
    }, 900);
  }

  /* ---------- loop: the site's shared ticker ---------- */
  /* the SCROLL pill waits for the countdown to finish */
  let hintOn = 0;
  let wasPast = false;

  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(0.05, (deltaMs || 16) / 1000);
    /* Past the scene (plus a screen of slack for the dive's last frames),
       nothing here is visible. Run one last update so it rests at its end
       state, then stop paying for it until the visitor scrolls back. */
    /* The hero overlaps the scene's last screen, so once it has fully
       risen (the dive is complete) the scene is entirely covered. It used to
       keep running a screen past that — petals included — while the visitor
       was looking at the hero. */
    const past = window.scrollY >= hero.offsetTop + hero.offsetHeight - H - 1;
    if (past && wasPast) return;
    wasPast = past;
    /* the last update before sleeping must land on the end state, not
       partway along the smoothing — or a jump past the scene leaves the
       ice sheet frozen over the page */
    if (past) { oS = 1; pS = 1; }
    update(dt, time);
    if (ice && iceGL && oS < 1) ice.draw(time);
  });

  let rT;
  let resizeW = innerWidth;
  addEventListener('resize', () => {
    /* a phone's address bar showing or hiding fires resize on every scroll
       direction change. The stage is 100vh (the large viewport), so nothing
       here depends on it — rebuilding re-scattered every petal. */
    if (isTouch && innerWidth === resizeW) return;
    resizeW = innerWidth;
    clearTimeout(rT);
    rT = setTimeout(() => { layout(); setWall(); }, 80);
  });
  layout();
  setWall();

  return {
    /* the countdown has lifted: settle the ice in and show the hint */
    reveal() {
      gsap.fromTo(introEl, { scale: 1.06 }, { scale: 1, duration: 1.6, ease: 'power3.out', clearProps: 'transform' });
      gsap.to({ v: 0 }, { v: 1, duration: 0.8, delay: 0.9, ease: 'power2.out', onUpdate() { hintOn = this.targets()[0].v; } });
    }
  };
}
