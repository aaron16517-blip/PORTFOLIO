# Aaron Michael — Portfolio

Vite + vanilla JS + GSAP + Lenis. No framework, no build ceremony.

---

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173 · `npm run build` outputs to `dist/`

### Motion

**There is no `prefers-reduced-motion` gate anywhere in `src/`.** This is
showcase work, and the browsers it gets reviewed in — embedded preview panes
included — report `reduce` unconditionally, so a gate would mean nobody ever
sees the intro. Every section plays its full animation on every load. There is
no `?motion=` query param and no `src/js/motion.js`; don't reintroduce either.

---

## What's built

### 1. Preloader — counts 0 → 100, then lifts

1. Counter and name rise from behind a mask; the red rule draws in.
2. The counter runs 0 → 100 in uneven steps, with **speed-linked motion blur** —
   the faster it counts, the softer the digits read.
3. It **holds at 94 until `window.load` actually fires**, then finishes to 100.
   The number reflects real loading, not a fake timer.
4. The red rule collapses right-to-left; counter and name lift out of the mask.
5. **Five panels — each carrying one slice of the same background image — lift
   in sequence**, tearing the screen apart to uncover the site.
6. The hero animates in *while* the panels are still moving, so there's no dead beat.

Whole sequence is ~5.5s.

### 2. Hero — ice smoke + the pressure-sensitive name

> **Palette:** the site is now "ice" — frost white, sea-ink type and lake teal
> (see `base.css`). Vision alone keeps the original dark palette. Mentions of
> red / black further down describe the earlier version.
>
> **Opening:** the countdown now dissolves onto the **Eden** scene
> (`src/js/eden.js`, from the standalone eden-scroll page): an ice sheet that
> scroll cracks open, a meadow with two reaching hands and a press-and-hold,
> and a dive into the light that lands on this hero. The five-panel wipe and
> the Vision section are gone; the Vision statement now lives inside Eden
> (VISION title, then three sentences over the reaching hands).
>
> **Hand-off:** the hero overlaps the scene's last screen (`margin-top:
> -100vh`). While it rises, `clouds.js` draws the smoke see-through above a
> turbulent front (`setRise`), so a wall of ice smoke billows up and swallows
> the dive; the hero ground, veil and type fade in behind it. DIVE IN stays
> hidden through the opening and arrives with the hero.

- **Background** (`clouds.js`) — one full-screen WebGL quad. Domain-warped fBm
  noise drifting upward, rendered at 55% of device resolution (smoke is soft;
  nobody can tell, and it costs almost nothing). A breath of white is mixed into
  the hottest cores. **Deliberately not cursor-reactive** — the pointer hook is
  marked in the file. No WebGL falls back to the CSS gradient on `.hero::before`.
- **The name** (`textPressure.js`) — a **vanilla port of the React Bits
  TextPressure component** (no React in this project). Variable-font axes
  (`wght` / `wdth` / `ital`) react to cursor distance, so letters near the
  pointer go wide and heavy while far ones thin to hairlines. Needs a variable
  font — currently Roboto Flex, loaded in `index.html`.
  `alpha` is off (letters stay fully opaque); `stroke` is on, which keeps the
  ultra-condensed far letters readable.

### 3. Menu — the left panel behind DIVE IN

PROJECTS / EXPERIENCE / CONTACT with red indices, words rising out of masks,
SOCIALS at the bottom. The `+` rotates 45° into a `×`. Closes on backdrop,
Escape, or any link. Lenis is stopped while it's open.

### 4. Projects — the glassy bento grid

`FEATURED WORK` eyebrow, a `Selected Projects` heading, and a six-cell bento:
one feature card spanning 4 columns and 2 rows, two stacked beside it, three
across the bottom. Cards are `<a>` elements that open the live project in a new
tab.

The glass is four parts:

1. **Colour blooms** behind the whole grid (`.projects__glow`) — without
   these the panels are just dark rectangles. Smooth radial gradients, no
   `filter: blur()`.
2. **A translucent panel** — a white-to-clear gradient over a dark scrim, a
   1px white border, and an `inset 0 1px 0` specular highlight along the top
   edge. That top highlight is what reads as iOS. No `backdrop-filter`: see
   the gotcha below for why it changed no pixels here and cost repaint seams.
3. **A translucent thumbnail** that lets the bloom behind it through rather
   than blocking it, with a radius concentric to the card's (outer minus
   padding).
4. **A sheen that tracks the cursor** — `projects.js` writes `--mx` / `--my`
   on pointermove and a radial gradient in `::after` follows it.

Hover lifts the card, brightens the border, scales the shot, and turns the
arrow pill red.

**Cards with no screenshot** use a *brand plate* instead of the tinted
gradient: `.card__thumb--plate` for the shared layout, plus a per-project
palette modifier (`--clinicos`, `--arco`). Each plate is built from that
project's own tokens and type — clinicOS's sage rings on paper, ARCO's arch on
near-black — and is deliberately not a mock screenshot, so it reads as identity
rather than as a fake capture. Swap in a real `<img>` when one exists.

Two thumbnails came out of the projects themselves rather than a screenshot
tool: OBSIDIAN's from `assets/models/model-01.png`, and Solara's decoded from
the `--img-cafe` base64 data URI inlined in its own `index.html`.

**Adding a real project** — in `index.html`, edit the card's `href`, title and
tag, and drop an `<img>` inside `.card__thumb`. Every `href` currently points at
`#`, which `main.js` deliberately swallows so an unfilled card can't open a
duplicate tab. The `--thumb-a` / `--thumb-b` inline pair is the placeholder
tint and can go once there's an image.

Like Vision, this section always runs the full motion.

---

### 5. Experience — "Where I've Been"

Scrubbed over a 300vh runway, modelled on the card sequence in the OBSIDIAN
construction section:

1. The heading rises in.
2. A thread draws itself across the frame — one SVG path walked by its own
   `stroke-dashoffset`, with a red dot riding the drawn end. The dot is placed
   with `path.getPointAtLength()` each frame rather than a motion-path plugin,
   so there's no extra dependency.
3. The three cards come up **one after another** and settle at different
   heights (`REST_OFFSET` in `experience.js`), so the row reads as a stagger
   rather than a rule.

Cards carry a cut bottom-right corner. `border-radius` rounds the other three
and a `clip-path` polygon removes only that wedge — the polygon's own corners
are outside the rounded background, so they clip nothing. The middle card is
the solid accent one.

`vector-effect="non-scaling-stroke"` keeps the thread hairline-thin at every
viewport, since the SVG itself is stretched to the frame.

**The card copy is placeholder** — replace `role`, `meta` and `body` on each
`.exp-card` in `index.html`.

---

### 6. Contact — map, pin, and a form that actually sends

Left: the pitch, the details, and a **dotted world map** with a pinned marker —
a beam, two pulsing rings offset in time, and a floating label. The pulse and
float are CSS keyframes; only the panel/map reveal is GSAP.

The map is generated, not hand-drawn:

```bash
npm run map        # tools/build-map.mjs -> public/assets/world-dots.svg
```

`dotted-map` is a **devDependency** — it runs once at authoring time and never
ships to the browser. The SVG is 221 KB raw but ~10 KB gzipped, since it's a
few thousand near-identical `<circle>`s. The script also prints the pin's
position as percentages; those live in `--pin-x` / `--pin-y` in `contact.css`.
To move the pin, change `HOME` in the script, re-run, paste the two numbers.

**The form.** Client-side validation (name, a real email, a message of some
substance), `aria-invalid` on the offending fields, a live-region status line,
and focus sent to the first bad field. Errors clear as soon as a field becomes
valid, so nobody gets scolded mid-type.

Submission POSTs JSON to **`FORM_ENDPOINT` at the top of `src/js/contact.js`** —
paste a Formspree / Web3Forms / Getform / Basin URL there. While it's empty the
form says so outright rather than pretending to have sent anything.

---

### 7. Footer — Genesis Studios

The short version on purpose: a mark, one row of links, a dotted rule, and the
base line with copyright and socials. No column stacks.

The one flourish is the oversized **Portfolio** wordmark sunk into the
background at `23vw`, pulled below the footer's bottom edge with a negative
margin so `overflow: hidden` crops it rather than leaving it floating. It sits
at 4.5% white — present, not legible.

---

### 8. Vision — scroll-scrubbed

One scrubbed timeline over a 280vh runway:

1. A small card **fades in blurred** and grows from 0.34 to full bleed,
   **sharpening as it opens** — `blur(30px)` → `blur(0)`.
2. **THE VISION** rides on top of the card the whole way up, then fades and
   scales out once the image is open.
3. It hands off to the large tracked **VISION** header, centred in the frame.
4. The statement fades up directly beneath it — header and statement are
   one centred stack (`.vision__block`), so they read as a unit rather
   than a label pinned to the top edge.

Image corners are feathered with a radial `mask-image` so it melts into the
black.

**This section always runs the full scrub**, like every other section — see
[Motion](#motion).

The blur is appended to the image's resting `filter` string and both ends of
the tween carry the same function list, so GSAP interpolates it cleanly. The
radius starts at 30px because the filter is computed *before* the 0.34 scale —
on screen that reads as roughly 10px.

### 9. Process — the four-step index, before Contact

A sticky index on the left, one panel on the right that swaps as each step
takes over. It advances itself every 4.8s while the section is on screen and
hands over the moment you touch it — hover pauses the timer, clicking a step
jumps there and restarts the clock. The timer stops entirely once the section
leaves the viewport.

Two deliberate omissions, both of which are what make this pattern read as
stock when they are present:

- **No card chrome.** The steps hang off a single hairline with one red
  marker that grows down it. Boxing each step is chrome standing in for
  hierarchy.
- **No fake browser.** The panel is a status strip over a dark well. Three
  traffic-light dots are the most reused illustration on the web, and this is
  an inbox and a deploy log, not a Chrome window.

The deploy grid in pane 03 is a **fixed** array (`HITS` in
`src/js/process.js`), not random — a chart that reshuffles on every reload
reads as decoration rather than data.

---

## Phones

Same sections, same motion — only the per-frame cost changes.
`src/js/device.js` reads the device once at boot (`isTouch`, `isLowPower`)
and the effects budget from it:

- **three.js never loads on touch.** `ghostCursor.js` and `heroInk.js` are
  dynamic imports behind `!isTouch`; they are most of the JS by weight.
- **Smoke** renders at ~0.5 CSS px, 4 fBm octaves, 30fps on phones, and stops
  drawing on every device once the hero is off screen.
- **TextPressure** holds its centred pose on touch instead of following the
  finger — no per-frame rect reads, no stale pose after a scroll.
- **No scrubbed or reveal `filter: blur()`** on phones (Vision, project cards,
  hero letters, process panes), and no backdrop blur where only smooth
  gradients sit behind (process panel, hero ghost button).
- `ScrollTrigger.config({ ignoreMobileResize: true })` — the address bar is
  not a resize worth remeasuring every trigger for.

**Keep every decorative layer inside the viewport's width.** One glow in
Process sat at `inset: … -20% …` with no clip; mobile browsers answered the
wider document by zooming the whole layout out, which pushed the fixed
DIVE IN toggle off screen. Sections with overhanging glows use
`overflow-x: clip` (not `hidden` — that would break the sticky index).

---

## Type

**Archivo (display) + Instrument Sans (text).** This was Montserrat + Inter,
which is the default pairing of every generated landing page on the web, and
on a site whose hero is a variable font flexing its width axis it also wasted
the one idea the page has.

Archivo carries a real `wdth` axis (62–125), so headings are set on it
deliberately rather than by weight alone. Three presets live in `:root`:

| token | axis | used for |
|---|---|---|
| `--ax-wide`   | `wdth` 115, `wght` 620 | section titles |
| `--ax-mid`    | `wdth` 100, `wght` 560 | card and step titles |
| `--ax-narrow` | `wdth` 80,  `wght` 520 | eyebrows, numerals, meta |

An eyebrow at width 80 next to a title at width 115 reads as designed; one
weight tracked out at three sizes reads as a default. **Roboto Flex stays** —
`textPressure.js` needs a variable font with `wght`/`wdth`/`ital`.

There is also one shared scale (`--t-micro` … `--t-h2`) and one rhythm
(`--sec-pad-s` / `--sec-pad` / `--sec-pad-l`) in `base.css`. Every section
used to invent its own `clamp()` values, which is why nothing lined up
between them. The three padding steps are what let the page pull tight after
the showcase and open wide again before the close, instead of marching at one
interval the whole way down.

**The hero is deliberately exempt** from the layout and casing decisions —
it keeps its own composition and its uppercase headline. It picks up the new
faces because the alternative is two sans-serifs on one page.

---

## Publishing

`npm run build` outputs `dist/`, which is a plain static folder — Vercel,
Netlify, Cloudflare Pages, GitHub Pages all serve it with no config. On Vercel:
framework preset **Vite**, build `npm run build`, output `dist`.

### The project sites ship with it

The four featured projects live in `public/work/<slug>/` and are copied into
`dist/` verbatim by Vite, so they deploy as part of the same site:

```
/work/obsidian/index.html
/work/clinicos/index.html
/work/solara/index.html
/work/arco/index.html
```

The cards link to those paths. They used to point at `claude.ai/artifact/...`
URLs, which was wrong for a published portfolio: those are bound to one Claude
account, need to be shared publicly to work at all, and render inside claude.ai's
own chrome on a claude.ai URL. Same-origin paths have none of those problems and
keep working for as long as the site does.

**The cards link to `/work/<slug>/index.html`, not `/work/<slug>/`, on purpose.**
Vercel resolves the directory form to its index, but Vite's dev server answers it
with the SPA fallback — you get the portfolio page instead of the project. The
explicit path is correct on every host and in dev.

Each project keeps its own relative asset paths, so nothing needed rewriting to
run under a subpath. `public/work/obsidian` also carries the same motion patch as
the deployed artifact, so its scroll animation always runs.

## Structure

```
index.html              all markup: preloader, hero, vision, projects,
                        experience, contact, footer, menu
public/assets/vision.jpg  the Vision background image
public/work/<slug>/       the four featured project sites, deployed as-is

src/js/main.js          boot: Lenis + ScrollTrigger + every section
src/js/preloader.js     the 0 -> 100 counter and the curtain reveal
src/js/hero.js          hero reveal (runs while the curtain is still lifting)
src/js/textPressure.js  vanilla port of React Bits' TextPressure
src/js/clouds.js        WebGL red smoke — domain-warped fBm (not interactive)
src/js/menu.js          the left panel behind DIVE IN
src/js/vision.js        scroll-scrubbed Vision section (GSAP ScrollTrigger)
src/js/projects.js      the glassy bento grid: reveal + cursor sheen
src/js/experience.js    Where I've Been: scrubbed thread + staggered cards
src/js/practice.js      How I Work: the seam, the spine, the four steps
src/js/process.js       the four-step index + swapping panel, before Contact
src/js/contact.js       the form, its validation, and the reveal

src/styles/base.css     design tokens: colour, type, motion, curtain gradient
src/styles/preloader.css
src/styles/hero.css
src/styles/menu.css
src/styles/projects.css
src/styles/experience.css
src/styles/practice.css
src/styles/process.css
src/styles/contact.css
src/styles/footer.css
src/styles/vision.css
```

Everything shares **one rAF loop** — GSAP's ticker drives Lenis, the smoke, and
the pressure text.

---

## Tuning

### Smoke (`src/js/clouds.js`, in the fragment shader)

| | |
|---|---|
| `uTime * 0.042` | drift speed |
| `mix(0.18, 1.0, column)` | how far smoke reaches to the sides |
| `mix(0.12, 1.0, rise)` | how much survives at the bottom |
| `density * 2.4 - 0.34` | contrast — the `- 0.34` is what crushes to black |
| `smoothstep(0.86, 1.0, d) * 0.2` | how much white in the hot cores |
| `smoothstep(1.6, 0.15, …)` | vignette |

### Motion tokens

Easing and duration live in `:root` in `src/styles/base.css`. The animation
timings themselves are in the GSAP timelines — one file per section.

### Reveal hooks

- `.js-reveal` — fades and lifts into place, staggered
- the pressure characters animate in separately, out of focus into focus

---

## Gotchas worth remembering

- **Never put a CSS `transition` on a property GSAP animates on the same
  element.** They fight, and the tween visibly stalls part-way. This bit the
  menu links: `.menu__word` is tweened by GSAP, so its hover shift lives on
  `.menu__mask` instead.
- **The menu toggle lives outside `.site` in the DOM on purpose.** `.hero` has
  `isolation: isolate`, so a toggle inside it can never paint above the menu
  overlay, whatever its z-index.
- **Never write a CSS property onto a `backdrop-filter` element every
  pointermove.** Chrome re-samples that element's backdrop a dirty-rect at a
  time, and the boundary tears a hard vertical seam across the card while the
  mouse moves. The cursor sheen therefore lives on its own `.card__sheen`
  child, and the writes are coalesced to one per frame with rAF.
- **Don't nest `backdrop-filter` inside `backdrop-filter`.** `.card__thumb`
  used to have its own on top of `.card__inner`'s; it made the seam far worse
  and bought nothing, since the glass behind had already frosted the bloom.
- **`backdrop-filter: blur()` over a smooth gradient is a no-op you pay for.**
  Blurring a smooth gradient returns the same gradient. The project cards sit
  on nothing but radial gradients, so the blur changed no pixels — while
  forcing a backdrop re-sample for every frame of the 0.8s hover transition
  (which moves and reshadows that very box) and tearing seams across the card.
  The cards now have none. The glass reads from translucency, a white edge, an
  `inset 0 1px 0` specular highlight and a deep shadow — the blur was never
  what made it look like glass.
- **The rule of thumb:** only reach for `backdrop-filter` when there is real
  detail behind the element *and* the element never moves. `.menu__panel` still
  uses one because it genuinely sits over the hero smoke.
- **A `filter: blur()` layer directly behind backdrop-filtered elements is
  expensive and seam-prone.** `.projects__glow` uses soft radial-gradient
  stops instead — radial gradients are already smooth, so the blur was only
  adding a large compositing layer for the cards to re-sample.
- **Two stacked sections have to meet at the same value, or you see the
  join.** Projects' bloom was still bright where the section clipped, so it
  cut flat against Experience's ground. Both layers now fade to zero at that
  boundary — Projects via a `mask-image` on `.projects__glow`, Experience via
  one on `.exp::before` — and the warmth continues across as a glow rising out
  of the black. Fading only one side just moves the step; it doesn't remove it.
- **Import CSS from JS, not via `@import` chains.** A `main.css` that only
  `@import`ed the others silently went stale under HMR and dropped a stylesheet.
- **Don't gate motion on `prefers-reduced-motion`.** The preview pane reports
  `reduce` unconditionally, so any gate reads as "the animation is broken".

## Known / open

- `public/assets/vision.jpg` is only **736×458**, so it looks soft at full
  bleed. Drop a higher-resolution file at the same path — no code change needed.
- `#projects`, `#experience` and `#contact` all exist now and their menu links
  smooth-scroll through Lenis. The socials are still `#`.
- **The contact form has no endpoint yet** — set `FORM_ENDPOINT` in
  `src/js/contact.js`. The email and phone in the Contact section are
  placeholders too, and so are the four footer social links.
- The footer socials are text labels rather than brand icons, matching the
  menu. Swap in real icons if you have a set.
- The three Experience cards carry placeholder copy.
- Four of the six project cards are real and deployed as Artifacts:
  OBSIDIAN, clinicOS, Solara Roasters and ARCO. **Two are still placeholders**
  (Brand Site, Design Tokens) and need titles, tags and `href`s.
- OBSIDIAN's deployed build is missing 13 of its 14 images — `assets/looks/`
  and `assets/products/` are empty in the source project.
- Hero bio and the red caption still use the reference's wording.
