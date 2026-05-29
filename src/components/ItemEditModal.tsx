"use client";
import { useEffect, useState } from "react";
import { ColorField } from "@/components/ColorField";
import { ImageColorPicker } from "@/components/ImageColorPicker";

const CATEGORY = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORY", "SLEEPWEAR"];
const SEASON = ["SUMMER", "FALL", "WINTER", "SPRING", "ALL"];
const STYLE = ["CASUAL", "FORMAL", "ATHLETIC", "BUSINESS", "STREETWEAR"];

export interface EditableItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  primaryColor: string;
  colorFamily: string;
  seasons: string[];
  styles: string[];
  tags: string[];
  notes?: string | null;
}

// Edit/delete modal for a single clothing item. Mirrors the uploader's chip UI
// so editing feels identical to creating. PATCHes only the changed-capable
// fields; image + detected color are left as-is.
export function ItemEditModal({
  item,
  onClose,
  onSaved,
}: {
  item: EditableItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [category, setCategory] = useState(item.category);
  const [color, setColor] = useState(item.primaryColor);
  const [family, setFamily] = useState(item.colorFamily);
  const [seasons, setSeasons] = useState<string[]>(item.seasons);
  const [styles, setStyles] = useState<string[]>(item.styles);
  const [tags, setTags] = useState(item.tags.join(", "));
  const [notes, setNotes] = useState(item.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Close on Escape — standard modal affordance.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggle = (arr: string[], setArr: (a: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category,
          primaryColor: color,
          colorFamily: family,
          seasons,
          styles,
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          notes: notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 border-b border-line p-5">
          <img src={item.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-muted">Edit item</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input mt-1"
              placeholder="Name"
              autoFocus
            />
          </div>
          <button onClick={onClose} className="btn-ghost shrink-0" aria-label="Close">✕</button>
        </div>

        <div className="space-y-4 p-5">
          <div>
            <label className="label">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={`chip ${category === c ? "chip-active" : ""}`}>
                  {c.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Color — pick from the image</label>
            <ImageColorPicker
              src={item.imageUrl}
              onPick={(c, f) => { setColor(c); setFamily(f); }}
            />
          </div>

          <ColorField
            color={color}
            family={family}
            onChange={(c, f) => { setColor(c); setFamily(f); }}
          />

          <div>
            <label className="label">Seasons</label>
            <div className="flex flex-wrap gap-1.5">
              {SEASON.map((s) => (
                <button key={s} type="button" onClick={() => toggle(seasons, setSeasons, s)} className={`chip ${seasons.includes(s) ? "chip-active" : ""}`}>
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Styles</label>
            <div className="flex flex-wrap gap-1.5">
              {STYLE.map((s) => (
                <button key={s} type="button" onClick={() => toggle(styles, setStyles, s)} className={`chip ${styles.includes(s) ? "chip-active" : ""}`}>
                  {s.toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Tags</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="comma, separated" className="input" />
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input min-h-[64px] resize-none" rows={2} />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line p-5">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-muted">Delete this item?</span>
              <button onClick={remove} disabled={busy} className="btn bg-red-600 text-white hover:bg-red-700">
                {busy ? "Deleting…" : "Yes, delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className="btn-ghost text-red-600 hover:bg-red-50">
              Delete
            </button>
          )}
          {!confirmDelete && (
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={busy || !name} className="btn-primary">
                {busy ? "Saving…" : "Save changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
