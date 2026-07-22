// Responsive image pipeline for the portfolio.
// Source: graded full-res JPEGs in Edited/  ->  public/img/*.avif|*.webp
// Also emits src/data/generated.json with { base: {w,h,orientation,lqip} }.
//
// Preserves sRGB and keeps an embedded ICC profile (blue-hour gradients band
// badly when it is stripped). Run with: npm run images
import sharp from "sharp";
import { glob } from "glob";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "Edited";
const OUT = "public/img";
const WIDTHS = [640, 1280, 1920, 2560];
const DATA = "src/data/generated.json";

sharp.cache(false);

const files = (await glob(`${SRC}/*.JPG`)).sort();
await mkdir(OUT, { recursive: true });
await mkdir(path.dirname(DATA), { recursive: true });

const meta = {};

for (const file of files) {
  const base = path.basename(file, ".JPG");
  const img = sharp(file).rotate(); // bake any EXIF orientation
  const m = await img.metadata();
  const w = m.width, h = m.height;
  const orientation = w >= h ? "landscape" : "portrait";
  const longEdge = Math.max(w, h);

  // LQIP: average colour of a tiny sample, nudged darker for the dark ground.
  const { data } = await sharp(file).rotate().resize(8, 8, { fit: "inside" })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = data.length / 3;
  for (let i = 0; i < data.length; i += 3) { r += data[i]; g += data[i + 1]; b += data[i + 2]; }
  const dim = (v) => Math.round((v / n) * 0.82);
  const lqip = "#" + [dim(r), dim(g), dim(b)].map((v) => v.toString(16).padStart(2, "0")).join("");

  const widths = WIDTHS.filter((x) => x <= longEdge);
  if (widths.length === 0 || widths[widths.length - 1] < longEdge) widths.push(Math.min(longEdge, 2560));

  for (const width of [...new Set(widths)]) {
    const pipe = sharp(file).rotate()
      .resize({ width: orientation === "landscape" ? width : undefined,
                height: orientation === "portrait" ? width : undefined,
                withoutEnlargement: true })
      .withMetadata({ icc: "sRGB" }); // keep sRGB profile embedded
    await pipe.clone().avif({ quality: 58, effort: 4 }).toFile(`${OUT}/${base}-${width}.avif`);
    await pipe.clone().webp({ quality: 76 }).toFile(`${OUT}/${base}-${width}.webp`);
  }

  meta[base] = { w, h, orientation, lqip, widths: [...new Set(widths)].sort((a, b) => a - b) };
  console.log(`${base}  ${w}x${h}  ${orientation}  ${lqip}`);
}

await writeFile(DATA, JSON.stringify(meta, null, 2));
console.log(`\nwrote ${DATA} (${Object.keys(meta).length} frames)`);
