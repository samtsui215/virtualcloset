"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/Providers";
import { OutfitCard, type GalleryOutfit } from "@/components/OutfitCard";

const SEASONS = ["SUMMER", "FALL", "WINTER", "SPRING"];

export default function OutfitsPage() {
  const { user, loading: authLoading } = useAuth();
  const [outfits, setOutfits] = useState<GalleryOutfit[]>([]);
  const [loading, setLoading] = useState(false);
  const [season, setSeason] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (season) params.set("season", season);
    if (favOnly) params.set("favorite", "true");
    const res = await fetch(`/api/outfits?${params}`);
    const data = await res.json();
    setOutfits(data.outfits ?? []);
    setLoading(false);
  }, [season, favOnly]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const favorite = async (id: string, next: boolean) => {
    await fetch(`/api/outfits/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: next }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/outfits/${id}`, { method: "DELETE" });
    load();
  };

  if (authLoading) return <p className="py-12 text-center text-ink-muted">Loading…</p>;
  if (!user) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <h2 className="font-display text-3xl">Sign in to view your outfits.</h2>
        <Link href="/login" className="btn-primary mt-6">Sign in</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl leading-tight tracking-tight">
            Your <em className="text-ink-muted">outfits</em>
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {outfits.length} {outfits.length === 1 ? "outfit" : "outfits"}
            {season ? ` · ${season.toLowerCase()}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/outfits/new" className="btn-primary">+ Build outfit</Link>
          <Link href="/outfits/generate" className="btn-secondary">Generate</Link>
        </div>
      </div>

      {/* Season + favorites filters */}
      <div className="card flex flex-wrap items-center gap-2 p-4">
        <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wider text-ink-muted">Season</span>
        <button onClick={() => setSeason("")} className={`chip ${season === "" ? "chip-active" : ""}`}>all</button>
        {SEASONS.map((s) => (
          <button key={s} onClick={() => setSeason(s)} className={`chip ${season === s ? "chip-active" : ""}`}>
            {s.toLowerCase()}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-line" />
        <button onClick={() => setFavOnly((v) => !v)} className={`chip ${favOnly ? "chip-active" : ""}`}>
          ♥ favorites
        </button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-56 animate-pulse" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="font-display text-3xl">
            {season || favOnly ? "Nothing matches those filters." : "No outfits yet."}
          </div>
          <p className="max-w-sm text-sm text-ink-muted">
            {season || favOnly
              ? "Try clearing the filters, or build a new outfit."
              : "Build one by hand, or generate a few suggestions and save the ones you like."}
          </p>
          <div className="mt-2 flex gap-2">
            <Link href="/outfits/new" className="btn-primary">+ Build outfit</Link>
            <Link href="/outfits/generate" className="btn-secondary">Generate</Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((o) => (
            <OutfitCard key={o.id} outfit={o} onFavorite={favorite} onDelete={remove} />
          ))}
        </div>
      )}
    </div>
  );
}
