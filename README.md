# raphael — photography portfolio

Night & low-light photography of San Francisco — *after hours & in between*. A
static site: dark by default, invisible chrome, the images carry it.

**Stack:** Vite + TypeScript (vanilla, no framework runtime), `sharp` for the
image pipeline, self-hosted IBM Plex Mono / Sans. No CMS, no backend.

## Develop

```bash
npm install
npm run images   # generate responsive AVIF/WebP + LQIP from Edited/  (run when photos change)
npm run dev      # local dev server
npm run build    # production build to dist/  (does NOT regenerate images)
npm run preview  # preview the production build
```

## Image pipeline (`scripts/images.mjs`)

This is the part that matters. Sources are the graded, full-resolution JPEGs in
`Edited/` (6000×4000 / 4000×6000). The script produces, into `public/img/`:

- A responsive set at **640 / 1280 / 1920 / 2560 px** on the long edge, in
  **AVIF with a WebP fallback**, wired through `srcset` + `sizes`.
- A per-image **LQIP** — a solid dark tone sampled at build time, shown behind
  each frame until the full image resolves (reads well on the dark ground and is
  cheaper than a blur-up).
- Intrinsic dimensions written to `src/data/generated.json`, so every frame
  reserves its `aspect-ratio` and the grid never reflows on load.

EXIF orientation is baked in (`.rotate()`), the sRGB profile is kept embedded
(blue-hour gradients band badly if it's stripped), and originals are never
served. Below-the-fold frames lazy-load; the hero is eager + high priority.

### Adding or changing photos

1. Drop a graded JPEG into `Edited/` named `DSC_####.JPG`.
2. Add an entry to `content` in `src/data/photos.ts` (`base`, `alt`, `series`,
   `order`). Dimensions and LQIP are merged automatically from the pipeline.
3. `npm run images && npm run dev`.

## Content model

- `src/data/photos.ts` — per photo `{ base, alt, series, order }`, merged with
  build-time `{ w, h, orientation, lqip }`.
- `series` — three sequenced sets: **After Dark**, **Grid & Grade**,
  **The Wild Edge**. Order within a series is deliberate (no two neighbours
  repeat subject or orientation).

## Colour grading

The grade that produced `Edited/` is documented in `CLAUDE.md` — a cinematic,
Edward-Hopper-leaning treatment tuned per subject (night / dusk / warm / day
profiles). Originals live outside the repo (`Photos/`, git-ignored).

## Deploy

Vercel, static output (`vercel.json`). Push to the repo → Vercel runs
`npm run build` (Vite only) and serves `dist/`. The responsive derivatives in
`public/img/` are committed, so deploys are fast and don't regenerate images.
**When you change photos, run `npm run images` locally and commit the result
before pushing.**

## Routes

`/` · `/series` · `/series/after-dark` · `/series/grid-grade` ·
`/series/wild-edge` · `/about` · `/contact`
