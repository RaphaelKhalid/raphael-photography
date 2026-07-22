import generated from "./generated.json";

export type Orientation = "landscape" | "portrait";

export interface Series {
  slug: string;
  title: string;
  blurb: string;
  order: number;
}

export interface Photo {
  base: string;          // DSC_#### — maps 1:1 to Edited/ and public/img
  alt: string;
  series: string;        // series slug
  order: number;         // sequence within series & home grid
  w: number;
  h: number;
  orientation: Orientation;
  lqip: string;
}

export const series: Series[] = [
  { slug: "after-dark", title: "After Dark",
    blurb: "the city once the light goes — fireworks, blue hour, lamplight.", order: 1 },
  { slug: "grid-grade", title: "Grid & Grade",
    blurb: "towers, spires and the streets that climb between them.", order: 2 },
  { slug: "wild-edge", title: "The Wild Edge",
    blurb: "where san francisco meets the pacific — parrots, gulls, fog.", order: 3 },
];

// base -> content. dimensions/lqip merged from the build-time pipeline.
const content: Array<Omit<Photo, "w" | "h" | "orientation" | "lqip">> = [
  // After Dark
  { base: "DSC_0292", alt: "A full moon hangs over the lit span of the Bay Bridge at blue hour.", series: "after-dark", order: 1 },
  { base: "DSC_0300", alt: "A lone figure on a steep San Francisco street at dusk.", series: "after-dark", order: 2 },
  { base: "DSC_0240", alt: "Fireworks burst in gold over the Embarcadero waterfront.", series: "after-dark", order: 3 },
  { base: "DSC_0416", alt: "A fire truck's red lights streak down a hill after dark.", series: "after-dark", order: 4 },
  { base: "DSC_0468", alt: "City lights scatter across the hills below Twin Peaks at blue hour.", series: "after-dark", order: 5 },
  { base: "DSC_0407", alt: "String lights glow through dark foliage at night.", series: "after-dark", order: 6 },
  { base: "DSC_0446", alt: "A weathered wooden house against a deep blue dusk sky.", series: "after-dark", order: 7 },
  { base: "DSC_0406", alt: "Backlit autumn leaves catch a single point of light at dusk.", series: "after-dark", order: 8 },
  { base: "DSC_0475", alt: "A stadium floodlight stands alone against the night.", series: "after-dark", order: 9 },
  // Grid & Grade
  { base: "DSC_0363", alt: "The Transamerica Pyramid tapers into a clear sky.", series: "grid-grade", order: 1 },
  { base: "DSC_0279", alt: "The SoMa rail yards seen from above.", series: "grid-grade", order: 2 },
  { base: "DSC_0307", alt: "The twin spires of Saints Peter and Paul rise above the bay.", series: "grid-grade", order: 3 },
  { base: "DSC_0324", alt: "Rows of houses climb a San Francisco hill toward the water.", series: "grid-grade", order: 4 },
  { base: "DSC_0315", alt: "A little free library box beside a weathered garden ornament.", series: "grid-grade", order: 5 },
  // The Wild Edge
  { base: "DSC_0351", alt: "The wild parrots of Telegraph Hill gather on a bare branch.", series: "wild-edge", order: 1 },
  { base: "DSC_0662", alt: "Fog rolls low over the Pacific at day's end.", series: "wild-edge", order: 2 },
  { base: "DSC_0551", alt: "A gull banks low over the water of the bay.", series: "wild-edge", order: 3 },
  { base: "DSC_0253", alt: "A bird rests on a wire against a burning orange sunset.", series: "wild-edge", order: 4 },
  { base: "DSC_0555", alt: "Waves break below the cliffs at Ocean Beach.", series: "wild-edge", order: 5 },
];

const gen = generated as Record<string, { w: number; h: number; orientation: Orientation; lqip: string }>;

export const photos: Photo[] = content.map((c) => {
  const g = gen[c.base];
  if (!g) throw new Error(`No generated image data for ${c.base} — run 'npm run images'.`);
  return { ...c, w: g.w, h: g.h, orientation: g.orientation, lqip: g.lqip };
});

export const heroBase = "DSC_0292";
export const hero = photos.find((p) => p.base === heroBase)!;

export const bySeries = (slug: string) =>
  photos.filter((p) => p.series === slug).sort((a, b) => a.order - b.order);

export const seriesBySlug = (slug: string) => series.find((s) => s.slug === slug);
