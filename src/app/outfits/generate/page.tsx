"use client";
import { useState } from "react";

interface GeneratedOutfit {
  outfitId: string;
  score: number;
  breakdown: {
    total: number;
    color: number;
    season: number;
    style: number;
    history: number;
    favorite: number;
    exploration: number;
  };
  items: { id: string; name: string; imageUrl: string; category: string; primaryColor?: string }[];
}

const SEASONS = ["SUMMER", "FALL", "WINTER", "SPRING"];
const OCCASIONS = ["CASUAL", "FORMAL", "ATHLETIC", "BUSINESS", "STREETWEAR"];

// Maximum possible total = sum of weights = 3+2+3+4+5+1 = 18. We display the
// score relative to that ceiling so users have an intuitive 0–100 sense.
const MAX_SCORE = 18;

export default function GeneratePage() {
  const [season, setSeason] = useState("SUMMER");
  const [occasion, setOccasion] = useState("CASUAL");
  const [tempF, setTempF] = useState<number | "">("");
  const [outfits, setOutfits] = useState<GeneratedOutfit[]>([]);
  const [busy, setBusy] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [feedbackById, setFeedbackById] = useState<Record<string, 1 | -1>>({});

  const generate = async (regenerate = false) => {
    setBusy(true);
    const body: Record<string, unknown> = { season, occasion };
    if (tempF !== "") body.weather = { tempF };
    if (regenerate) {
      body.excludeItemIds = outfits.flatMap((o) => o.items.map((i) => i.id));
    }
    const res = await fetch("/api/outfits/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setOutfits(res.ok ? await res.json() : []);
    setSavedIds(new Set());
    setFeedbackById({});
    setBusy(false);
  };

  const save = async (o: GeneratedOutfit) => {
    const res = await fetch("/api/outfits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Suggested ${season.toLowerCase()} ${occasion.toLowerCase()}`,
        itemIds: o.items.map((i) => i.id),
        season,
        occasion,
        generated: true,
      }),
    });
    if (res.ok) setSavedIds((s) => new Set(s).add(o.outfitId));
  };

  const feedback = async (o: GeneratedOutfit, signal: 1 | -1) => {
    setFeedbackById((m) => ({ ...m, [o.outfitId]: signal }));
    await fetch("/api/outfits/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signal, itemIds: o.items.map((i) => i.id) }),
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-5xl leading-tight tracking-tight">
          Generate an <em className="text-ink-muted">outfit</em>
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          We rank suggestions on colour harmony, season, style, your wear history, and favourites.
        </p>
      </div>

      {/* Controls -------------------------------------------------------- */}
      <div className="card p-5">
        <div className="space-y-4">
          <div>
            <label className="label">Season</label>
            <div className="flex flex-wrap gap-1.5">
              {SEASONS.map((s) => (
                <button
                  key={s} onClick={() => setSeason(s)}
                  className={`chip ${season === s ? "chip-active" : ""}`}
                >{s.toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Occasion</label>
            <div className="flex flex-wrap gap-1.5">
              {OCCASIONS.map((s) => (
                <button
                  key={s} onClick={() => setOccasion(s)}
                  className={`chip ${occasion === s ? "chip-active" : ""}`}
                >{s.toLowerCase()}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
            <label className="text-sm">
              <span className="label">Temperature (°F, optional)</span>
              <input
                type="number"
                value={tempF}
                onChange={(e) => setTempF(e.target.value === "" ? "" : Number(e.target.value))}
                className="input w-28"
                placeholder="72"
              />
            </label>
            <div className="ml-auto flex gap-2">
              {outfits.length > 0 && (
                <button onClick={() => generate(true)} disabled={busy} className="btn-secondary">
                  Regenerate
                </button>
              )}
              <button onClick={() => generate(false)} disabled={busy} className="btn-primary">
                {busy ? "Generating…" : outfits.length ? "Generate again" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results --------------------------------------------------------- */}
      {busy ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card h-64 animate-pulse" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="font-display text-3xl">Ready when you are.</div>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
            Pick a season and occasion above, then hit Generate. The first time you do it
            we&apos;ll rely on colour and season; once you save or like outfits, we&apos;ll start
            personalising.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {outfits.map((o, idx) => (
            <OutfitResultCard
              key={o.outfitId}
              outfit={o}
              rank={idx + 1}
              saved={savedIds.has(o.outfitId)}
              feedback={feedbackById[o.outfitId]}
              onSave={() => save(o)}
              onLike={() => feedback(o, 1)}
              onDislike={() => feedback(o, -1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OutfitResultCard({
  outfit, rank, saved, feedback, onSave, onLike, onDislike,
}: {
  outfit: GeneratedOutfit;
  rank: number;
  saved: boolean;
  feedback?: 1 | -1;
  onSave: () => void;
  onLike: () => void;
  onDislike: () => void;
}) {
  const pct = Math.min(100, Math.round((outfit.score / MAX_SCORE) * 100));

  return (
    <div className="card overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-muted">
            Suggestion #{rank}
          </div>
          <div className="mt-1 font-display text-3xl leading-tight">Score {outfit.score.toFixed(1)}</div>
        </div>
        <div className="text-right text-xs text-ink-muted">
          <div>out of {MAX_SCORE}</div>
        </div>
      </div>

      {/* Score progress */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
        <div className="h-full rounded-full bg-ink transition-all" style={{ width: `${pct}%` }} />
      </div>

      {/* Item row */}
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {outfit.items.map((i) => (
          <div key={i.id} className="w-24 shrink-0">
            <div className="aspect-square overflow-hidden rounded-xl border border-line">
              <img src={i.imageUrl} alt={i.name} className="h-full w-full object-cover" />
            </div>
            <div className="mt-1.5 truncate text-xs text-ink">{i.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
              {i.category.toLowerCase()}
            </div>
          </div>
        ))}
      </div>

      {/* Score breakdown */}
      <div className="mt-4 grid grid-cols-3 gap-1 text-[11px]">
        <Stat label="Color" v={outfit.breakdown.color} />
        <Stat label="Season" v={outfit.breakdown.season} />
        <Stat label="Style" v={outfit.breakdown.style} />
        <Stat label="History" v={outfit.breakdown.history} />
        <Stat label="Favorite" v={outfit.breakdown.favorite} />
        <Stat label="Novelty" v={outfit.breakdown.exploration} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center gap-2">
        <button onClick={onSave} disabled={saved} className={saved ? "btn-secondary" : "btn-primary"}>
          {saved ? "✓ Saved" : "Save"}
        </button>
        <button
          onClick={onLike}
          aria-pressed={feedback === 1}
          className={`btn-ghost ${feedback === 1 ? "bg-surface-sunken text-ink" : ""}`}
        >
          ♥ Like
        </button>
        <button
          onClick={onDislike}
          aria-pressed={feedback === -1}
          className={`btn-ghost ${feedback === -1 ? "bg-surface-sunken text-ink" : ""}`}
        >
          Pass
        </button>
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="rounded-lg border border-line/60 bg-surface px-2 py-1.5">
      <div className="text-ink-subtle">{label}</div>
      <div className="font-mono tabular-nums text-ink">{v.toFixed(2)}</div>
    </div>
  );
}
