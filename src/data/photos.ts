import generated from "./generated.json";

export type Orientation = "landscape" | "portrait";

export interface Photo {
  base: string;          // DSC_#### — maps 1:1 to Edited/ and public/img
  alt: string;
  order: number;         // sequence in the single gallery
  w: number;
  h: number;
  orientation: Orientation;
  lqip: string;
}

// base -> content, in gallery order. dimensions/lqip merge from the build pipeline.
const content: Array<Omit<Photo, "w" | "h" | "orientation" | "lqip">> = [
  { base: "DSC_0292", order: 1,  alt: "A full moon over the lit span of a bridge at blue hour." },
  { base: "DSC_0300", order: 2,  alt: "A lone figure on a steep street at dusk." },
  { base: "DSC_0240", order: 3,  alt: "Fireworks bursting in gold over a waterfront." },
  { base: "DSC_0416", order: 4,  alt: "A fire truck's red lights streaking down a hill after dark." },
  { base: "DSC_0468", order: 5,  alt: "City lights scattered across the hills at blue hour." },
  { base: "DSC_0407", order: 6,  alt: "String lights glowing through dark foliage at night." },
  { base: "DSC_0446", order: 7,  alt: "A weathered wooden house against a deep blue dusk sky." },
  { base: "DSC_0406", order: 8,  alt: "Backlit autumn leaves catching a single point of light at dusk." },
  { base: "DSC_0475", order: 9,  alt: "A stadium floodlight standing alone against the night." },
  { base: "DSC_0363", order: 10, alt: "A pyramid tower tapering into a clear sky." },
  { base: "DSC_0279", order: 11, alt: "Rail yards seen from above." },
  { base: "DSC_0307", order: 12, alt: "Twin church spires rising above the water." },
  { base: "DSC_0324", order: 13, alt: "Rows of houses climbing a hill toward the water." },
  { base: "DSC_0315", order: 14, alt: "A little free library box beside a weathered garden ornament." },
  { base: "DSC_0351", order: 15, alt: "A flock of wild parrots gathered on a bare branch." },
  { base: "DSC_0662", order: 16, alt: "Fog rolling low over the Pacific at day's end." },
  { base: "DSC_0551", order: 17, alt: "A gull banking low over open water." },
  { base: "DSC_0253", order: 18, alt: "A bird resting on a wire against a burning orange sunset." },
  { base: "DSC_0555", order: 19, alt: "Waves breaking below coastal cliffs." },
];

const gen = generated as Record<string, { w: number; h: number; orientation: Orientation; lqip: string }>;

export const photos: Photo[] = content
  .map((c) => {
    const g = gen[c.base];
    if (!g) throw new Error(`No generated image data for ${c.base} — run 'npm run images'.`);
    return { ...c, w: g.w, h: g.h, orientation: g.orientation, lqip: g.lqip };
  })
  .sort((a, b) => a.order - b.order);

export const heroBase = "DSC_0292";
export const hero = photos.find((p) => p.base === heroBase)!;
