# Architecture

## System diagram

```
            ┌───────────────────────────────────────────────────┐
            │                Browser (React)                    │
            │  Closet · Builder · Generate · Auth UI            │
            │  state: SessionProvider + Zustand (builder)       │
            └────────────────┬──────────────────────┬───────────┘
                             │ JSON over HTTPS      │ <img src>
                             ▼                      ▼
            ┌─────────────────────────────┐  ┌──────────────────┐
            │   Next.js API routes        │  │  Image CDN        │
            │   (Node runtime)            │  │  Cloudinary (prod)│
            │                             │  │  or /public/      │
            │  /api/auth/[...nextauth]    │  │  uploads (dev)    │
            │  /api/register              │  └────────▲──────────┘
            │  /api/upload   ─── sharp ───┼──────────┘
            │  /api/items    (CRUD)       │
            │  /api/outfits  (CRUD)       │       optimized bytes
            │  /api/outfits/generate ◄────┼──── reads from DB
            │  /api/outfits/feedback      │
            └──────────────┬──────────────┘
                           │ Prisma (typed queries)
                           ▼
            ┌────────────────────────────────┐
            │   PostgreSQL                    │
            │  users · clothing_items         │
            │  outfits · outfit_items         │
            │  outfit_wears · item_pairings   │
            │  outfit_feedback                │
            └────────────────────────────────┘
```

## Why this shape

- **Next.js App Router for both UI and API.** A separate Express server is one more deploy target and one more failure mode. App-router server components keep DB queries close to where they're rendered; API routes handle write paths and the things the client genuinely needs to call asynchronously (upload, generate).
- **Prisma + Postgres.** Strong relational shape (`User` → `ClothingItem`, `Outfit` ↔ `Item` join, `ItemPairing` learned weights). Prisma gives us a single migration story and typed queries the generator can read from.
- **Storage abstraction.** `src/lib/storage.ts` exposes one interface (`put`, `delete`). The `local` driver writes to `public/uploads` for dev; the `cloudinary` driver delegates to their SDK. Adding an S3 driver later is a single file.
- **Stateless auth (JWT sessions).** No `Session` table to migrate, scale, or clean up. User id rides on the token; API routes pull it via `requireUserId()`.

## Image pipeline

`src/lib/images.ts` runs one `sharp` pipeline that does three things in parallel:

1. **Optimize** — resize to a max edge of 960px, re-encode as WebP at quality 80.
2. **LQIP placeholder** — 16×16 blurred WebP encoded as a base64 data URL. Stored on the row so `<Image placeholder="blur">` can render it instantly.
3. **Dominant color** — `sharp.stats().dominant` → RGB → `colorFamily` via `rgbToFamily`. The user gets an auto-tag they can override.

The processed bytes go to the storage driver; the metadata (URL, blur, color, dimensions) goes back to the client. The client then posts the metadata + user-entered fields to `/api/items`. Two-step (upload then create) means the upload endpoint stays orthogonal to item validation, and the form can pre-fill detected color while the user types the name.

## Outfit generation

The full algorithm lives in `src/lib/outfit/generator.ts`. The pipeline:

1. **Filter** by season (hard) — style is soft-matched in scoring, not filtered, so we don't accidentally hide your one "athletic" item when generating a casual outfit that *could* include it.
2. **Build scoring context once** — `Map<pairKey, count>` for history and `Set<itemId>` for favorite items. One DB read each.
3. **Pre-rank within each category** by a cheap per-item proxy (favorite > exact style match > exact season match). Keep top K (default 12).
4. **Cartesian product** the truncated lists. With K=12 across top/bottom/shoes/outerwear that's bounded by ~20k combinations, far less than brute-forcing a 100-item closet.
5. **Score each combination** with `scoreOutfit` (color compatibility, season match, style match, history, favorites, exploration).
6. **Diversify** — don't keep recommending the same top; allow some repetition (up to half the slots).

### Scoring weights

| Signal      | Weight | Source |
|-------------|--------|--------|
| color       | 3      | pairwise compatibility, normalized 0..1 |
| season      | 2      | fraction of items whose seasons include the requested one (or ALL) |
| style       | 3      | fraction of items whose styles include the requested occasion |
| history     | 4      | log-softened average pair co-occurrence count |
| favorite    | 5      | fraction of items appearing in a favorited outfit |
| exploration | 1      | bonus when history == 0 — nudges toward novel combos |

Each sub-score is normalized to 0..1 *before* its weight is applied, so weights are directly comparable. Weights live in a single `WEIGHTS` constant — easy to A/B test, easy to replace with per-user weights later.

### Color compatibility (`src/lib/outfit/color.ts`)

Rule-based, not ML. Neutrals (black/white/gray/brown/denim) pair with anything → 1.0. Analogous hues (<=45° apart) → 0.9. Complementary (≈180° apart) → 0.85. Otherwise 0.4. The rules are inspectable and produce a stable signal on a tiny wardrobe — exactly the regime where an ML model would be useless.

### Learning loop

- **Saving** or **wearing** an outfit upserts every pair of items into `ItemPairing` with `count += 1`. (`recordPairings` in `generator.ts`.)
- **Liking** a generated outfit does the same — even if it's never saved.
- **Favoriting** an outfit adds every item in it to the user's favorite set for scoring.
- **Disliking** records to `OutfitFeedback` but deliberately doesn't *decrement* `count` — a few dislikes shouldn't erase real history.

## Future ML extension

The generator is a pure module that takes `userId, season, occasion` and returns `GeneratedOutfit[]`. Replacing the scoring engine is a one-file change. Two natural extensions:

- **Embedding-based reranker.** Compute a CLIP embedding for each item image at upload time, store as a `vector` column (pgvector). The current top-K-per-category pre-rank stays as-is; the final scoring becomes `weights · rules + α · cosine(outfit_embedding, user_taste_embedding)`.
- **Personalized weights.** The `WEIGHTS` constant becomes a per-user record, learned from `OutfitFeedback` via simple gradient descent (treat each like/dislike as a labeled example).
- **Weather-aware suggestions.** Already partially implemented — `tempF < 55` flips on outerwear. Hook up a weather API call from the client (or a server-side cache keyed on the user's last location) and the same `weather` input flows in.
