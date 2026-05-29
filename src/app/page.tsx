import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-20 py-12 sm:py-20">
      {/* Hero -------------------------------------------------------------- */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface-raised px-3 py-1 text-xs font-medium uppercase tracking-wider text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            New · Auto outfit generation
          </span>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
            Your wardrobe,{" "}
            <em className="italic text-ink-muted">organised.</em>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-ink-muted">
            Digitise every piece you own, build outfits in seconds, and let Virtual
            Closet learn what you love — then suggest combinations you&apos;ll actually wear.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/closet" className="btn-primary">Open closet →</Link>
            <Link href="/outfits/generate" className="btn-secondary">Generate outfit</Link>
          </div>
        </div>

        {/* Decorative card stack — pure CSS, no images required */}
        <div className="relative mx-auto hidden aspect-[4/5] w-full max-w-sm lg:block">
          <div className="absolute inset-0 -rotate-6 rounded-3xl bg-gradient-to-br from-amber-100 to-orange-200 shadow-lift" />
          <div className="absolute inset-0 rotate-3 rounded-3xl bg-gradient-to-br from-stone-100 to-stone-200 shadow-lift" />
          <div className="absolute inset-0 rounded-3xl border border-line bg-surface-raised shadow-lift">
            <div className="flex h-full flex-col justify-between p-6">
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-ink-muted">
                <span>Today&apos;s pick</span>
                <span>Score 13.2</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {["#e8d5c4", "#1a2233", "#4a3a2a"].map((c, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div>
                <div className="font-display text-2xl leading-tight">Friday casual</div>
                <div className="text-sm text-ink-muted">Linen · denim · suede</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature row ------------------------------------------------------- */}
      <section className="grid gap-5 sm:grid-cols-3">
        {[
          { t: "Capture", d: "Drop in a photo. We auto-detect colour and create a transparent thumbnail." },
          { t: "Compose", d: "Click to select items. A live preview tray follows you as you build." },
          { t: "Generate", d: "Weighted scoring across colour, season, history and favourites." },
        ].map((f, i) => (
          <div key={f.t} className="card p-6">
            <div className="mb-3 font-display text-3xl text-ink-muted">0{i + 1}</div>
            <div className="mb-1 font-display text-2xl">{f.t}</div>
            <p className="text-sm leading-relaxed text-ink-muted">{f.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
