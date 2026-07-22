// WebGL gallery: curtains.js overlays planes synced to each DOM frame's box, so
// layout, lightbox and a11y stay intact. Before curtains reads each frame we swap
// its <img> to a high-resolution tier sized to the frame's on-screen footprint
// (capped at a GPU-safe tier) so the texture is crisp. A scroll-velocity ripple
// bends the interior while the edges stay anchored (no overscan / magnification).
// Degrades to native DOM images on reduced-motion, small/low-memory devices,
// no-WebGL, or any init error.
import { Curtains, Plane } from "curtainsjs";
import type Lenis from "lenis";

const vertexShader = `
  precision mediump float;
  attribute vec3 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat4 uMVMatrix;
  uniform mat4 uPMatrix;
  uniform mat4 uTextureMatrix0;
  varying vec2 vTextureCoord;
  uniform float uVelocity;
  void main() {
    vec3 pos = aVertexPosition;
    // ripple the interior; fade to 0 at top/bottom edges so the plane edge is
    // never lifted off its box (no overscan needed, texture shown 1:1)
    float edgeFade = 1.0 - pos.y * pos.y;
    float v = clamp(uVelocity, -18.0, 18.0);
    pos.y += sin((pos.x + 1.0) * 1.5708) * v * 0.010 * edgeFade;
    gl_Position = uPMatrix * uMVMatrix * vec4(pos, 1.0);
    vTextureCoord = (uTextureMatrix0 * vec4(aTextureCoord, 0.0, 1.0)).xy;
  }`;

const fragmentShader = `
  precision mediump float;
  varying vec2 vTextureCoord;
  uniform sampler2D uSampler0;
  uniform float uVelocity;
  void main() {
    float amt = clamp(abs(uVelocity) * 0.00028, 0.0, 0.004);
    vec2 d = vec2(0.0, 1.0);
    float r = texture2D(uSampler0, vTextureCoord + d * amt).r;
    float g = texture2D(uSampler0, vTextureCoord).g;
    float b = texture2D(uSampler0, vTextureCoord - d * amt).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }`;

const TIERS = [768, 1280, 1920, 2560, 3840]; // capped below 6000 for GPU safety
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const supportsWebGL = () => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl") || c.getContext("experimental-webgl"));
  } catch { return false; }
};

function pickTier(frameEl: HTMLElement): number {
  const r = frameEl.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const target = Math.max(r.width, r.height) * dpr * 1.15;
  return TIERS.find((t) => t >= target) ?? TIERS[TIERS.length - 1];
}

// swap a frame's image to a high-res tier and make <img src> authoritative
// (remove <source>/srcset) so curtains loads the crisp source as the texture
function upgradeSource(frameEl: HTMLElement) {
  const img = frameEl.querySelector("img");
  if (!img) return;
  const m = (img.currentSrc || img.src).match(/\/img\/(DSC_\d+)-\d+\.(avif|webp)/);
  if (!m) return;
  const [, base, ext] = m;
  frameEl.querySelectorAll("source").forEach((s) => s.remove());
  img.removeAttribute("srcset");
  img.src = `/img/${base}-${pickTier(frameEl)}.${ext}`;
}

export function initWebGL(lenis: Lenis | null): boolean {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  if (localStorage.getItem("webgl") === "off") return false;
  if (window.innerWidth < 760) return false; // native is crisper on phones
  if ((navigator as any).deviceMemory && (navigator as any).deviceMemory < 4) return false;
  if (!supportsWebGL()) return false;

  const frames = Array.from(document.querySelectorAll<HTMLElement>(".flow .frame"));
  if (!frames.length) return false;

  // defer one frame so the grid strips have their final on-screen size
  requestAnimationFrame(() => setup(frames, lenis));
  return true;
}

function setup(frames: HTMLElement[], lenis: Lenis | null) {
  frames.forEach(upgradeSource);

  const canvas = document.createElement("div");
  canvas.id = "webgl-canvas";
  document.body.appendChild(canvas);

  let curtains: any;
  try {
    curtains = new Curtains({
      container: canvas,
      pixelRatio: Math.min(window.devicePixelRatio, 2),
      watchScroll: true,
      alpha: true,
    });
  } catch { canvas.remove(); return; }

  let failed = false;
  curtains.onError(() => { failed = true; document.documentElement.classList.remove("curtains-active"); canvas.remove(); });
  curtains.onContextLost(() => curtains.restoreContext());

  let velocity = 0, smooth = 0;
  if (lenis) lenis.on("scroll", (e: any) => { velocity = e.velocity || 0; });

  const planes: any[] = [];
  try {
    frames.forEach((frameEl) => {
      const plane = new Plane(curtains, frameEl, {
        vertexShader, fragmentShader,
        widthSegments: 14, heightSegments: 1,
        uniforms: { uVelocity: { name: "uVelocity", type: "1f", value: 0 } },
      });
      // hide the DOM image only once its plane (and texture) are ready — never blank
      plane.onReady(() => frameEl.classList.add("gl-ready"));
      planes.push(plane);
    });
  } catch {
    planes.forEach((p) => { try { p.remove(); } catch { /* noop */ } });
    try { curtains.dispose(); } catch { /* noop */ }
    canvas.remove();
    return;
  }
  if (!planes.length) { canvas.remove(); return; }

  document.documentElement.classList.add("curtains-active");

  const resize = () => { try { curtains.resize(); planes.forEach((p) => p.resize()); } catch { /* noop */ } };
  addEventListener("load", resize);
  [200, 600, 1400].forEach((t) => setTimeout(resize, t));

  // The sticky header shrinks past 80px, which shifts all flow content up ~40px.
  // curtains keeps stale plane positions, so re-measure across that transition.
  let shrunk = window.scrollY > 80;
  addEventListener("scroll", () => {
    const s = window.scrollY > 80;
    if (s !== shrunk) { shrunk = s; [0, 160, 380, 480].forEach((t) => setTimeout(resize, t)); }
  }, { passive: true });

  curtains.onRender(() => {
    if (failed) return;
    smooth = lerp(smooth, velocity, 0.1);
    velocity *= 0.9;
    for (const p of planes) p.uniforms.uVelocity.value = smooth;
  });
}
