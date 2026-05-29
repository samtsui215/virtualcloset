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
  private clientPromise: ReturnType<typeof this.makeClient> | null = null;
  private readonly bucket = process.env.SUPABASE_STORAGE_BUCKET || "wardrobe";

  private makeClient() {
    // Lazy import so the SDK is only evaluated when this driver is active.
    return import("@supabase/supabase-js").then(({ createClient }) =>
      // The service-role key bypasses RLS — it lives only on the server and is
      // never exposed to the browser. Uploads are an authorized server action.
      createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } },
      ),
    );
  }

  private client() {
    if (!this.clientPromise) this.clientPromise = this.makeClient();
    return this.clientPromise;
  }

  async put(buffer: Buffer, contentType: string, filename: string): Promise<StoredObject> {
    const supabase = await this.client();
    // Content-addressed key keeps re-uploads idempotent and names unguessable.
    const key = `${contentHash(buffer)}${guessExtension(contentType, filename)}`;
    const { error } = await supabase.storage.from(this.bucket).upload(key, buffer, {
      contentType,
      upsert: true, // same bytes → same key → harmless overwrite
    });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);

    const { data } = supabase.storage.from(this.bucket).getPublicUrl(key);
    return { url: data.publicUrl, key };
  }

  async delete(key: string): Promise<void> {
    const supabase = await this.client();
    await supabase.storage.from(this.bucket).remove([key]);
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
