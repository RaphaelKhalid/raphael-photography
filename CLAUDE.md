# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Two things at once: a **photography portfolio website** (Vite + TypeScript static
site) and the **color-grading workflow** that produces its images.

- `Photos/` — original, unedited camera files (`DSC_####.JPG`), 6000×4000 Nikon
  JPEGs; nine carry EXIF orientation 8 (they display as 4000×6000 portrait).
  **Read-only masters. Git-ignored** (198 MB, not needed to build the site).
  Never overwrite one; edits go to `Edited/`.
- `Edited/` — graded, full-res, correctly-oriented JPEGs. The **source of truth
  for the site's image pipeline**, committed to the repo.
- `src/`, `scripts/images.mjs`, `*.html`, `public/img/` — the web app (see below).

Live: https://raphael-photography.vercel.app ·
Repo: https://github.com/RaphaelKhalid/raphael-photography

## Website architecture

- **Vite multi-page**, vanilla TS (no framework runtime). Three routes only —
  `/` (home), `/about`, `/contact` — each a thin `index.html` shell with
  `<main id="app" data-route="…">`; `src/main.ts` reads the route and renders
  header, gallery, footer, lightbox. Registered in `vite.config.ts`. **No series**
  — the home is one continuous gallery (series were removed).
- **Content** is data-driven from `src/data/photos.ts` (per-photo `base`, `alt`,
  `order`) merged with build-time `src/data/generated.json`
  (`w`, `h`, `orientation`, `lqip`). Never hardcode galleries in HTML. The home
  flow (`renderHome`) interleaves full-bleed/offset landscape "moments" with
  condensed vertical **strips** (diptych/triptych of portraits). No location
  ("San Francisco") framing in copy — one frame is from elsewhere.
- **Image pipeline** `scripts/images.mjs` (sharp): `Edited/*.JPG` → responsive
  AVIF+WebP at 768/1280/1920/2560/3840px **plus the full 6000px master** into
  `public/img/`, plus per-image LQIP tone and dimensions into `generated.json`.
  The lightbox loads progressively (light → viewport tier → 6000px full).
  Keeps sRGB embedded (blue-hour banding).
  **Not run at build time** — derivatives in `public/img/` are committed so Vercel
  deploys stay fast. Run `npm run images` manually after changing photos and
  commit the output.
- **Adding a photo:** drop the graded JPEG in `Edited/`, add an entry to
  `content` in `photos.ts`, run `npm run images`. See README for the full loop.

### Environment notes
- npm here blocks install scripts by default (an `allowScripts` wrapper). After
  `npm install`, native deps (`sharp`, `esbuild`) need approval:
  `npm approve-scripts sharp esbuild && npm rebuild sharp esbuild`.
- The `magick` binary is at `/c/Program Files/ImageMagick-7.1.2-Q16-HDRI/magick.exe`
  (not on PATH in a fresh shell). The `convert` on PATH is Windows' disk tool.
- Deploy: `vercel --prod --yes` (project `raphael-sf-photography`). The hashed
  deploy URL is SSO-gated; the public alias is `raphael-sf-photography.vercel.app`.

## Color grading workflow

The current `Edited/` set was graded with a cinematic, Edward-Hopper-leaning look,
tuned per subject via four ImageMagick profiles (see the grading script for exact
ops — the backbone is: mute saturation, filmic `-sigmoidal-contrast`, cool-shadow /
warm-highlight split via per-channel gamma, a subtle color wash, and a
radial-gradient multiply vignette):

- **NIGHT** (fireworks, moon, stadium) — protect true blacks and highlight bloom.
- **DUSK** (blue-hour streets, the weathered house, backlit foliage) — lift shadow
  detail into a cool blue mood. This is the signature grade.
- **WARM** (sunsets, fog) — keep the glow, cool the shadows.
- **DAY** (parrots, pyramid, church, beach) — desaturate and pull toward the same
  cinematic register; no grade turns midday into night, so these read as daytime.

To grade: **Read** each frame to assess it → apply with `magick` (`-auto-orient`
first; write full-res `-quality 92`+ to `Edited/`, filenames matching originals) →
**Read the output** to verify. Then `npm run images` to regenerate web derivatives.
