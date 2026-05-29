// Color compatibility.
//
// We deliberately keep this simple and rule-based rather than ML-driven:
//   * the rules are inspectable and the user can be told *why* two items pair.
//   * it produces a stable signal even with a tiny wardrobe (5–10 items),
//     where an ML model would be cold-starting and useless.
//
// The interface is designed so a future embedding-based scorer can slot in
// alongside this — see scoring.ts where colorScore() is the only consumer.

export type ColorFamily =
  | "neutral"
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "brown"
  | "denim";

// Brown and denim behave a lot like neutrals in practice — they pair with most
// hues. We treat them as honorary neutrals for matching.
const NEUTRAL_LIKE: ColorFamily[] = ["neutral", "brown", "denim"];

// Approximate hue (0-360) for each chromatic family. Neutrals have no hue.
const HUE: Record<ColorFamily, number | null> = {
  neutral: null,
  brown: null,
  denim: null,
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  blue: 210,
  purple: 270,
  pink: 330,
};

/**
 * Returns a 0..1 compatibility score between two colors.
 *
 *   same family or anything paired with a neutral → 1.0
 *   analogous (hues within ~45°)                  → 0.9
 *   complementary (hues ~180° apart)              → 0.85
 *   everything else                               → 0.4
 */
export function colorCompatibility(a: ColorFamily, b: ColorFamily): number {
  if (a === b) return 1;
  if (NEUTRAL_LIKE.includes(a) || NEUTRAL_LIKE.includes(b)) return 1;

  const ha = HUE[a];
  const hb = HUE[b];
  if (ha == null || hb == null) return 0.5;

  // Shortest distance on the hue wheel.
  const d = Math.min(Math.abs(ha - hb), 360 - Math.abs(ha - hb));

  if (d <= 45) return 0.9; // analogous
  if (d >= 150 && d <= 210) return 0.85; // complementary
  return 0.4; // clashing — discourage but don't forbid
}

/**
 * Classify a single RGB sample into a coarse family + hex string.
 * Used by the upload pipeline to auto-tag items.
 *
 * Note: this runs on the *dominant* color of the image. For garments with
 * patterns it picks the most prominent shade, which is fine for compatibility
 * but a future improvement is to detect "multicolor" and treat as neutral.
 */
export function rgbToFamily(r: number, g: number, b: number): { family: ColorFamily; hex: string } {
  const hex = `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (255 - Math.abs(2 * l - 255));

  // Low saturation = effectively grayscale → neutral
  if (s < 0.15) return { family: "neutral", hex };

  // Hue in degrees
  const d = max - min;
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;

  // Special cases that the basic hue buckets get wrong:
  // brown = darkish orange/red, denim = desaturated medium blue
  if (h >= 15 && h <= 45 && l < 90) return { family: "brown", hex };
  if (h >= 200 && h <= 230 && s < 0.5 && l < 150) return { family: "denim", hex };

  const family: ColorFamily =
    h < 15 || h >= 345 ? "red" :
    h < 45 ? "orange" :
    h < 70 ? "yellow" :
    h < 170 ? "green" :
    h < 250 ? "blue" :
    h < 300 ? "purple" :
    "pink";

  return { family, hex };
}

/**
 * Classify a hex string (e.g. "#1a2233") into a color family. Thin wrapper over
 * rgbToFamily — used client-side when the user picks a color, to keep the
 * matching family in sync with the swatch they chose. Pure (no node deps), so
 * it's safe to import in the browser.
 */
export function hexToFamily(hex: string): ColorFamily {
  const parts = hex.replace("#", "").match(/.{2}/g);
  if (!parts || parts.length < 3) return "neutral";
  const [r, g, b] = parts.map((h) => parseInt(h, 16));
  return rgbToFamily(r, g, b).family;
}
