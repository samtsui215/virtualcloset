import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// Storage abstraction: API routes call put() with a Buffer, get back a public URL.
// The driver is chosen from STORAGE_DRIVER env at boot. New drivers (S3, R2)
// implement the same interface and we never touch the routes.
export interface StoredObject {
  url: string;
  key: string; // path within the bucket — used for later deletion
}

export interface StorageDriver {
  put(buffer: Buffer, contentType: string, filename: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

// --- Local FS driver (dev) ----------------------------------------------------

class LocalDriver implements StorageDriver {
  private readonly dir = path.join(process.cwd(), "public", "uploads");

  async put(buffer: Buffer, contentType: string, filename: string): Promise<StoredObject> {
    await fs.mkdir(this.dir, { recursive: true });
    const key = `${contentHash(buffer)}${guessExtension(contentType, filename)}`;
    await fs.writeFile(path.join(this.dir, key), buffer);
    return { url: `/uploads/${key}`, key };
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.dir, key), { force: true });
  }
}

// --- Supabase Storage driver (prod) ------------------------------------------

class SupabaseDriver implements StorageDriver {
  private readonly base = process.env.SUPABASE_URL ?? "";
  private readonly key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET || "wardrobe";

  // We talk to the Storage REST API directly with fetch rather than the
  // @supabase/supabase-js client. The client constructs a realtime WebSocket
  // connection on init, which crashes on Node < 22 ("no native WebSocket") —
  // a needless dependency since we only use Storage. Plain fetch is portable
  // across every Node runtime, including Vercel's.
  async put(buffer: Buffer, contentType: string, filename: string): Promise<StoredObject> {
    if (!this.base || !this.key) {
      throw new Error("Supabase storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
    }
    // Content-addressed key keeps re-uploads idempotent and names unguessable.
    const objectKey = `${contentHash(buffer)}${guessExtension(contentType, filename)}`;
    const res = await fetch(`${this.base}/storage/v1/object/${this.bucket}/${objectKey}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.key}`,
        "Content-Type": contentType,
        "x-upsert": "true", // same bytes → same key → harmless overwrite
      },
      body: buffer,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Supabase upload ${res.status}: ${detail.slice(0, 200)}`);
    }
    // Public bucket → stable, cacheable URL. (Switch to createSignedUrl if the
    // bucket is made private later.)
    return {
      url: `${this.base}/storage/v1/object/public/${this.bucket}/${objectKey}`,
      key: objectKey,
    };
  }

  async delete(key: string): Promise<void> {
    if (!this.base || !this.key) return;
    await fetch(`${this.base}/storage/v1/object/${this.bucket}/${key}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${this.key}` },
    }).catch(() => {});
  }
}

// --- Shared helpers -----------------------------------------------------------

function contentHash(buffer: Buffer): string {
  return crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}

function guessExtension(contentType: string, fallbackName: string): string {
  if (contentType.includes("avif")) return ".avif";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg";
  if (contentType.includes("png")) return ".png";
  const dot = fallbackName.lastIndexOf(".");
  return dot >= 0 ? fallbackName.slice(dot) : "";
}

let driver: StorageDriver | null = null;
export function storage(): StorageDriver {
  if (driver) return driver;
  const which = process.env.STORAGE_DRIVER || "local";
  driver = which === "supabase" ? new SupabaseDriver() : new LocalDriver();
  return driver;
}
