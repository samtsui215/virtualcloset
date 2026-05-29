"use client";
import { useRef, useState } from "react";
import { ColorField } from "@/components/ColorField";
import { ImageColorPicker } from "@/components/ImageColorPicker";

const CATEGORY = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORY", "SLEEPWEAR"];
const SEASON = ["SUMMER", "FALL", "WINTER", "SPRING", "ALL"];
const STYLE = ["CASUAL", "FORMAL", "ATHLETIC", "BUSINESS", "STREETWEAR"];

interface UploadedMeta {
  url: string;
  blurDataUrl?: string;
  primaryColor: string;
  colorFamily: string;
  width: number;
  height: number;
}

// Two-phase flow:
//   1. POST file to /api/upload — server resizes, extracts dominant color, returns metadata.
//   2. POST user-edited metadata + that returned info to /api/items.
// Splitting them lets the form show the auto-detected color while the user types.
export function ItemUploader({ onCreated }: { onCreated?: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<UploadedMeta | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("TOP");
  // Color starts from the auto-detected values; the user can override either the
  // exact hex or the matching family before saving.
  const [color, setColor] = useState("#000000");
  const [family, setFamily] = useState("neutral");
  const [seasons, setSeasons] = useState<string[]>(["ALL"]);
  const [styles, setStyles] = useState<string[]>(["CASUAL"]);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const upload = async (f: File) => {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const meta: UploadedMeta = await res.json();
      setUploaded(meta);
      // Seed the editable color from detection; user can adjust before saving.
      setColor(meta.primaryColor);
      setFamily(meta.colorFamily);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onPick = (f: File | null) => {
    setFile(f);
    if (f) upload(f);
  };

  const save = async () => {
    if (!uploaded) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          primaryColor: color,
          colorFamily: family,
          seasons,
          styles,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes: notes || undefined,
          imageUrl: uploaded.url,
          imageBlurDataUrl: uploaded.blurDataUrl,
          imageWidth: uploaded.width,
          imageHeight: uploaded.height,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      onCreated?.();
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null); setUploaded(null); setName(""); setCategory("TOP");
    setColor("#000000"); setFamily("neutral");
    setSeasons(["ALL"]); setStyles(["CASUAL"]); setTags(""); setNotes("");
  };

  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // --- Step 1: dropzone -----------------------------------------------------
  if (!uploaded) {
    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className={`card flex flex-col items-center justify-center gap-3 border-dashed py-10 text-center transition ${
          drag ? "border-ink bg-surface-sunken" : ""
        }`}
      >
        <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-sunken text-ink">
          <UploadIcon />
        </div>
        <div>
          <div className="font-display text-2xl leading-tight">Add an item</div>
          <p className="mt-1 text-sm text-ink-muted">
            {busy ? "Processing…" : "Drag a photo here, or click to choose one"}
          </p>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="btn-secondary">
          Choose photo
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {file && busy && <p className="text-xs text-ink-muted">{file.name}</p>}
      </div>
    );
  }

  // --- Step 2: details form ------------------------------------------------
  return (
    <div className="card overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[280px_1fr]">
        {/* Preview pane — image doubles as an eyedropper */}
        <div className="bg-surface-sunken p-3">
          <ImageColorPicker
            src={uploaded.url}
            onPick={(c, f) => { setColor(c); setFamily(f); }}
          />
        </div>

        {/* Form pane */}
        <div className="space-y-4 p-5">
          <div>
            <label className="label">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Linen oxford"
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="label">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY.map((c) => (
                <button
                  key={c} type="button" onClick={() => setCategory(c)}
                  className={`chip ${category === c ? "chip-active" : ""}`}
                >{c.toLowerCase()}</button>
              ))}
            </div>
          </div>

          <ColorField
            color={color}
            family={family}
            onChange={(c, f) => { setColor(c); setFamily(f); }}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Seasons</label>
              <div className="flex flex-wrap gap-1.5">
                {SEASON.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => toggle(seasons, setSeasons, s)}
                    className={`chip ${seasons.includes(s) ? "chip-active" : ""}`}
                  >{s.toLowerCase()}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Styles</label>
              <div className="flex flex-wrap gap-1.5">
                {STYLE.map((s) => (
                  <button
                    key={s} type="button"
                    onClick={() => toggle(styles, setStyles, s)}
                    className={`chip ${styles.includes(s) ? "chip-active" : ""}`}
                  >{s.toLowerCase()}</button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <input
              value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="comma, separated"
              className="input"
            />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything to remember"
              className="input min-h-[64px] resize-none"
              rows={2}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button disabled={busy || !name} onClick={save} className="btn-primary">
              {busy ? "Saving…" : "Save item"}
            </button>
            <button onClick={reset} className="btn-ghost">Discard</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 16V4M12 4l-4 4m4-4 4 4" />
      <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
