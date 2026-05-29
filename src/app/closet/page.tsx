"use client";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/Providers";
import Link from "next/link";
import { ItemCard } from "@/components/ItemCard";
import { ItemUploader } from "@/components/ItemUploader";
import { FilterBar, type Filters } from "@/components/FilterBar";

interface Item {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  imageBlurDataUrl?: string;
  primaryColor: string;
}

export default function ClosetPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({ q: "", category: "", season: "", style: "" });
  const [showUploader, setShowUploader] = useState(false);

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (f.q) params.set("q", f.q);
    if (f.category) params.set("category", f.category);
    if (f.season) params.set("season", f.season);
    if (f.style) params.set("style", f.style);
    const res = await fetch(`/api/items?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user) load(filters);
  }, [user, filters, load]);

  if (authLoading) {
    return <p className="py-12 text-center text-ink-muted">Loading…</p>;
  }
  if (!user) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h2 className="font-display text-3xl">Sign in to view your closet.</h2>
        <p className="mt-2 text-sm text-ink-muted">Your wardrobe is private to you.</p>
        <Link href="/login" className="btn-primary mt-6">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header --------------------------------------------------------- */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl leading-tight tracking-tight">
            Your <em className="text-ink-muted">closet</em>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUploader((v) => !v)}
            className="btn-primary"
          >
            {showUploader ? "Close" : "+ Add item"}
          </button>
        </div>
      </div>

      {showUploader && <ItemUploader onCreated={() => { load(filters); setShowUploader(false); }} />}

      <FilterBar onChange={setFilters} />

      {/* Grid ------------------------------------------------------------ */}
      {loading ? (
        <SkeletonGrid />
      ) : items.length === 0 ? (
        <EmptyState onAdd={() => setShowUploader(true)} />
      ) : (
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
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-surface-sunken" />
      ))}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="font-display text-3xl">Your closet is empty.</div>
      <p className="max-w-sm text-sm text-ink-muted">
        Add your first piece — we&apos;ll handle the resize, the colour-detection, and the
        thumbnail.
      </p>
      <button onClick={onAdd} className="btn-primary mt-2">+ Add your first item</button>
    </div>
  );
}
