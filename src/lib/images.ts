import sharp from "sharp";
import { rgbToFamily, ColorFamily } from "./outfit/color";

// Output dimensions. Closet grid maxes out around 480px on retina, so 960
// covers 2x. We deliver WebP — broad browser support + better compression than
// JPEG. We could swap to AVIF here once Safari support is fully stable.
const MAX_DIM = 960;
const QUALITY = 80;

export interface ProcessedImage {
  buffer: Buffer;
  contentType: "image/webp";
  width: number;
  height: number;
  blurDataUrl: string;
  primaryColor: string;
  colorFamily: ColorFamily;
}

// One pass through sharp:
//   1. Resize (fit-inside, no upscale) and re-encode as WebP
//   2. Extract a 16px blurred thumbnail for the LQIP placeholder
//   3. Compute the dominant non-background color → auto color-family tag
//
// Keeping this in one module means uploads never need to round-trip the file
// more than once.
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const pipeline = sharp(input, { failOn: "error" }).rotate(); // honor EXIF orientation

  const [optimized, blur, color] = await Promise.all([
    pipeline
      .clone()
      .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toBuffer({ resolveWithObject: true }),

    // Blur placeholder: tiny, heavily-blurred WebP encoded as base64 data URL.
    // 16x16 keeps the data-url <500 bytes — small enough to inline in HTML.
    pipeline
      .clone()
      .resize(16, 16, { fit: "inside" })
      .blur(2)
      .webp({ quality: 40 })
      .toBuffer(),

    // Dominant color: sharp's .stats() returns per-channel dominant values.
    // It's a coarse signal but good enough to bucket into a color family.
    pipeline.clone().stats(),
  ]);

  const dominant = color.dominant; // { r, g, b }
  const { family, hex } = rgbToFamily(dominant.r, dominant.g, dominant.b);

  return {
    buffer: optimized.data,
    contentType: "image/webp",
    width: optimized.info.width,
    height: optimized.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    primaryColor: hex,
    colorFamily: family,
  };
}
