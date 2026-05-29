"use client";
import { hexToFamily, type ColorFamily } from "@/lib/outfit/color";

const FAMILIES: ColorFamily[] = [
  "neutral", "red", "orange", "yellow", "green", "blue", "purple", "pink", "brown", "denim",
];

// Shared color editor used by both the uploader and the edit modal.
// - The native picker sets the exact hex AND re-derives the matching family.
// - The family chips let you override that bucket directly (e.g. force "denim"
//   even if the hex reads blue), since the family — not the hex — is what the
//   outfit generator scores on.
export function ColorField({
  color,
  family,
  onChange,
}: {
  color: string;
  family: string;
  onChange: (color: string, family: string) => void;
}) {
  return (
    <div>
      <label className="label">Color</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value, hexToFamily(e.target.value))}
          className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-surface-raised p-0.5"
          aria-label="Pick color"
        />
        <span className="font-mono text-xs text-ink-muted">{color}</span>
        <span className="text-xs text-ink-subtle">matches as</span>
        <span className="chip chip-active capitalize">{family}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FAMILIES.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(color, f)}
            className={`chip ${family === f ? "chip-active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}
