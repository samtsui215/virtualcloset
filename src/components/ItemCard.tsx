"use client";
import Image from "next/image";

interface Props {
  id: string;
  name: string;
  imageUrl: string;
  category: string;
  primaryColor?: string;
  blurDataUrl?: string;
  onClick?: () => void;
  selected?: boolean;
}

export function ItemCard({
  name,
  imageUrl,
  category,
  primaryColor,
  blurDataUrl,
  onClick,
  selected,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={`group relative aspect-[4/5] overflow-hidden rounded-2xl border bg-surface-raised text-left transition ${
        selected
          ? "border-ink shadow-lift ring-4 ring-ink/10"
          : "border-line hover:-translate-y-0.5 hover:shadow-lift"
      }`}
    >
      <Image
        src={imageUrl}
        alt={name}
        fill
        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 220px"
        placeholder={blurDataUrl ? "blur" : "empty"}
        blurDataURL={blurDataUrl}
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />

      {/* Category pill */}
      <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-ink backdrop-blur">
        {category.toLowerCase()}
      </span>

      {/* Selection mark */}
      {selected && (
        <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-surface text-xs">
          ✓
        </span>
      )}

      {/* Name + swatch */}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/55 via-black/15 to-transparent p-3 text-white">
        <span className="truncate text-sm font-medium drop-shadow-sm">{name}</span>
        {primaryColor && (
          <span
            className="h-4 w-4 shrink-0 rounded-full border border-white/60 shadow-sm"
            style={{ background: primaryColor }}
            aria-hidden
          />
        )}
      </div>
    </button>
  );
}
