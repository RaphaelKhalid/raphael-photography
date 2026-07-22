import "./styles.css";
import { photos, hero, type Photo } from "./data/photos";
import { frame, header, footer } from "./lib/dom";
import { initSmoothScroll, initReveals, initParallax, initVelocityFX } from "./lib/motion";

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
function renderHome(app: HTMLElement) {
  const rest = photos.filter((p) => p.base !== hero.base);

  // ---- hero: the whole scene, full width, header floating over it ----
  const heroSec = el(`
    <section class="hero-shot" style="aspect-ratio:${hero.w} / ${hero.h}">
      <div class="hs-frame"></div>
      <span class="scroll-cue">scroll</span>
    </section>`);
  heroSec.querySelector(".hs-frame")!.appendChild(frame(hero, { sizes: "100vw", eager: true, index: 0 }));

  // ---- flow: one image per row. landscape = full width (whole scene);
  //           portrait = enlarged to fill the screen height ----
  const flow = el(`<div class="flow"></div>`);
  rest.forEach((p, i) => {
    const tall = p.orientation === "portrait";
    const shot = el(`<div class="shot ${tall ? "tall" : "land"}" data-reveal></div>`);
    shot.appendChild(frame(p, { sizes: "100vw", index: i + 1 }));
    flow.appendChild(shot);
  });

  app.append(heroSec, flow);
  return [hero, ...rest];
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
  initVelocityFX(lenis);
}

document.addEventListener("DOMContentLoaded", boot);
