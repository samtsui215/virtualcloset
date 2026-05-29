import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { processImage } from "@/lib/images";
import { storage } from "@/lib/storage";

// We accept the image as multipart/form-data so the browser can post a File
// directly. Body size is limited by Next.js (default 4MB), which is fine for
// phone photos after client-side compression.
export const runtime = "nodejs"; // sharp requires the node runtime
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: Request) {
  const auth = await requireUserId();
  if (auth instanceof NextResponse) return auth;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Not an image" }, { status: 415 });
  }

  const input = Buffer.from(await file.arrayBuffer());

  try {
    // 1. Optimize + extract metadata (resize, blur placeholder, dominant color).
    const processed = await processImage(input);

    // 2. Persist to the configured storage driver (local in dev, Supabase in prod).
    const stored = await storage().put(processed.buffer, processed.contentType, file.name);

    // 3. Return the bits the client needs to render & to create the item record.
    //    We DON'T create the ClothingItem here — that happens in POST /api/items
    //    once the user fills in name/category/etc. Two-step keeps the upload
    //    endpoint orthogonal to item validation and lets us pre-fill the form
    //    with the detected color family while the user edits the rest.
    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      width: processed.width,
      height: processed.height,
      blurDataUrl: processed.blurDataUrl,
      primaryColor: processed.primaryColor,
      colorFamily: processed.colorFamily,
    });
  } catch (err) {
    // Surface the real reason (read-only FS, missing Supabase key, unsupported
    // format) instead of a bare 500 — shows up in Vercel logs and the client.
    const message = err instanceof Error ? err.message : "Image processing failed";
    console.error("[upload] failed:", message);
    return NextResponse.json({ error: `Upload failed: ${message}` }, { status: 500 });
  }
}
