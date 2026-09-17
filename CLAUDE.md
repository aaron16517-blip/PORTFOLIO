# Aaron Michael — Portfolio

Vite + vanilla JS + GSAP + Lenis (+ three.js for the desktop cursor trail).
README.md is the full design/engineering reference — read it before changing
a section.

## Run

- Dev server: preview config `portfolio` in `.claude/launch.json` (`npm run dev`).
- Build: `npm run build` → `dist/`.

## Ship

- GitHub: `aaron16517-blip/PORTFOLIO`, branch `main`.
- Vercel: project `aaron-michael-portfolio-v6-full` in team `genesis-design1`,
  Git-connected. **Every push to `main` deploys to production** —
  live at https://aaron-michael-portfolio-v6-full.vercel.app.
  Ask before pushing.
- Build settings are pinned in `vercel.json` (Vite, `npm ci`, `dist`).
- The folder is linked via `.vercel/` (ignored); the Vercel CLI is used with
  `npx vercel@latest ... --scope genesis-design1`.

## Rules that bite

- **No `prefers-reduced-motion` gates** — review browsers report `reduce`
  unconditionally. Every section always plays its full motion.
- **Phones are budgeted, not stripped.** `src/js/device.js` (`isTouch`,
  `isNarrow`, `isLowPower`) is read once at boot; effects scale their cost
  from it. three.js / heroInk only load when `!isTouch`.
- **Hero name on touch** (`textPressure.js`): rests in one even pose, a finger
  raises a swell that follows it, one hint sweep after the intro. Desktop keeps
  the original cursor maths. Both loops measure all letters, then write.
- **Nothing decorative may overhang the viewport width** — mobile browsers
  zoom the layout out and push the fixed DIVE IN toggle off screen. Use
  `overflow-x: clip` on sections with overhanging glows (not `hidden`,
  which breaks sticky).
- Palette is **ice**: frost-white ground `#f7faf9`, sea-ink type, `--ice`
  `#7fc4b5` for fills/glows and `--accent` `#2b7a6f` for anything read (the
  light teal fails contrast on white). Tokens + `*-rgb` triplets live in
  `base.css`; don't add raw colours. The hero smoke's `ground` in `clouds.js`
  must match `--bg`. Form errors keep a true red; red means only "wrong".
- **Page order:** countdown → Eden (`eden.js` / `eden.css`, assets in
  `public/eden/`) → Michael hero → Projects → … The countdown dissolves onto
  Eden's ice sheet (no panel wipe). The hero intro plays on a ScrollTrigger
  when it is reached; the hold-to-connect dive scrolls onto `#hero`. Vision
  was removed. Eden's classes are all `eden-`-prefixed; keep it that way.
- **Eden → hero hand-off:** Eden's copy is the VISION statement (title +
  three sentences, the last one held through press & hold). The runway is
  `.eden` 1300vh + `OPEN` 2.2 screens. `.hero` has `margin-top: -100vh`, so it
  slides over the pinned stage's last screen; its smoke canvas is
  transparent above a rising front (`setRise` in `clouds.js`, driven from
  main.js), and the hero ground / veil / type follow `--hero-solid`,
  `--hero-veil`, `--hero-content`. DIVE IN is hidden until the hero
  (`visibility: hidden` in menu.css, shown by a ScrollTrigger in main.js).
- **The hold is a scroll gate** (`GATE` in eden.js), on every device: until
  the hold completes, `html.eden-gated` clips `.site` to `--eden-wall` and
  hides `.foot`, so the page physically ends at the hold (touch momentum,
  wheel, keys and scrollbar all stop there; scrolling up is free). The
  wheel handler in `lenis.options.virtualScroll` only lands the wheel on the
  gate and nudges the control. `eden:connect` lifts the wall and main.js
  runs `ScrollTrigger.refresh()`.
  Lenis runs with `respectReducedMotion: false`, or the post-hold dive jumps.
- **Eden hands** are the gilded pair (`public/eden/hand-left|right.webp`, cut
  from one PNG at the gap between them). `IMG` in eden.js holds their 1x
  size and fingertip fractions; `HS` sizes them (27% of the width on desktop,
  48% on phones). The current cut includes forearms.
  The hold control's light is white only (no mint). The sleeve-end fades are
  baked into the webps (no CSS masks on the moving hands).
- **Eden on phones** (`html.is-lowpower`, set by eden.js): no scrubbed text
  blur, no arc glow filter, no backdrop blur on the SCROLL pill; resize
  ignores height-only changes (address bar); style writes go through the
  `put`/`putVar` cache; the tick ring rotates as its own layer.
  Phones also get half-size scene images (`sky-m.jpg`, `meadow-m.webp` via
  <picture>), sentence-level (not per-word) text motion, no hold zoom, a
  smaller dive scale, no blend modes or ray layer, and `.eden-world.is-gone`
  once the dive's light covers it. Running out of GPU memory makes a phone
  silently skip layers (blank sky, missing hero name) — keep it lean.
  The sky/meadow colour grade is baked into the files (no CSS filters).
  Eden sleeps as soon as the hero has fully risen over it. The hero smoke
  and the practice sphere run at 60fps on phones too. On touch the hero
  name drops its outline copy, is size/layout-contained on phones, and
  steps its axes coarsely from the rest pose (so shapes cache).
- The hero cursor trail blends `multiply` with a `tint` (main.js);
  `heroInk.js` is no longer wired in.
- No `backdrop-filter` over smooth gradients or on moving elements, no
  `filter: blur()` layer behind a backdrop-filtered one (see README gotchas).
