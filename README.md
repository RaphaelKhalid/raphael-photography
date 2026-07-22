# raphael — photography portfolio

Night & low-light photography — *after hours & in between*. A static site: dark by
default, invisible chrome, the images carry it.

**Stack:** Vite + TypeScript (vanilla, no framework runtime), `sharp` for the
image pipeline, self-hosted IBM Plex Mono / Sans. No CMS, no backend.

Live: https://raphael-photography.vercel.app

## Develop

```bash
npm install
npm run images   # regenerate responsive AVIF/WebP + LQIP  (run only when photos change)
npm run dev      # local dev server
npm run build    # production build to dist/  (does NOT regenerate images)
npm run preview  # preview the production build
```

> npm here blocks install scripts by default. After `npm install`, approve the
> native deps: `npm approve-scripts sharp esbuild && npm rebuild sharp esbuild`.

## Image pipeline (`scripts/images.mjs`)

This is the part that matters. The source is the **original, unedited camera
JPEGs in `Photos/`** (6000×4000 / 4000×6000, git-ignored) — the natural look at
full fidelity is what's shipped. The cinematic grade in `Edited/` is kept but no
longer feeds the site; to bring it back, re-run the grade on the originals at
high fidelity and point `SRC` in the script back at `Edited/`.

The script produces, into `public/img/`:

- A responsive set at **768 / 1280 / 1920 / 2560 / 3840 px** on the long edge,
  in **AVIF with a WebP fallback**, wired through `srcset` + `sizes`, plus the
  full **6000px master** used as the final tier in the lightbox.
- A per-image **LQIP** — a solid dark tone sampled at build time, shown behind
  each frame until the full image resolves (reads well on the dark ground and is
  cheaper than a blur-up).
- Intrinsic dimensions + orientation into `src/data/generated.json`, so every
  frame reserves its `aspect-ratio` and the grid never reflows on load.

EXIF orientation is baked in (`.rotate()`), the sRGB profile is kept embedded
(blue-hour gradients band badly if it's stripped), and originals are never
served. The lightbox loads progressively: light tier → viewport tier → 6000px
full. Below-the-fold frames lazy-load; the hero is eager + high priority.

Derivatives in `public/img/` are **committed**, so Vercel deploys stay fast and
don't regenerate images. Run `npm run images` locally after changing photos and
commit the output.

### Adding or changing photos

1. Drop a JPEG into `Photos/` named `DSC_####.JPG`.
2. Add an entry to `content` in `src/data/photos.ts` (`base`, `alt`, `order`).
   Dimensions and LQIP merge in automatically from the pipeline.
3. `npm run images && npm run dev`.

## Content model

- `src/data/photos.ts` — per photo `{ base, alt, order }`, merged with build-time
  `{ w, h, orientation, lqip }` from `generated.json`. Never hardcode galleries
  in HTML.
- The home is **one continuous gallery** (`renderHome`) — one image per row:
  landscape frames go full-bleed; portraits enlarge to fill screen height. No
  series.

## Motion

Smooth inertia scroll (Lenis), fade/rise reveals, subtle parallax, and a
scroll-velocity FX (a live scale + skew applied to the native `<img>` — no
resampling, no quality loss). All motion is gated behind
`prefers-reduced-motion`.

## SEO / sharing

Each route's `index.html` carries a canonical URL, Open Graph + Twitter Card
tags, and points at `public/og.jpg` (1200×630, generated from the hero).
`public/robots.txt` and `public/sitemap.xml` cover crawling.

## Routes

`/` · `/about` · `/contact` — each a thin `index.html` shell with
`<main id="app" data-route="…">`, registered in `vite.config.ts`.

## Deploy

Vercel, static output (`vercel.json`, `cleanUrls`). Push to the repo → Vercel
runs `npm run build` (Vite only) and serves `dist/`. Manual:
`vercel --prod --yes`.
