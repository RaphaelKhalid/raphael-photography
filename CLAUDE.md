# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This is **not a software codebase** — it is a photography portfolio. It contains
original camera JPEGs and (once editing begins) their color-corrected derivatives.
Work here is image editing, culling, and organizing, not building or testing code.

- `Photos/` — original, unedited camera files (`DSC_####.JPG`), 6000×4000 Nikon
  JPEGs. **Treat these as read-only masters.** Never overwrite an original; write
  edits to a separate output directory (e.g. `Edited/`) so the source is always
  recoverable.

## Environment constraints (important)

The machine has **no working image-processing toolchain** out of the box:

- `python` on PATH is the Windows Store stub, not a real interpreter, and has no
  Pillow/numpy.
- The `convert` found on PATH is **Windows' disk-conversion utility, not
  ImageMagick.** Do not assume ImageMagick is present — verify with `magick -version`.

Before doing any batch pixel processing, confirm a real tool exists (real Python +
Pillow, or ImageMagick `magick`). If none, either install one or fall back to
per-image edits. See "Color correction workflow" below.

## Color correction workflow

1. **Read the image** with the Read tool to visually assess it (exposure, white
   balance / color cast, contrast, black point, saturation, highlight clipping).
2. Decide corrections per-image or per-batch (shots from one session usually share
   a cast and can take the same adjustment).
3. Apply with ImageMagick or Pillow, writing to `Edited/` at full resolution and
   high JPEG quality (e.g. `-quality 92`). Keep filenames aligned to the originals.
4. Re-read the edited file to verify the result before moving on.

Common firework/night-shot corrections in this set: lift/neutralize a slight color
cast, set a true black point, and recover midtone detail without crushing the dark
sky.
