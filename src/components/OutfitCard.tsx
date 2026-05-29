"use client";
import { useState } from "react";

interface OutfitItemRef {
  item: { id: string; name: string; imageUrl: string; category: string };
}

export interface GalleryOutfit {
  id: string;
  name: string;
  season: string | null;
  occasion: string | null;
  tags: string[];
  favorite: boolean;
  items: OutfitItemRef[];
}

export function OutfitCard({
  outfit,
  onFavorite,
  onDelete,
}: {
  outfit: GalleryOutfit;
  onFavorite: (id: string, next: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <div className="card overflow-hidden">
      {/* Item thumbnails */}
      <div className="flex gap-1.5 overflow-x-auto bg-surface-sunken p-3">
        {outfit.items.map((oi) => (
          <img
            key={oi.item.id}
            src={oi.item.imageUrl}
            alt={oi.item.name}
            title={oi.item.name}
            className="h-24 w-24 shrink-0 rounded-lg border border-line bg-surface-raised object-cover"
          />
        ))}
      </div>

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-xl leading-tight">{outfit.name}</h3>
          <button
            onClick={() => onFavorite(outfit.id, !outfit.favorite)}
            className={`shrink-0 text-xl leading-none transition ${
              outfit.favorite ? "text-red-500" : "text-ink-subtle hover:text-ink"
            }`}
            aria-label={outfit.favorite ? "Unfavorite" : "Favorite"}
          >
            {outfit.favorite ? "♥" : "♡"}
          </button>
        </div>

        {(outfit.season || outfit.occasion || outfit.tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {outfit.season && <span className="chip chip-active">{outfit.season.toLowerCase()}</span>}
            {outfit.occasion && <span className="chip">{outfit.occasion.toLowerCase()}</span>}
            {outfit.tags.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        )}

        <div className="pt-1">
          {confirm ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-ink-muted">Delete this outfit?</span>
              <button onClick={() => onDelete(outfit.id)} className="btn bg-red-600 px-3 py-1 text-white hover:bg-red-700">
                Yes
              </button>
              <button onClick={() => setConfirm(false)} className="btn-ghost px-3 py-1">No</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="btn-ghost px-3 py-1 text-sm text-red-600 hover:bg-red-50">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
