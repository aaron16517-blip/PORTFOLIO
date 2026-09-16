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
- Palette is warm/neutral — no blue-tinted darks or blue glows. Page ground is
  `#09090a`; the footer watermark is an opaque colour matched to it.
- No `backdrop-filter` over smooth gradients or on moving elements, no
  `filter: blur()` layer behind a backdrop-filtered one (see README gotchas).
