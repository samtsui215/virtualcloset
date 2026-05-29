"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { hexToFamily } from "@/lib/outfit/color";

// Eyedropper: draws the image to a canvas and samples the pixel under the
// cursor. Hover previews the color in a floating bubble; click commits it
// (and derives the matching family). Works in every browser — unlike the
// native EyeDropper API, which Safari/Firefox don't support.
const MAX_W = 320; // internal canvas resolution cap — plenty for sampling

export function ImageColorPicker({
  src,
  onPick,
}: {
  src: string;
  onPick: (hex: string, family: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tainted, setTainted] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number; hex: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    // Required so the canvas isn't "tainted" when the image is cross-origin
    // (the deployed Supabase URL). Public Supabase objects send CORS headers.
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, MAX_W / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      setTainted(false);
    };
    img.onerror = () => setTainted(true);
    img.src = src;
  }, [src]);

  // Map a mouse event to the canvas pixel and read its color.
  const sample = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    try {
      const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
      const hex = "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return { hex, localX: e.clientX - rect.left, localY: e.clientY - rect.top };
    } catch {
      // Tainted canvas (cross-origin without CORS) — disable sampling.
      setTainted(true);
      return null;
    }
  }, []);

  return (
    <div className="relative inline-block">
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => {
          const s = sample(e);
          if (s) setHover({ x: s.localX, y: s.localY, hex: s.hex });
        }}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const s = sample(e);
          if (s) onPick(s.hex, hexToFamily(s.hex));
        }}
        className={`max-h-[260px] w-full rounded-xl border border-line object-contain ${
          tainted ? "cursor-default" : "cursor-crosshair"
        }`}
      />

      {/* Floating preview bubble that follows the cursor */}
      {hover && !tainted && (
        <div
          className="pointer-events-none absolute z-10 flex items-center gap-1.5 rounded-full border border-white/70 bg-surface/95 px-2 py-1 text-xs shadow-lift backdrop-blur"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <span className="h-4 w-4 rounded-full border border-line" style={{ background: hover.hex }} />
          <span className="font-mono text-ink-muted">{hover.hex}</span>
        </div>
      )}

      <p className="mt-1.5 text-xs text-ink-subtle">
        {tainted ? "Eyedropper unavailable for this image — use the picker below." : "Hover the image, click to pick a color"}
      </p>
    </div>
  );
}
