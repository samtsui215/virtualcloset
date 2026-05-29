"use client";
import { useEffect, useState } from "react";
import { useBuilder } from "@/store/builderStore";
import { ItemCard } from "@/components/ItemCard";
import { FilterBar, type Filters } from "@/components/FilterBar";

interface Item {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  imageBlurDataUrl?: string;
  primaryColor: string;
}

// Click-to-select builder. Drag-and-drop is a future enhancement — clicks are
// faster on mobile and accessible by default. Selected items live in Zustand
// so the preview tray re-renders independently from the grid.
export default function NewOutfitPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [filters, setFilters] = useState<Filters>({ q: "", category: "", season: "", style: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const builder = useBuilder();

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.category) params.set("category", filters.category);
    if (filters.season) params.set("season", filters.season);
    if (filters.style) params.set("style", filters.style);
    fetch(`/api/items?${params}`).then((r) => r.json()).then((d) => setItems(d.items ?? []));
  }, [filters]);

  const save = async () => {
    if (builder.itemIds.length < 2 || !builder.name) {
      setMsg("Need a name and at least 2 items.");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: builder.name, itemIds: builder.itemIds }),
    });
    setSaving(false);
    if (res.ok) { setMsg("Saved."); builder.clear(); }
    else setMsg("Save failed.");
  };

  return (
    <div className="space-y-6 pb-32">
      <div>
        <h1 className="font-display text-5xl leading-tight tracking-tight">
          Build an <em className="text-ink-muted">outfit</em>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">Click any item to add it. Click again to remove.</p>
      </div>

      <FilterBar onChange={setFilters} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
        {items.map((it) => (
          <ItemCard
            key={it.id}
            id={it.id}
            name={it.name}
            imageUrl={it.imageUrl}
            category={it.category}
            primaryColor={it.primaryColor}
            blurDataUrl={it.imageBlurDataUrl}
            selected={builder.itemIds.includes(it.id)}
            onClick={() =>
              builder.itemIds.includes(it.id)
                ? builder.remove(it.id)
                : builder.add({ id: it.id, name: it.name, imageUrl: it.imageUrl, category: it.category })
            }
          />
        ))}
      </div>

      {/* Sticky outfit tray — bottom on mobile, also bottom on desktop.
          Sits above the page with elevation so it stays in focus while picking. */}
      <div className="fixed inset-x-0 bottom-4 z-30 mx-auto max-w-4xl px-3">
        <div className="rounded-3xl border border-line bg-surface-raised/95 p-3 shadow-lift backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={builder.name}
              onChange={(e) => builder.setName(e.target.value)}
              placeholder="Name this outfit"
              className="input min-w-[160px] flex-1"
            />
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
              {builder.itemIds.length} {builder.itemIds.length === 1 ? "item" : "items"}
            </div>
            <button onClick={builder.clear} disabled={!builder.itemIds.length} className="btn-ghost">
              Clear
            </button>
            <button
              onClick={save}
              disabled={saving || builder.itemIds.length < 2 || !builder.name}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save outfit"}
            </button>
          </div>

          {builder.itemIds.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {builder.itemIds.map((id) => {
                const it = builder.itemsById[id];
                if (!it) return null;
                return (
                  <button
                    key={id}
                    onClick={() => builder.remove(id)}
                    className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-line"
                    title="Click to remove"
                  >
                    <img src={it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white opacity-0 transition group-hover:opacity-100">
                      Remove
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {msg && <p className="mt-2 text-xs text-ink-muted">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
