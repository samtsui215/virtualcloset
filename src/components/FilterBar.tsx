"use client";
import { useState } from "react";

const CATEGORIES = ["TOP", "BOTTOM", "SHOES", "OUTERWEAR", "ACCESSORY", "SLEEPWEAR"];
const SEASONS = ["SUMMER", "FALL", "WINTER", "SPRING"];
const STYLES = ["CASUAL", "FORMAL", "ATHLETIC", "BUSINESS", "STREETWEAR"];

export interface Filters {
  q: string;
  category: string;
  season: string;
  style: string;
}

// Chip-style filters: clicking a chip toggles it on/off. Clearer affordance
// than a select dropdown, and it makes the active state visually obvious.
export function FilterBar({ onChange }: { onChange: (f: Filters) => void }) {
  const [f, setF] = useState<Filters>({ q: "", category: "", season: "", style: "" });

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    setF(next);
    onChange(next);
  };

  const toggle = (key: keyof Filters, value: string) =>
    update({ [key]: f[key] === value ? "" : value });

  const hasFilters = f.category || f.season || f.style || f.q;

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search by name, tag, or note…"
            value={f.q}
            onChange={(e) => update({ q: e.target.value })}
            className="input pl-9"
          />
        </div>
        {hasFilters && (
          <button
            className="btn-ghost text-xs"
            onClick={() => {
              const cleared = { q: "", category: "", season: "", style: "" };
              setF(cleared);
              onChange(cleared);
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2.5">
        <ChipRow label="Category" values={CATEGORIES} active={f.category} onToggle={(v) => toggle("category", v)} />
        <ChipRow label="Season" values={SEASONS} active={f.season} onToggle={(v) => toggle("season", v)} />
        <ChipRow label="Style" values={STYLES} active={f.style} onToggle={(v) => toggle("style", v)} />
      </div>
    </div>
  );
}

function ChipRow({
  label, values, active, onToggle,
}: { label: string; values: string[]; active: string; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onToggle(v)}
            className={`chip ${active === v ? "chip-active" : ""}`}
          >
            {v.toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
      viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <circle cx="9" cy="9" r="6" />
      <path d="m17 17-3.5-3.5" />
    </svg>
  );
}
