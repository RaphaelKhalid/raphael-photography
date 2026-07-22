import { photos, series, type Photo } from "../data/photos";

const el = (html: string): HTMLElement => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
};

const srcset = (p: Photo, ext: "avif" | "webp") =>
  (window as any).__widths(p).map((w: number) => `/img/${p.base}-${w}.${ext} ${w}w`).join(", ");

// widths available per photo come from generated data via the module
import generated from "../data/generated.json";
(window as any).__widths = (p: Photo) =>
  (generated as any)[p.base].widths as number[];

export interface FrameOpts {
  sizes: string;
  eager?: boolean;
  index?: number;   // position in the active lightbox set
  cover?: boolean;  // non-interactive cover (used inside a link, no zoom trigger)
}

export function frame(p: Photo, opts: FrameOpts): HTMLElement {
  const ratio = `${p.w} / ${p.h}`;
  const loading = opts.eager ? "eager" : "lazy";
  const fetchpriority = opts.eager ? "high" : "auto";
  const interactive = !opts.cover;
  const attrs = interactive
    ? `role="button" tabindex="0" aria-label="View: ${p.alt}" data-index="${opts.index ?? 0}"`
    : `aria-hidden="true"`;
  const style = `--lqip:${p.lqip}; aspect-ratio:${ratio}` + (opts.cover ? "; cursor:pointer" : "");
  const node = el(`
    <div class="frame" style="${style}" ${attrs}>
      <picture>
        <source type="image/avif" srcset="${srcset(p, "avif")}" sizes="${opts.sizes}">
        <source type="image/webp" srcset="${srcset(p, "webp")}" sizes="${opts.sizes}">
        <img src="/img/${p.base}-640.webp" width="${p.w}" height="${p.h}"
             alt="${p.alt}" loading="${loading}" fetchpriority="${fetchpriority}" decoding="async">
      </picture>
    </div>`);
  const img = node.querySelector("img")!;
  if (img.complete) img.classList.add("loaded");
  else img.addEventListener("load", () => img.classList.add("loaded"), { once: true });
  return node;
}

export function header(active: string): HTMLElement {
  const link = (href: string, label: string) =>
    `<a href="${href}"${active === label ? ' aria-current="page"' : ""}>${label}</a>`;
  const h = el(`
    <header class="site-head">
      <a class="brand" href="/">raphael</a>
      <nav class="nav" aria-label="Primary">
        ${link("/series/", "series")}
        ${link("/about/", "about")}
        ${link("/contact/", "contact")}
        <button type="button" id="theme-toggle" aria-label="Toggle light and dark">light</button>
      </nav>
    </header>`);
  return h;
}

export function footer(): HTMLElement {
  return el(`
    <footer class="site-foot">
      <span>raphael · san francisco, ca</span>
      <span>${photos.length} frames · ${series.length} series</span>
    </footer>`);
}
