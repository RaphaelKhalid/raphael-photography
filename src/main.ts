import "./styles.css";
import { photos, hero, type Photo } from "./data/photos";
import { frame, header, footer } from "./lib/dom";
import { initSmoothScroll, initReveals, initParallax } from "./lib/motion";
import { initWebGL } from "./lib/webgl";

/* ---------------- theme ---------------- */
function initTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved;
  const btn = document.getElementById("theme-toggle");
  const label = () => {
    const dark = getComputedStyle(document.documentElement)
      .getPropertyValue("--bg").trim().startsWith("#0");
    if (btn) btn.textContent = dark ? "light" : "dark";
  };
  label();
  btn?.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
    label();
  });
}

/* ---------------- header recede on scroll ---------------- */
function initHeaderScroll() {
  const head = document.querySelector(".site-head");
  if (!head) return;
  const onScroll = () => head.classList.toggle("shrink", window.scrollY > 80);
  onScroll();
  addEventListener("scroll", onScroll, { passive: true });
}

/* ---------------- lightbox ---------------- */
function initLightbox(set: Photo[]) {
  if (!set.length) return;
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Image viewer");
  lb.innerHTML = `
    <button class="lb-close" type="button" aria-label="Close viewer">close ✕</button>
    <button class="lb-nav prev" type="button" aria-label="Previous">‹</button>
    <img alt="">
    <button class="lb-nav next" type="button" aria-label="Next">›</button>
    <div class="lb-index" aria-live="polite"></div>
    <div class="lb-quality" aria-hidden="true"></div>`;
  document.body.appendChild(lb);
  const img = lb.querySelector("img") as HTMLImageElement;
  const idxEl = lb.querySelector(".lb-index") as HTMLElement;
  const qEl = lb.querySelector(".lb-quality") as HTMLElement;
  let i = 0, lastFocus: HTMLElement | null = null, token = 0;

  const supportsAvif = document.createElement("canvas").toDataURL("image/avif").startsWith("data:image/avif");
  const ext = supportsAvif ? "avif" : "webp";
  const url = (p: Photo, w: number) => `/img/${p.base}-${w}.${ext}`;
  const widthsOf = (p: Photo): number[] => (window as any).__widths(p);
  const viewportTier = (p: Photo) => {
    const ws = widthsOf(p);
    const target = window.innerWidth * (window.devicePixelRatio || 1);
    return ws.find((w) => w >= target) ?? ws[ws.length - 1];
  };
  const lowTier = (p: Photo) => widthsOf(p).find((w) => w >= 1280) ?? widthsOf(p)[0];

  // Progressive: show a light tier instantly, then decode-and-swap up to the
  // viewport tier, then to the full-resolution master — cancelled on navigation.
  const upgrade = async (p: Photo, w: number, my: number, label: string) => {
    if (my !== token) return;
    const pre = new Image();
    pre.src = url(p, w);
    try { await pre.decode(); } catch { return; }
    if (my !== token) return;
    img.src = pre.src;
    img.classList.add("loaded");
    qEl.textContent = label;
    qEl.classList.add("show");
  };

  const show = (n: number) => {
    i = (n + set.length) % set.length;
    const p = set[i];
    const my = ++token;
    img.classList.remove("loaded");
    qEl.classList.remove("show");
    img.alt = p.alt;
    idxEl.textContent = `${String(i + 1).padStart(2, "0")} / ${String(set.length).padStart(2, "0")}`;
    const low = lowTier(p), mid = viewportTier(p), full = widthsOf(p)[widthsOf(p).length - 1];
    img.src = url(p, low);
    if (img.complete) img.classList.add("loaded");
    else img.addEventListener("load", () => { if (my === token) img.classList.add("loaded"); }, { once: true });
    // chain the upgrades
    (async () => {
      if (mid > low) await upgrade(p, mid, my, `${mid}px`);
      if (full > mid) await upgrade(p, full, my, `${full}px · full resolution`);
    })();
  };
  const open = (n: number) => {
    lastFocus = document.activeElement as HTMLElement;
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
    show(n);
    (lb.querySelector(".lb-close") as HTMLElement).focus();
  };
  const close = () => {
    lb.classList.remove("open");
    document.body.style.overflow = "";
    lastFocus?.focus();
  };

  lb.querySelector(".lb-close")!.addEventListener("click", close);
  lb.querySelector(".prev")!.addEventListener("click", () => show(i - 1));
  lb.querySelector(".next")!.addEventListener("click", () => show(i + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  lb.addEventListener("mousemove", () => lb.classList.add("cursor-mode"), { once: true });

  addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") show(i - 1);
    else if (e.key === "ArrowRight") show(i + 1);
    else if (e.key === "Tab") { e.preventDefault(); } // focus trap: keep focus inside
  });

  // swipe
  let x0: number | null = null;
  lb.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  });

  // wire triggers
  const trigger = (node: Element) => {
    const openIt = () => open(Number((node as HTMLElement).dataset.index || 0));
    node.addEventListener("click", openIt);
    node.addEventListener("keydown", (e) => {
      const k = (e as KeyboardEvent).key;
      if (k === "Enter" || k === " ") { e.preventDefault(); openIt(); }
    });
  };
  document.querySelectorAll(".frame[data-index]").forEach(trigger);
}

/* ---------------- home ---------------- */
const HERO_SIZES = "(max-width: 1500px) 100vw, 1500px";

// group an ordered list into clusters, preferring triptychs, never leaving an orphan
function clusterize<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; ) {
    let take = Math.min(3, arr.length - i);
    if (arr.length - i - take === 1) take--; // avoid a lonely trailing frame
    out.push(arr.slice(i, i + take));
    i += take;
  }
  return out;
}

function renderHome(app: HTMLElement) {
  const rest = photos.filter((p) => p.base !== hero.base);

  // ---- full-viewport hero ----
  const heroSec = el(`
    <section class="hero-full">
      <div class="bleed" data-parallax="70"></div>
      <span class="scroll-cue">scroll</span>
    </section>`);
  heroSec.querySelector(".bleed")!.appendChild(frame(hero, { sizes: HERO_SIZES, eager: true, index: 0 }));

  // ---- flow: interleave landscape "moments" with condensed vertical strips ----
  const flow = el(`<div class="flow"></div>`);
  const flat: Photo[] = [];               // visual order → lightbox index
  const emit = (p: Photo, sizes: string) => { const f = frame(p, { sizes, index: 1 + flat.length }); flat.push(p); return f; };

  const land = rest.filter((p) => p.orientation === "landscape");
  const clusters = clusterize(rest.filter((p) => p.orientation === "portrait"));
  const moment = ["m-bleed", "m-full", "m-offset-l", "m-full", "m-offset-r"];

  let li = 0, ci = 0, cyc = 0;
  while (li < land.length || ci < clusters.length) {
    // whichever pool is proportionally behind goes next (landscape wins ties)
    const takeCluster = ci < clusters.length &&
      (li >= land.length || ci / clusters.length < li / land.length);

    if (takeCluster) {
      const group = clusters[ci++];
      const strip = el(`<div class="movement m-strip wrap" data-count="${group.length}"></div>`);
      const rail = el(`<div class="strip"></div>`);
      group.forEach((p, k) => {
        const cell = el(`<div data-reveal data-reveal-delay="${k * 90}"></div>`);
        cell.appendChild(emit(p, "(max-width:720px) 100vw, 30vw"));
        rail.appendChild(cell);
      });
      strip.appendChild(rail);
      flow.appendChild(strip);
    } else {
      const p = land[li++];
      const cls = moment[cyc++ % moment.length];
      const bleed = cls === "m-bleed";
      const m = el(`<div class="movement ${cls} ${bleed ? "" : "wrap"}" data-reveal></div>`);
      const inner = el(`<div class="inner"></div>`);
      const sizes = bleed ? "100vw" : cls === "m-full" ? HERO_SIZES : "(max-width:720px) 100vw, 64vw";
      inner.appendChild(emit(p, sizes));
      m.appendChild(inner);
      flow.appendChild(m);
    }
  }

  app.append(heroSec, flow);
  const foot = el(`<div class="wrap pad-bot" style="margin-top:clamp(50px,9vw,110px)"></div>`);
  app.append(foot);
  return [hero, ...flat];
}

function renderAbout(app: HTMLElement) {
  app.appendChild(el(`
    <div class="wrap"><div class="plain">
      <span class="eyebrow">about</span>
      <p class="big">raphael</p>
      <p>Night and low-light photographs — blue hour, fog, fireworks and quiet edges. Shot on a Nikon and graded for a cinematic, low-light mood.</p>
    </div></div>`));
  return [];
}

function renderContact(app: HTMLElement) {
  app.appendChild(el(`
    <div class="wrap"><div class="plain">
      <span class="eyebrow">contact</span>
      <a class="mail" href="mailto:raphaelbahadurkhan@gmail.com">raphaelbahadurkhan@gmail.com</a>
    </div></div>`));
  return [];
}

/* small local el() */
function el(html: string): HTMLElement {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

/* ---------------- boot ---------------- */
function boot() {
  const root = document.getElementById("app")!;
  const route = root.dataset.route!;

  document.body.prepend(el(`<a class="skip" href="#app">Skip to content</a>`));
  document.body.prepend(header(route === "about" ? "about" : route === "contact" ? "contact" : ""));

  let set: Photo[] = [];
  if (route === "home") set = renderHome(root);
  else if (route === "about") set = renderAbout(root);
  else if (route === "contact") set = renderContact(root);

  document.body.appendChild(footer());
  initTheme();
  initHeaderScroll();
  initLightbox(set);

  // experiential motion
  const lenis = initSmoothScroll();
  initReveals();
  initParallax(lenis);
  // WebGL gallery (falls back silently to the DOM reveals above if unsupported)
  if (route === "home") initWebGL(lenis);
}

document.addEventListener("DOMContentLoaded", boot);
